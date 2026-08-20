"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeCityName } from "@/lib/cities";
import {
  validateUploadFiles,
  verifyFileSignature,
  getFileExtension,
} from "@/lib/uploads";
import { getSpottedBoardImageUrl, type SpottedBoard } from "@/lib/spotted-boards";

const ANON_ID_COOKIE = "ri_spotted_anon_id";
// A year is generous, but this cookie backs nothing but the rate limit in
// submit_spotted_board() — it carries no identity, no session, nothing that
// needs to expire sooner for security reasons.
const ANON_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const maxFileSize = 5 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

type SubmitResult = {
  error?: string;
  success?: boolean;
};

function getTextValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// The one anonymous identity this feature has — a random id in a first-party
// cookie, distinct from Supabase's own auth cookie (there is no account
// here). Read if already set; otherwise generated and written back, so a
// returning visitor on the same browser keeps the same id across
// submissions rather than resetting their own rate limit every time.
async function getOrSetAnonSubmitterId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANON_ID_COOKIE)?.value;
  if (existing) return existing;

  const id = crypto.randomUUID();
  cookieStore.set(ANON_ID_COOKIE, id, {
    maxAge: ANON_ID_COOKIE_MAX_AGE_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return id;
}

// Submit a spotted "TO LET" board — no sign-in required (see the migration's
// own comment for why that's a deliberate, confirmed exception to how every
// other write in this app works). Two layers of abuse protection: the
// honeypot field below (cheap, first pass), and the actual gate, which is
// the rate limit inside submit_spotted_board() itself — enforced in the
// database because this is the one write path an attacker could otherwise
// reach directly with the public anon key, bypassing this action entirely.
export async function submitSpottedBoard(formData: FormData): Promise<SubmitResult> {
  // Honeypot — see PropertyForm.tsx's own comment for the same pattern.
  if (getTextValue(formData, "website")) {
    return { error: "Unable to submit right now. Please try again." };
  }

  const phone = getTextValue(formData, "phone");
  const rawCity = getTextValue(formData, "city");
  const area = getTextValue(formData, "area") || null;
  const latitude = Number(formData.get("latitude"));
  const longitude = Number(formData.get("longitude"));

  if (!phone || phone.length < 6 || phone.length > 20) {
    return { error: "Please enter a valid phone number." };
  }
  if (!rawCity) {
    return { error: "Please select a city." };
  }
  const city = normalizeCityName(rawCity);
  if (!city) {
    return { error: "Please select a city." };
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { error: "Please drop a pin on the map for this board's location." };
  }

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Please add a photo of the board." };
  }

  const validationError = validateUploadFiles(
    [photo],
    { maxFileCount: 1, maxFileSize, maxTotalSize: maxFileSize, allowedTypes: allowedImageTypes },
    {
      tooManyFiles: "Please add just one photo.",
      invalidFile: "The photo must be a JPG, PNG, or WebP file up to 5 MB.",
      totalTooLarge: "The photo must be up to 5 MB.",
    },
  );
  if (validationError) return { error: validationError };

  if (!(await verifyFileSignature(photo))) {
    return { error: "The photo must be a JPG, PNG, or WebP file up to 5 MB." };
  }

  const anonSubmitterId = await getOrSetAnonSubmitterId();
  const supabase = await createClient();

  const storagePath = `${crypto.randomUUID()}.${getFileExtension(photo)}`;
  const { error: uploadError } = await supabase.storage
    .from("spotted-boards")
    .upload(storagePath, photo, { contentType: photo.type });

  if (uploadError) {
    return { error: "Unable to upload the photo. Please try again." };
  }

  const { error: rpcError } = await supabase.rpc("submit_spotted_board", {
    p_anon_submitter_id: anonSubmitterId,
    p_photo_storage_path: storagePath,
    p_latitude: latitude,
    p_longitude: longitude,
    p_phone: phone,
    p_city: city,
    p_area: area,
  });

  if (rpcError) {
    // Best-effort: the row was never created, so nothing points at this
    // file — leaving it behind would only ever cost storage, but there's no
    // reason to.
    await supabase.storage.from("spotted-boards").remove([storagePath]).catch(() => {});
    return {
      error: rpcError.message.includes("last 24 hours")
        ? rpcError.message
        : "Unable to submit right now. Please try again.",
    };
  }

  revalidatePath("/");
  return { success: true };
}

// Every spotted board, full stop — this section is homepage-only, has no
// pagination or detail page, and the dataset is expected to stay small, so
// a single unfiltered read is enough; city/area narrowing happens
// client-side (SpottedBoardsSection), the same way HomeDiscovery filters an
// already-fetched property list by selectedCity rather than refetching.
export async function getSpottedBoards(): Promise<SpottedBoard[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("spotted_boards")
    .select("id, photo_storage_path, latitude, longitude, phone, city, area, created_at")
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    imageUrl: getSpottedBoardImageUrl(supabase, row.photo_storage_path),
    latitude: row.latitude,
    longitude: row.longitude,
    phone: row.phone,
    city: row.city,
    area: row.area,
    createdAt: row.created_at,
  }));
}
