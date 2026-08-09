"use client";

import { useState, useTransition } from "react";
import { replyToPropertyMessage } from "@/app/actions/messages";

type MessageReplyFormProps = {
  propertyId: string;
  recipientId: string;
  recipientLabel: string;
};

// The reply half of a property message, shown inline under an incoming
// message in /account/messages. Deliberately not a full thread view — one
// box, one send, matching the same "smallest coherent mechanism" the
// original compose form (ContactContributor) uses.
export default function MessageReplyForm({
  propertyId,
  recipientId,
  recipientLabel,
}: MessageReplyFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isSent) {
    return (
      <p className="mt-3 text-xs font-medium text-success">
        Reply sent to {recipientLabel}.
      </p>
    );
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-3 text-xs font-medium text-accent-hover underline decoration-accent/50 underline-offset-4 hover:text-accent-hover"
      >
        Reply
      </button>
    );
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("propertyId", propertyId);
      formData.set("recipientId", recipientId);
      formData.set("body", body);
      const result = await replyToPropertyMessage(formData);

      if (result.error) {
        setError(result.error);
        return;
      }
      setIsSent(true);
      setBody("");
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={`Reply to ${recipientLabel}...`}
        className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={isPending || body.trim().length < 10}
          aria-busy={isPending}
          className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-xs font-medium text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-subtle disabled:cursor-not-allowed disabled:bg-muted"
        >
          {isPending ? "Sending..." : "Send reply"}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs font-medium text-muted hover:text-muted"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs leading-5 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
