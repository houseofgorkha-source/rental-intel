"use client";

import Link from "next/link";
import { OPEN_SUPPORT_CHAT_EVENT } from "@/components/shared/ChatWidget";

// Reuses the same two real support channels the global Footer's support
// prompt already points to, rather than inventing a third
// (e.g. a contact form nothing reads, or an email address that doesn't
// exist yet) — see CLAUDE.md §26 for why the chat widget is the one
// messaging surface in this app.
export default function ContactPage() {
  function handleChatClick() {
    window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_CHAT_EVENT));
  }

  return (
    <main className="min-h-screen bg-background pb-20 pt-28">
      <div className="mx-auto max-w-2xl px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Get in touch</p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.035em] text-foreground sm:text-4xl">
          Contact us
        </h1>
        <p className="mt-4 text-sm leading-6 text-muted sm:text-base">
          Have a question, found something wrong on a property page, or want to report a fake
          review or listing? Reach us either way below.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleChatClick}
            className="flex flex-col items-start gap-2 rounded-2xl border border-border-subtle bg-surface p-6 text-left transition hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_18px_45px_-20px_rgba(14,143,94,0.5)]"
          >
            <span className="text-2xl" aria-hidden="true">💬</span>
            <span className="font-medium text-foreground">Chat with us</span>
            <span className="text-sm text-muted">
              Opens the support chat right here. We typically reply within a day.
            </span>
          </button>

          <a
            href="tel:9606002439"
            className="flex flex-col items-start gap-2 rounded-2xl border border-border-subtle bg-surface p-6 text-left transition hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_18px_45px_-20px_rgba(14,143,94,0.5)]"
          >
            <span className="text-2xl" aria-hidden="true">📞</span>
            <span className="font-medium text-foreground">Call us</span>
            <span className="text-sm text-muted">9606002439</span>
          </a>
        </div>

        <p className="mt-10 text-sm text-muted">
          Looking for our{" "}
          <Link href="/privacy" className="font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover hover:decoration-accent">
            Privacy Policy
          </Link>{" "}
          or{" "}
          <Link href="/terms" className="font-medium text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover hover:decoration-accent">
            Terms &amp; Conditions
          </Link>
          ?
        </p>
      </div>
    </main>
  );
}
