"use server";

import { createClient } from "@/lib/supabase/server";

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

function getTextValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function createSlug(name: string) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `${baseSlug || "property"}-${crypto.randomUUID().slice(0, 8)}`;
}

function getFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "jpg";
}

export async function createProperty(
  formData: FormData,
): Promise<CreatePropertyResult> {
  const name = getTextValue(formData, "name");
  const addressLine1 = getTextValue(formData, "addressLine1");
  const area = getTextValue(formData, "area");
  const city = getTextValue(formData, "city");
  const state = getTextValue(formData, "state");

  if (!name || !addressLine1 || !area || !city || !state) {
    return { error: "Please complete all required property details." };
  }

  const imageFiles = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (imageFiles.some((file) => !allowedImageTypes.includes(file.type))) {
    return { error: "Images must be JPG, PNG, or WebP files." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Please sign in to submit a property." };
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
      notes: getTextValue(formData, "notes") || null,
      status: "pending",
      created_by: user.id,
    })
    .select("id, slug")
    .single();

  if (propertyError || !property) {
    return { error: "Unable to submit your property. Please try again." };
  }

  const propertyImages: PropertyImageInsert[] = [];

  for (const [index, file] of imageFiles.entries()) {
    const storagePath = `properties/${user.id}/${property.id}/${index}-${crypto.randomUUID()}.${getFileExtension(file)}`;
    const { error: uploadError } = await supabase.storage
      .from("property-images")
      .upload(storagePath, file, { contentType: file.type });

    if (uploadError) {
      return { error: "Your property was saved, but an image could not be uploaded." };
    }

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
      return { error: "Your property was saved, but its images could not be linked." };
    }
  }

  return { slug: property.slug };
}
