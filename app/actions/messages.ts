"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type SendMessageResult = {
  error?: string;
  success?: boolean;
};

// Shared by sendPropertyMessage and replyToPropertyMessage — the same length
// rule either direction of a conversation. Returns an error string, not a
// thrown exception, so both callers can return it the same way they already
// return every other validation failure.
function validateMessageBody(body: string): string | null {
  if (body.length < 10) {
    return "Please write at least a sentence so they know what you're asking.";
  }
  if (body.length > 2000) {
    return "Please keep your message under 2000 characters.";
  }
  return null;
}

// Send one message to a property's contributor.
//
// Originally the whole of "Message here" was a single delivered message with
// no reply — see 20260810000000's comments. 20260811000000 added a narrow
// reply path (replyToPropertyMessage, below) once using the one-way version
// showed a contributor who cannot answer what they were asked is a worse
// outcome. There is still no thread view, no editing, and no deletion.
//
// Authorization is the `property_messages` INSERT policy (20260810000000,
// widened by 20260811000000), which independently re-checks all three of:
// the sender is the caller, the recipient really is that property's creator,
// and the contributor actually chose 'message'. The lookups below mirror it
// so a refusal reads as a sentence instead of a silent zero-row insert.
export async function sendPropertyMessage(
  formData: FormData,
): Promise<SendMessageResult> {
  const slug = String(formData.get("slug") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!slug) return { error: "Missing property." };
  const bodyError = validateMessageBody(body);
  if (bodyError) return { error: bodyError };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to contact this contributor.",
  );
  if (!user) return { error: authFailure };

  const { data: property } = await supabase
    .from("properties")
    .select("id, created_by, contact_method, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!property) return { error: "That property could not be found." };

  if (property.contact_method !== "message" || !property.created_by) {
    return { error: "This contributor isn't accepting messages here." };
  }

  if (property.created_by === user.id) {
    return { error: "This is your own property." };
  }

  const { error } = await supabase.from("property_messages").insert({
    property_id: property.id,
    sender_id: user.id,
    recipient_id: property.created_by,
    body,
  });

  if (error) {
    return { error: "Unable to send your message. Please try again." };
  }

  revalidatePath("/account/messages");
  return { success: true };
}

// Reply to a message received about one of the caller's own properties.
//
// Only reachable from a property's creator, and only to someone who has
// already messaged them about that specific property — the same two things
// the INSERT policy in 20260811000000 independently enforces. This is what
// keeps replying from becoming a way to cold-message a stranger: a creator
// can answer, but never initiate.
export async function replyToPropertyMessage(
  formData: FormData,
): Promise<SendMessageResult> {
  const propertyId = String(formData.get("propertyId") ?? "");
  const recipientId = String(formData.get("recipientId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!propertyId || !recipientId) return { error: "Missing message details." };
  const bodyError = validateMessageBody(body);
  if (bodyError) return { error: bodyError };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to reply.",
  );
  if (!user) return { error: authFailure };

  const { data: property } = await supabase
    .from("properties")
    .select("id, created_by")
    .eq("id", propertyId)
    .maybeSingle();

  if (!property || property.created_by !== user.id) {
    return { error: "You can only reply on your own property." };
  }

  const { data: priorMessage } = await supabase
    .from("property_messages")
    .select("id")
    .eq("property_id", propertyId)
    .eq("sender_id", recipientId)
    .eq("recipient_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!priorMessage) {
    return { error: "You can only reply to someone who has messaged you about this property." };
  }

  const { error } = await supabase.from("property_messages").insert({
    property_id: propertyId,
    sender_id: user.id,
    recipient_id: recipientId,
    body,
  });

  if (error) {
    return { error: "Unable to send your reply. Please try again." };
  }

  revalidatePath("/account/messages");
  return { success: true };
}

// Marks every message the caller has received as read. Called directly from
// the /account/messages Server Component on render — visiting the inbox is
// what "read" means here, the same as most inboxes, rather than a per-message
// action. Silently no-ops on failure: this is a housekeeping side effect, not
// something a viewer should see an error banner for just to read their inbox.
export async function markMessagesRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("property_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  // The unread badge is computed in the root layout (app/layout.tsx), which
  // the App Router does not automatically re-fetch on a same-tree client
  // navigation. Without this, the database updates correctly but the badge
  // a viewer is looking at stays stale until an unrelated full reload.
  revalidatePath("/", "layout");
}
