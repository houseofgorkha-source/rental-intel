"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePendingProperty } from "@/app/actions/property";

type PendingSubmissionActionsProps = {
  slug: string;
  name: string;
};

// Removing a submission is destructive and irreversible, so it is deliberately
// two-step rather than a single click sitting next to the harmless "View"
// link. The confirmation replaces the button in place — no modal, no
// window.confirm — so it stays keyboard-reachable and styleable, and the
// property's name is repeated so the user can see what they are removing.
export default function PendingSubmissionActions({
  slug,
  name,
}: PendingSubmissionActionsProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      const result = await deletePendingProperty(formData);

      if (result.error) {
        setError(result.error);
        setIsConfirming(false);
        return;
      }

      router.refresh();
    });
  }

  if (!isConfirming) {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 transition hover:text-red-700 hover:decoration-red-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
        >
          Remove
        </button>
        {error && (
          <p role="alert" className="max-w-xs text-xs leading-5 text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs leading-5 text-slate-600">
        Remove <span className="font-medium text-slate-900">{name}</span>? This
        can&apos;t be undone.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          disabled={isPending}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleRemove}
          disabled={isPending}
          aria-busy={isPending}
          className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:bg-red-300 disabled:hover:bg-red-300"
        >
          {isPending ? "Removing..." : "Yes, remove"}
        </button>
      </div>
    </div>
  );
}
