import SupportInbox from "@/components/admin/SupportInbox";

export const dynamic = "force-dynamic";

// The admin side of the support channel added alongside the chat widget
// (20260821000000). Any administrator can read and answer any thread — see
// support_messages' RLS and sendSupportReply's own comment for why there's
// no separate "support agent" role.
export default function AdminSupportPage() {
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-2xl text-sm leading-6 text-muted">
        Users message support from the chat widget's "RentalIntel Support"
        entry. Replying here answers as whichever administrator sends it —
        there's no shared "support" identity.
      </p>
      <SupportInbox />
    </div>
  );
}
