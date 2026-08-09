import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markMessagesRead } from "@/app/actions/messages";
import { EmptyState, StatusPill } from "@/components/shared/StatusPrimitives";
import MessageReplyForm from "@/components/account/MessageReplyForm";
import { one } from "@/lib/embedded";

export const dynamic = "force-dynamic";

type MessageRow = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  sender_id: string;
  recipient_id: string;
  property_id: string;
  property:
    | { slug: string; name: string; created_by: string }
    | { slug: string; name: string; created_by: string }[]
    | null;
  sender: { display_name: string } | { display_name: string }[] | null;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// Where a "Message here" enquiry lands.
//
// A reply is possible (20260811000000) but there is still no thread view —
// each incoming message gets one inline reply box, not a running
// conversation. Both sides of a message are shown, so a renter can see what
// they sent as well as what they received.
export default async function AccountMessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/messages");

  // No new policy needed: "Participants can read their own messages" already
  // scopes this to sender_id = auth.uid() or recipient_id = auth.uid().
  const { data } = await supabase
    .from("property_messages")
    .select(
      "id, body, created_at, read_at, sender_id, recipient_id, property_id, property:properties!property_messages_property_id_fkey(slug, name, created_by), sender:profiles!property_messages_sender_id_fkey(display_name)",
    )
    .order("created_at", { ascending: false });

  const messages = (data ?? []) as MessageRow[];

  // Visiting the inbox is what "read" means here — see markMessagesRead's own
  // comment. Runs after the fetch above so this render still shows messages
  // with their true pre-visit read_at (the unread badge on the Account menu
  // is computed the same way, before this call, so the two never disagree).
  await markMessagesRead();

  if (messages.length === 0) {
    return (
      <EmptyState
        title="No messages yet."
        description="Renters can message you about a property when you choose “Message here” as your contact preference."
        actionHref="/account/properties"
        actionLabel="Manage my properties →"
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {messages.map((message) => {
        // `one()` because PostgREST returns a many-to-one embed as an object —
        // indexing it as an array is how this project has silently mislabelled
        // embedded rows before. See lib/embedded.ts.
        const property = one(message.property);
        const isIncoming = message.recipient_id === user.id;

        return (
          <li
            key={message.id}
            className="rounded-2xl border border-border-subtle bg-surface p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusPill tone={isIncoming ? "success" : "neutral"}>
                {isIncoming ? "Received" : "Sent"}
              </StatusPill>
              <span className="text-xs text-muted">
                {formatDate(message.created_at)}
              </span>
            </div>

            {property && (
              <p className="mt-3 text-sm font-medium text-foreground">
                <Link
                  href={`/property/${property.slug}`}
                  className="underline decoration-border-subtle underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
                >
                  {property.name}
                </Link>
              </p>
            )}

            {isIncoming && (
              <p className="mt-1 text-xs text-muted">
                From {one(message.sender)?.display_name ?? "a RentalIntel member"}
              </p>
            )}

            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">
              {message.body}
            </p>

            {/* Reply is one-directional by design (20260811000000): only a
                property's creator may use replyToPropertyMessage. An
                "incoming" row here can also be the creator's own past reply
                landing back in a renter's inbox — for that row `isIncoming`
                is true but the viewer is not the creator, and offering Reply
                there would render a button that always fails server-side. */}
            {isIncoming && property?.created_by === user.id && (
              <MessageReplyForm
                propertyId={message.property_id}
                recipientId={message.sender_id}
                recipientLabel={one(message.sender)?.display_name ?? "this sender"}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
