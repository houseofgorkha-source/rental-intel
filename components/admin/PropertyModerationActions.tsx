"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateProperty } from "@/app/actions/admin";

type Status = "pending" | "published" | "rejected";

// Both decisions are single-click rather than two-step, because both are
// reversible: whatever the current status, the other action stays available,
// so a mis-click is corrected by the button next to it rather than being
// unrecoverable. The safety that matters here is that the full submission is
// rendered above these buttons — the decision is made by reading, not by
// confirming twice.
export default function PropertyModerationActions({
  slug,
  status,
}: {
  slug: string;
  status: Status;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function decide(decision: "published" | "rejected") {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      formData.set("decision", decision);
      const result = await moderateProperty(formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => decide("published")}
          disabled={isPending || status === "published"}
          aria-busy={isPending}
          className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted disabled:hover:bg-surface-raised"
        >
          {status === "published" ? "Published" : "Publish"}
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={isPending || status === "rejected"}
          aria-busy={isPending}
          className="rounded-full border border-border-subtle bg-surface px-5 py-2.5 text-sm font-medium text-muted transition hover:border-red-300 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:border-border-subtle disabled:text-muted disabled:hover:border-border-subtle disabled:hover:text-muted"
        >
          {status === "rejected" ? "Not approved" : "Don't approve"}
        </button>
      </div>

      <p className="text-xs leading-5 text-muted">
        Publishing makes this property and its reviews visible to everyone. You
        can change this decision later — the other option stays available.
      </p>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
