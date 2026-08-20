"use client";

import Link from "next/link";
import { OPEN_SUPPORT_CHAT_EVENT } from "@/components/shared/ChatWidget";

// No footer existed anywhere in the app before this — added specifically so
// Privacy/Terms/Contact are reachable from every page, not just linked to
// each other in a loop. Deliberately minimal: three links + a copyright
// line, not a sitemap of every route (DeveloperNavigationMenu already
// serves that purpose for development, see CLAUDE.md §24).
//
// The support prompt below was moved here from the homepage-only
// NeedSupportSection so it's reachable from every page, not just "/". Same
// event-dispatch pattern: no shared state with ChatWidget, just the same
// custom event it already listens for.
export default function Footer() {
  function handleChatClick() {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_CHAT_EVENT));
  }

  return (
    <footer className="border-t border-border-subtle bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 text-sm text-muted lg:px-8">
        <p className="text-center">
          Have a question we haven&apos;t answered?{" "}
          <button
            type="button"
            onClick={handleChatClick}
            className="font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
          >
            Chat with us
          </button>{" "}
          or{" "}
          <a
            href="tel:9606002439"
            className="font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
          >
            call us on 9606002439
          </a>
          .
        </p>
        <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} RentalIntel. Know it before you rent it.</p>
          <nav aria-label="Legal" className="flex items-center gap-5">
            <Link href="/privacy" className="transition hover:text-accent">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition hover:text-accent">
              Terms &amp; Conditions
            </Link>
            <Link href="/contact" className="transition hover:text-accent">
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
