"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deactivateBroker } from "@/app/actions/broker";

// The commercial on/off switch (deactivateBroker) — not a delete, and not a
// moderation action. Re-listing is just visiting /add-broker again, which
// upserts is_active back to true.
export default function BrokerListingActions() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleDeactivate() {
    setIsSubmitting(true);
    setError(null);
    const result = await deactivateBroker();
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDeactivate}
        disabled={isSubmitting}
        className="text-sm font-medium text-danger underline decoration-danger/40 underline-offset-4 transition hover:decoration-danger disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Removing from directory..." : "Remove from directory"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
