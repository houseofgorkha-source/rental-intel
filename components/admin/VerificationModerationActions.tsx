"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateVerification } from "@/app/actions/admin";

type Status = "pending" | "verified" | "rejected";

// Rejecting requires a reason, because the contributor reads it back on
// /account/verifications and "rejected" with no explanation gives them
// nothing to act on. The textarea therefore only appears once the moderator
// has chosen to reject — asking for a reason before the decision would
// suggest one.
export default function VerificationModerationActions({
  id,
  status,
}: {
  id: string;
  status: Status;
}) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function decide(decision: "verified" | "rejected") {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("decision", decision);
      if (decision === "rejected") formData.set("rejectionReason", reason);

      const result = await moderateVerification(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setIsRejecting(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => decide("verified")}
          disabled={isPending || status === "verified"}
          aria-busy={isPending}
          className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200"
        >
          {status === "verified" ? "Stay verified" : "Verify this stay"}
        </button>
        <button
          type="button"
          onClick={() => setIsRejecting((open) => !open)}
          disabled={isPending}
          aria-expanded={isRejecting}
          className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-red-300 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "rejected" ? "Rejected — change reason" : "Don't verify"}
        </button>
      </div>

      {isRejecting && (
        <div className="flex max-w-xl flex-col gap-2">
          <label htmlFor="rejection-reason" className="text-sm font-medium text-slate-700">
            What should the contributor fix?
          </label>
          <textarea
            id="rejection-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="The rent receipt doesn't show the property address. Please upload one that does."
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <div>
            <button
              type="button"
              onClick={() => decide("rejected")}
              disabled={isPending}
              aria-busy={isPending}
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:bg-red-300 disabled:hover:bg-red-300"
            >
              {isPending ? "Saving…" : "Send this decision"}
            </button>
          </div>
        </div>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Verifying marks the linked review as written by someone who proved they
        stayed here. The review itself is never changed either way.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
