"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cleanUpFailedUpload, getFileExtension, validateUploadFiles, verifyFileSignature } from "@/lib/uploads";
import { normalizeCityName } from "@/lib/cities";
import { isSubmitterRole, type SubmitterRole } from "@/lib/property-roles";

type CreatePropertyResult = {
  error?: string;
  slug?: string;
};

type PropertyImageInsert = {
  property_id: string;
  storage_path: string;
  alt_text: string;
  sort_order: number;
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxFileSize = 5 * 1024 * 1024;
const maxFileCount = 5;
const maxTotalSize = 20 * 1024 * 1024;

function getTextValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// The role is a self-declared claim submitted through the form, so it is
// re-validated here against the shared allow-list rather than trusted.
function getSubmitterRole(formData: FormData): SubmitterRole | null {
  const value = getTextValue(formData, "submittedAs");
  return isSubmitterRole(value) ? value : null;
}

// Rupee amounts arrive as free text. Empty means "not provided" (null), but
// a non-empty value that isn't a valid non-negative number is a real input
// error and is surfaced rather than silently dropped.
function parseAmount(
  raw: string,
  label: string,
): { value: number | null; error?: string } {
  if (!raw) return { value: null };

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { value: null, error: `${label} must be a number of 0 or more.` };
  }

  return { value: Math.round(parsed) };
}

function createSlug(name: string) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${baseSlug || "property"}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function createProperty(
  formData: FormData,
): Promise<CreatePropertyResult> {
  const name = getTextValue(formData, "name");
  const addressLine1 = getTextValue(formData, "addressLine1");
  const area = getTextValue(formData, "area");
  const rawCity = getTextValue(formData, "city");
  const state = getTextValue(formData, "state");

  if (!name || !addressLine1 || !area || !rawCity || !state) {
    return { error: "Please complete all required property details." };
  }

  const city = normalizeCityName(rawCity);
  if (!city) {
    return { error: "Please complete all required property details." };
  }

  const submittedAs = getSubmitterRole(formData);

  // Listing details describe an owner's commercial offer, so they're only
  // accepted from an owner submission. A tenant's own rent is a different
  // fact and belongs on their review, not on the shared property record.
  const isOwnerListing = submittedAs === "owner";
  const askingRent = parseAmount(
    isOwnerListing ? getTextValue(formData, "askingRent") : "",
    "Monthly rent",
  );
  const securityDeposit = parseAmount(
    isOwnerListing ? getTextValue(formData, "securityDeposit") : "",
    "Security deposit",
  );

  const amountError = askingRent.error ?? securityDeposit.error;
  if (amountError) return { error: amountError };

  // Only an owner listing is a claim that the property is available to rent.
  // A tenant or helper adding a property they know about is contributing
  // knowledge, not advertising a vacancy — so the "Available for rent" badge
  // must not appear for them.
  const isAvailable = isOwnerListing && formData.get("isAvailable") !== null;

  const imageFiles = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  const validationError = validateUploadFiles(
    imageFiles,
    { maxFileCount, maxFileSize, maxTotalSize, allowedTypes: allowedImageTypes },
    {
      tooManyFiles: "You can upload up to 5 images.",
      invalidFile: "Images must be JPG, PNG, or WebP files up to 5 MB each.",
      totalTooLarge: "Total image upload size must be 20 MB or less.",
    },
  );
  if (validationError) return { error: validationError };

  const signaturesValid = await Promise.all(imageFiles.map(verifyFileSignature));
  if (signaturesValid.some((valid) => !valid)) {
    return { error: "Images must be JPG, PNG, or WebP files up to 5 MB each." };
  }

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to submit a property.",
  );

  if (!user) {
    return { error: authFailure };
  }

  const slug = createSlug(name);
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .insert({
      slug,
      name,
      address_line_1: addressLine1,
      address_line_2: getTextValue(formData, "addressLine2") || null,
      area,
      city,
      state,
      postal_code: getTextValue(formData, "postalCode") || null,
      maps_url: getTextValue(formData, "mapsUrl") || null,
      // `notes` is deliberately not written any more: the form now asks for a
      // landmark by name instead of accepting it inside a free-text notes
      // field. The column and its existing data are untouched.
      landmark: getTextValue(formData, "landmark") || null,
      status: "pending",
      submitted_as: submittedAs,
      asking_rent: askingRent.value,
      security_deposit: securityDeposit.value,
      is_available: isAvailable,
      created_by: user.id,
    })
    .select("id, slug")
    .single();

  if (propertyError || !property) {
    return { error: "Unable to submit your property. Please try again." };
  }

  const propertyImages: PropertyImageInsert[] = [];
  const uploadedPaths: string[] = [];

  const cleanUp = () =>
    cleanUpFailedUpload(supabase, {
      bucket: "property-images",
      uploadedPaths,
      table: "properties",
      rowId: property.id,
    });

  for (const [index, file] of imageFiles.entries()) {
    const storagePath = `properties/${user.id}/${property.id}/${index}-${crypto.randomUUID()}.${getFileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("property-images")
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      await cleanUp();
      return { error: "Unable to upload property images. Please try again." };
    }

    uploadedPaths.push(storagePath);

    propertyImages.push({
      property_id: property.id,
      storage_path: storagePath,
      alt_text: `${name} image ${index + 1}`,
      sort_order: index,
    });
  }

  if (propertyImages.length > 0) {
    const { error: propertyImagesError } = await supabase
      .from("property_images")
      .insert(propertyImages);

    if (propertyImagesError) {
      await cleanUp();
      return { error: "Unable to save property images. Please try again." };
    }
  }

  return { slug: property.slug };
}

type DeletePropertyResult = {
  error?: string;
  success?: boolean;
};

// Removes a submission the caller created, while it is still pending approval.
//
// This is the only "correct my mistake" mechanism the product offers, and it
// is deliberately narrow. A property's identity is immutable (CLAUDE.md §26)
// because reviews attach to it permanently, so amending a submission is not
// possible — removing a still-pending one and adding it again is. Once a
// property is published it is part of the shared record and can no longer be
// withdrawn this way.
//
// The database remains the authority: the "Property creators can remove their
// pending properties" policy (migration 20260801000001) already scopes DELETE
// to `created_by = auth.uid() and status = 'pending'`. The filters below
// mirror that so the UI never offers what the database would refuse, and so a
// forged slug fails the same way a forged UI would.
export async function deletePendingProperty(
  formData: FormData,
): Promise<DeletePropertyResult> {
  const slug = getTextValue(formData, "slug");
  if (!slug) return { error: "Missing property." };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to manage your submissions.",
  );
  if (!user) return { error: authFailure };

  const { data: property } = await supabase
    .from("properties")
    .select("id, status")
    .eq("slug", slug)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!property) {
    return { error: "That submission could not be found in your account." };
  }

  if (property.status !== "pending") {
    return {
      error:
        "This property has already been reviewed, so it can no longer be removed.",
    };
  }

  // Read the image paths BEFORE deleting the property: property_images has
  // `on delete cascade` on property_id, so the rows holding these paths are
  // destroyed by the delete below and the storage objects would be
  // unreachable afterwards.
  const { data: imageRows } = await supabase
    .from("property_images")
    .select("storage_path")
    .eq("property_id", property.id);

  // Confine removal to this property's own folder. Storage RLS independently
  // restricts deletes to `properties/<auth.uid()>/...`, so a path would have
  // to satisfy both this prefix and that policy to be removed — a tampered
  // storage_path cannot reach another property's or another user's objects.
  const pathPrefix = `properties/${user.id}/${property.id}/`;
  const storagePaths = (imageRows ?? [])
    .map((row) => row.storage_path)
    .filter((path): path is string => typeof path === "string" && path.startsWith(pathPrefix));

  const { data: deleted, error: deleteError } = await supabase
    .from("properties")
    .delete()
    .eq("id", property.id)
    .eq("created_by", user.id)
    .eq("status", "pending")
    .select("id");

  if (deleteError) {
    return { error: "Unable to remove this submission. Please try again." };
  }

  // RLS filters rather than errors when a row isn't removable, so an empty
  // result means the policy refused it — not a transient failure.
  if (!deleted || deleted.length === 0) {
    return { error: "That submission could not be removed from your account." };
  }

  // Best-effort and deliberately last: the row is already gone, so a storage
  // failure leaves orphaned files rather than a property whose images have
  // been destroyed underneath it. Never surfaced as an error — the user's
  // action succeeded.
  if (storagePaths.length > 0) {
    try {
      await supabase.storage.from("property-images").remove(storagePaths);
    } catch {
      // Intentionally ignored — see comment above.
    }
  }

  revalidatePath("/account/properties");
  revalidatePath("/account");
  revalidatePath("/");
  return { success: true };
}

// There is deliberately no updateProperty action of any kind.
//
// A property record has no amendment flow: its identity columns are
// unreachable through the Data API for every role (see
// 20260809000001_add_admin_moderation.sql), which is what guarantees the
// record a review is attached to cannot change out from under that review.
// The only correction mechanism is deletePendingProperty above — remove a
// still-pending submission and add it again.
//
// A previous iteration carried an `updatePropertyListing` here for an owner
// to edit rent, deposit and availability. It had no caller and could never
// have succeeded (there was, and is, no UPDATE policy scoped to a creator),
// so it was removed rather than left as an action that silently fails.
// Owner-editable availability is a real, still-open product gap: reopening it
// needs its own migration widening the column grant, and must not widen it
// past the four commercial columns.
