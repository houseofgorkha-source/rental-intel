"use client";

import { useRouter } from "next/navigation";
import { OPEN_SUPPORT_CHAT_EVENT } from "@/components/shared/ChatWidget";

// The homepage's one entry point into support (CLAUDE.md's stated intent:
// linked from the homepage bottom, opening the same widget rather than a
// separate page). Deliberately not a Link — there is no /support route,
// only the widget, opened here via the same event the widget itself listens
// for so this component doesn't need to know anything about chat state.
export default function NeedSupportSection({ isSignedIn }: { isSignedIn: boolean }) {
  const router = useRouter();

  function handleClick() {
    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent("/")}`);
      return;
    }
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_CHAT_EVENT));
  }

  return (
    <section className="mt-16 border-t border-border-subtle pt-10 text-center">
      <p className="text-sm text-muted">
        Have a question we haven&apos;t answered?{" "}
        <button
          type="button"
          onClick={handleClick}
          className="font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
        >
          Need support?
        </button>
      </p>
    </section>
  );
}
