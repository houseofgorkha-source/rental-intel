"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { cleanUpFailedUpload, getFileExtension, validateUploadFiles, verifyFileSignature } from "@/lib/uploads";
import { normalizeCityName } from "@/lib/cities";
import { isSubmitterRole, type SubmitterRole } from "@/lib/property-roles";
import {
  isContactMethod,
  isFurnishing,
  isPropertyConfiguration,
  isPropertyType,
  type ContactMethod,
} from "@/lib/property-attributes";

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

// The filterable attributes, re-validated against the canonical lists rather
// than trusted from the form. An unrecognised value becomes null: the rest of
// the submission is still worth keeping, and a null simply means the property
// does not match a positive filter for that attribute.
function getAttributes(formData: FormData) {
  const configuration = getTextValue(formData, "configuration");
  const propertyType = getTextValue(formData, "propertyType");
  const furnishing = getTextValue(formData, "furnishing");
  const area = parseAmount(getTextValue(formData, "carpetAreaSqft"), "Built-up area");

  return {
    configuration: isPropertyConfiguration(configuration) ? configuration : null,
    property_type: isPropertyType(propertyType) ? propertyType : null,
    furnishing: isFurnishing(furnishing) ? furnishing : null,
    // 0 sq.ft is not a measurement anyone means; the column's CHECK rejects
    // it anyway, so it is normalised to "not provided" here rather than
    // failing the whole submission.
    carpet_area_sqft: area.value && area.value > 0 ? area.value : null,
  };
}

// The contact channel, plus only the detail belonging to that channel.
//
// Storing a phone number for a contributor who chose 'email' would keep a
// private number the product has been told not to use — so the other field is
// dropped here, not merely hidden in the UI.
function getContactPreference(formData: FormData): {
  method: ContactMethod;
  phone: string | null;
  email: string | null;
  error?: string;
} {
  const raw = getTextValue(formData, "contactMethod");
  const method: ContactMethod = isContactMethod(raw) ? raw : "none";

  if (method === "phone") {
    const phone = getTextValue(formData, "contactPhone");
    if (phone.length < 6 || phone.length > 20) {
      return { method, phone: null, email: null, error: "Please enter a valid phone number." };
    }
    return { method, phone, email: null };
  }

  if (method === "email") {
    const email = getTextValue(formData, "contactEmail");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { method, phone: null, email: null, error: "Please enter a valid email address." };
    }
    return { method, phone: null, email };
  }

  return { method, phone: null, email: null };
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

  const attributes = getAttributes(formData);
  const contact = getContactPreference(formData);

  const amountError = askingRent.error ?? securityDeposit.error ?? contact.error;
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
      ...attributes,
      contact_method: contact.method,
      created_by: user.id,
    })
    .select("id, slug")
    .single();

  if (propertyError || !property) {
    return { error: "Unable to submit your property. Please try again." };
  }

  // Contact details go in their own table so they are never part of the
  // publicly readable property row (see 20260810000000).
  //
  // If this insert fails the property is kept and the channel is downgraded to
  // 'none': advertising "call the owner" with no number stored would be a
  // dead button, and destroying an otherwise complete submission over a phone
  // number would lose far more than it protects.
  if (contact.phone || contact.email) {
    const { error: contactError } = await supabase
      .from("property_contacts")
      .insert({ property_id: property.id, phone: contact.phone, email: contact.email });

    if (contactError) {
      await supabase
        .from("properties")
        .update({ contact_method: "none" })
        .eq("id", property.id);
    }
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

type UpdatePropertyResult = {
  error?: string;
  success?: boolean;
};

// Amend a property you contributed.
//
// What this can change is decided by the database, not by this function: the
// column-level UPDATE grant in 20260810000001 lists the commercial and
// descriptive columns, and Postgres rejects a statement naming any other one
// outright — for every role, including administrators. So `name`,
// `address_*`, `area`, `city`, `slug`, `created_by` and `submitted_as` are
// not "left out of the update" here, they are unreachable. The record a
// review is attached to still cannot drift.
//
// `status` is the one column both a moderator and a creator can reach through
// the same role, so it is guarded by the
// `properties_guard_moderation_status` trigger instead of by a grant. This
// action never names it.
//
// Row scope is the "Contributors can update their own property" policy
// (created_by = auth.uid()). The .eq() filters below mirror it so the UI
// never offers what the database would refuse, and a forged slug fails the
// same way a forged form would.
export async function updateProperty(
  formData: FormData,
): Promise<UpdatePropertyResult> {
  const slug = getTextValue(formData, "slug");
  if (!slug) return { error: "Missing property." };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to manage your properties.",
  );
  if (!user) return { error: authFailure };

  const { data: existing } = await supabase
    .from("properties")
    .select("id, submitted_as")
    .eq("slug", slug)
    .eq("created_by", user.id)
    .maybeSingle();

  if (!existing) {
    return { error: "That property could not be found in your account." };
  }

  // Same rule as submission: rent, deposit and availability are an owner's
  // commercial offer. A tenant editing the flat they live in is not setting an
  // asking price, so those fields are neither shown nor accepted for them.
  const isOwnerListing = existing.submitted_as === "owner";
  const askingRent = parseAmount(
    isOwnerListing ? getTextValue(formData, "askingRent") : "",
    "Monthly rent",
  );
  const securityDeposit = parseAmount(
    isOwnerListing ? getTextValue(formData, "securityDeposit") : "",
    "Security deposit",
  );

  const contact = getContactPreference(formData);
  const amountError = askingRent.error ?? securityDeposit.error ?? contact.error;
  if (amountError) return { error: amountError };

  const { data: updated, error: updateError } = await supabase
    .from("properties")
    .update({
      ...getAttributes(formData),
      landmark: getTextValue(formData, "landmark") || null,
      contact_method: contact.method,
      ...(isOwnerListing
        ? {
            asking_rent: askingRent.value,
            security_deposit: securityDeposit.value,
            is_available: formData.get("isAvailable") !== null,
          }
        : {}),
    })
    .eq("id", existing.id)
    .eq("created_by", user.id)
    .select("slug");

  if (updateError) {
    return { error: "Unable to save your changes. Please try again." };
  }

  // RLS filters rather than errors when a row isn't updatable, so an empty
  // result means the policy refused it — not a transient failure.
  if (!updated || updated.length === 0) {
    return { error: "That property could not be updated from your account." };
  }

  // Upsert rather than insert: the contributor may be adding contact details
  // for the first time or correcting existing ones, and the table is keyed by
  // property_id so there is at most one row either way.
  if (contact.phone || contact.email) {
    await supabase
      .from("property_contacts")
      .upsert(
        { property_id: existing.id, phone: contact.phone, email: contact.email },
        { onConflict: "property_id" },
      );
  } else {
    // Switching to "message here" or "no direct contact" removes the stored
    // number or address. Leaving it behind would keep private data the
    // contributor has just withdrawn consent for.
    await supabase.from("property_contacts").delete().eq("property_id", existing.id);
  }

  revalidatePath("/account/properties");
  revalidatePath(`/property/${slug}`);
  revalidatePath("/");
  return { success: true };
}
