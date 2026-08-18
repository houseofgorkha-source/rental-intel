"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { one } from "@/lib/embedded";
import {
  groupPropertyMessagesIntoThreads,
  groupSupportMessagesIntoThreads,
  type PropertyMessageRow,
  type SupportMessageRow,
  type MessageThread,
  type SupportThread,
} from "@/lib/messaging";

type SendMessageResult = {
  error?: string;
  success?: boolean;
};

// Shared by every send action below — the same length rule everywhere a
// human types into one of these boxes.
function validateMessageBody(body: string): string | null {
  if (body.length < 10) {
    return "Please write at least a sentence so they know what you're asking.";
  }
  if (body.length > 2000) {
    return "Please keep your message under 2000 characters.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Property messaging — the chat widget's property threads
// ---------------------------------------------------------------------------

// Start a conversation with a property's contributor. Only reachable when no
// conversation exists yet — see sendThreadMessage below for continuing one.
//
// Authorization is the `property_messages` INSERT policy
// (20260821000000's "first message" branch), which independently re-checks
// all three of: the sender is the caller, the recipient really is that
// property's creator, and the contributor actually chose 'message'. The
// lookups below mirror it so a refusal reads as a sentence instead of a
// silent zero-row insert.
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

  revalidatePath("/", "layout");
  return { success: true };
}

// Send a message inside a conversation that already exists — either
// participant, either direction, no cap. Authorization is the
// 20260821000000 "existing conversation" INSERT-policy branch: it requires a
// prior message between the same two people on the same property, checked
// here first so a stranger can't be cold-messaged through this path either.
export async function sendThreadMessage(
  formData: FormData,
): Promise<SendMessageResult> {
  const propertyId = String(formData.get("propertyId") ?? "");
  const otherParticipantId = String(formData.get("otherParticipantId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!propertyId || !otherParticipantId) return { error: "Missing message details." };
  const bodyError = validateMessageBody(body);
  if (bodyError) return { error: bodyError };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to reply.",
  );
  if (!user) return { error: authFailure };

  const { data: priorMessage } = await supabase
    .from("property_messages")
    .select("id")
    .eq("property_id", propertyId)
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${otherParticipantId}),and(sender_id.eq.${otherParticipantId},recipient_id.eq.${user.id})`,
    )
    .limit(1)
    .maybeSingle();

  if (!priorMessage) {
    return { error: "This conversation hasn't started yet." };
  }

  const { error } = await supabase.from("property_messages").insert({
    property_id: propertyId,
    sender_id: user.id,
    recipient_id: otherParticipantId,
    body,
  });

  if (error) {
    return { error: "Unable to send your message. Please try again." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// Every property-message thread the caller is part of, grouped for the
// widget's list + thread views. Returns an empty array rather than throwing
// when signed out, since the widget itself decides what to show a
// signed-out visitor.
export async function getMessageThreads(): Promise<MessageThread[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // No new policy needed: "Participants can read their own messages" already
  // scopes this to sender_id = auth.uid() or recipient_id = auth.uid().
  const { data } = await supabase
    .from("property_messages")
    .select(
      "id, property_id, sender_id, recipient_id, body, created_at, read_at, property:properties!property_messages_property_id_fkey(slug, name), sender:profiles!property_messages_sender_id_fkey(display_name)",
    )
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    property_id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    created_at: string;
    read_at: string | null;
    property: { slug: string; name: string } | { slug: string; name: string }[] | null;
    sender: { display_name: string } | { display_name: string }[] | null;
  };

  const rows: PropertyMessageRow[] = ((data ?? []) as Row[]).flatMap((row) => {
    const property = one(row.property);
    if (!property) return [];

    return [
      {
        id: row.id,
        propertyId: row.property_id,
        propertySlug: property.slug,
        propertyName: property.name,
        senderId: row.sender_id,
        senderName: one(row.sender)?.display_name ?? "RentalIntel member",
        recipientId: row.recipient_id,
        body: row.body,
        createdAt: row.created_at,
        readAt: row.read_at,
      },
    ];
  });

  return groupPropertyMessagesIntoThreads(rows, user.id);
}

// Marks one thread's incoming messages read — fired when the widget opens
// that thread, not on a page visit (there is no page anymore).
export async function markThreadRead(
  propertyId: string,
  otherParticipantId: string,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("property_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("property_id", propertyId)
    .eq("sender_id", otherParticipantId)
    .eq("recipient_id", user.id)
    .is("read_at", null);

  // The unread badge is computed in the root layout (app/layout.tsx), which
  // the App Router does not automatically re-fetch on a same-tree client
  // navigation. Without this, the database updates correctly but the badge
  // a viewer is looking at stays stale until an unrelated full reload.
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Support chat — one thread per user, any admin may answer
// ---------------------------------------------------------------------------

export async function sendSupportMessage(
  formData: FormData,
): Promise<SendMessageResult> {
  const body = String(formData.get("body") ?? "").trim();
  const bodyError = validateMessageBody(body);
  if (bodyError) return { error: bodyError };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to message support.",
  );
  if (!user) return { error: authFailure };

  const { error } = await supabase.from("support_messages").insert({
    user_id: user.id,
    sender_id: user.id,
    body,
  });

  if (error) {
    return { error: "Unable to send your message. Please try again." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// An administrator replying to a specific user's support thread. Reuses the
// same is_admin() gate every other admin write in this project relies on —
// there's no separate "support agent" role.
export async function sendSupportReply(
  formData: FormData,
): Promise<SendMessageResult> {
  const targetUserId = String(formData.get("userId") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!targetUserId) return { error: "Missing recipient." };
  const bodyError = validateMessageBody(body);
  if (bodyError) return { error: bodyError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to continue." };
  if (!(await isAdminUser(supabase, user.id))) {
    return { error: "You don't have access to support." };
  }

  const { error } = await supabase.from("support_messages").insert({
    user_id: targetUserId,
    sender_id: user.id,
    body,
  });

  if (error) {
    return { error: "Unable to send your reply. Please try again." };
  }

  revalidatePath("/admin/support");
  return { success: true };
}

// The caller's own support thread — empty array (not an error) if they've
// never messaged support.
export async function getSupportThread(): Promise<SupportMessageRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("support_messages")
    .select("id, user_id, sender_id, body, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: "You",
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));
}

// Marks support replies (sent by someone other than the caller) read in the
// caller's own thread — the user side of the support widget.
export async function markSupportThreadRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .neq("sender_id", user.id)
    .is("read_at", null);

  revalidatePath("/", "layout");
}

// Every support thread, for the admin inbox at /admin/support.
export async function getAllSupportThreads(): Promise<SupportThread[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(supabase, user.id))) return [];

  const { data } = await supabase
    .from("support_messages")
    .select(
      "id, user_id, sender_id, body, created_at, read_at, owner:profiles!support_messages_user_id_fkey(display_name)",
    )
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    user_id: string;
    sender_id: string;
    body: string;
    created_at: string;
    read_at: string | null;
    owner: { display_name: string } | { display_name: string }[] | null;
  };

  const rows: SupportMessageRow[] = ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    userId: row.user_id,
    userName: one(row.owner)?.display_name ?? "RentalIntel member",
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  }));

  return groupSupportMessagesIntoThreads(rows);
}

// Marks a specific user's thread read from the admin side — messages that
// user sent which no admin has read yet.
export async function markSupportThreadReadForUser(targetUserId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(supabase, user.id))) return;

  await supabase
    .from("support_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", targetUserId)
    .eq("sender_id", targetUserId)
    .is("read_at", null);

  revalidatePath("/admin/support");
}
