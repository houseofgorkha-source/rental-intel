"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { normalizeCityName } from "@/lib/cities";
import { isContactMethod, type ContactMethod } from "@/lib/property-attributes";

type BrokerActionResult = {
  error?: string;
  success?: boolean;
};

function getTextValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Re-validated against the contact-method allow-list rather than trusted —
// same pattern app/actions/property.ts already uses for the same field.
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

function getAreas(formData: FormData): string[] {
  return formData
    .getAll("areas")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim());
}

// Registers the signed-in user as a broker, or amends their existing
// listing — `brokers.created_by` is unique, so this is create-or-update
// rather than create-only, mirroring how a profile row works (one per
// account), not how property submissions work (many per account).
export async function registerBroker(formData: FormData): Promise<BrokerActionResult> {
  const name = getTextValue(formData, "name");
  const rawCity = getTextValue(formData, "city");

  if (!name || !rawCity) {
    return { error: "Please provide your name and city." };
  }

  const city = normalizeCityName(rawCity);
  if (!city) {
    return { error: "Please provide your name and city." };
  }

  const areas = getAreas(formData);
  const contact = getContactPreference(formData);
  if (contact.error) return { error: contact.error };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to register as a broker.",
  );
  if (!user) return { error: authFailure };

  const { data: broker, error: brokerError } = await supabase
    .from("brokers")
    .upsert(
      {
        created_by: user.id,
        name,
        agency_name: getTextValue(formData, "agencyName") || null,
        city,
        areas,
        bio: getTextValue(formData, "bio") || null,
        contact_method: contact.method,
        is_active: true,
      },
      { onConflict: "created_by" },
    )
    .select("id")
    .single();

  if (brokerError || !broker) {
    return { error: "Unable to save your broker listing. Please try again." };
  }

  // Same "downgrade rather than lose the whole submission" behavior
  // createProperty already uses for property_contacts: a contact-detail
  // failure shouldn't cost the broker their listing.
  if (contact.phone || contact.email) {
    const { error: contactError } = await supabase
      .from("broker_contacts")
      .upsert(
        { broker_id: broker.id, phone: contact.phone, email: contact.email },
        { onConflict: "broker_id" },
      );

    if (contactError) {
      await supabase.from("brokers").update({ contact_method: "none" }).eq("id", broker.id);
    }
  } else {
    // Switching to "message"/"none" withdraws consent to show a stored
    // number/address — same behavior updateProperty already uses.
    await supabase.from("broker_contacts").delete().eq("broker_id", broker.id);
  }

  revalidatePath("/brokers");
  revalidatePath("/account/brokers");
  return { success: true };
}

// A broker taking their own listing down — the commercial toggle, not a
// moderation action. Reversible: registerBroker sets is_active back to true.
export async function deactivateBroker(): Promise<BrokerActionResult> {
  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to manage your broker listing.",
  );
  if (!user) return { error: authFailure };

  const { error } = await supabase
    .from("brokers")
    .update({ is_active: false })
    .eq("created_by", user.id);

  if (error) return { error: "Unable to update your listing. Please try again." };

  revalidatePath("/brokers");
  revalidatePath("/account/brokers");
  return { success: true };
}
