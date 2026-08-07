"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

type ModerationResult = { error?: string; success?: boolean };

// Moderation decisions.
//
// Authorization here is deliberately thin, because it is not what protects
// these operations. The database does:
//   * properties has a column-level grant of UPDATE (status) only, plus an
//     UPDATE policy gated on public.is_admin(). A non-admin's update matches
//     no policy and silently affects zero rows; any attempt to write a column
//     other than `status` is rejected outright by Postgres, for everyone.
//   * review_verifications is the same shape, scoped to its four decision
//     columns.
// The requireAdmin() calls below exist so the user gets an honest message
// instead of a silent no-op — remove them and these actions would still be
// unable to do anything on a non-admin's behalf.
//
// What each action validates itself is the *value*, not the permission: which
// target states a decision may move a record to. That is a product rule, not
// a security boundary, and it belongs here rather than in a CHECK constraint
// that would also bind the Dashboard operator.

const propertyDecisions = ["published", "rejected"] as const;
type PropertyDecision = (typeof propertyDecisions)[number];

export async function moderateProperty(formData: FormData): Promise<ModerationResult> {
  const slug = String(formData.get("slug") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (!slug) return { error: "Missing property." };
  if (!propertyDecisions.includes(decision as PropertyDecision)) {
    return { error: "Unknown moderation decision." };
  }

  const supabase = await createClient();
  const { error: authFailure } = await requireAdmin(supabase);
  if (authFailure) return { error: authFailure };

  const { data, error } = await supabase
    .from("properties")
    .update({ status: decision as PropertyDecision })
    .eq("slug", slug)
    .select("slug, status");

  if (error) {
    return { error: "Unable to update this property. Please try again." };
  }

  // RLS filters rather than errors when a row isn't updatable, so an empty
  // result means the policy refused it — not a transient failure.
  if (!data || data.length === 0) {
    return { error: "That property could not be updated." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/properties");
  revalidatePath(`/admin/properties/${slug}`);
  revalidatePath(`/property/${slug}`);
  revalidatePath("/property");
  revalidatePath("/");
  return { success: true };
}

const verificationDecisions = ["verified", "rejected"] as const;
type VerificationDecision = (typeof verificationDecisions)[number];

export async function moderateVerification(formData: FormData): Promise<ModerationResult> {
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const rejectionReason = String(formData.get("rejectionReason") ?? "").trim();

  if (!id) return { error: "Missing verification request." };
  if (!verificationDecisions.includes(decision as VerificationDecision)) {
    return { error: "Unknown moderation decision." };
  }

  // A rejection that says nothing leaves the contributor with no way to fix
  // it, and /account/verifications already renders this reason back to them.
  if (decision === "rejected" && !rejectionReason) {
    return { error: "Add a short reason so the contributor knows what to fix." };
  }

  const supabase = await createClient();
  const { user, error: authFailure } = await requireAdmin(supabase);
  if (authFailure) return { error: authFailure };

  // reviews.verification_status is NOT set here. The existing
  // review_verifications_sync_status trigger propagates this decision to the
  // linked review — the same path the Supabase Dashboard workflow has always
  // used. Administrators hold no UPDATE privilege on reviews at all.
  const { data, error } = await supabase
    .from("review_verifications")
    .update({
      status: decision as VerificationDecision,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      rejection_reason: decision === "rejected" ? rejectionReason : null,
    })
    .eq("id", id)
    .select("id, status");

  if (error) {
    return { error: "Unable to record this decision. Please try again." };
  }

  if (!data || data.length === 0) {
    return { error: "That verification request could not be updated." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/verifications");
  revalidatePath(`/admin/verifications/${id}`);
  return { success: true };
}
