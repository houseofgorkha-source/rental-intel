"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sendPropertyMessage } from "@/app/actions/messages";
import type { ContactMethod } from "@/lib/property-attributes";

type ContactContributorProps = {
  slug: string;
  contactMethod: ContactMethod;
  submittedAs: "owner" | "tenant" | "helper" | null;
  isSignedIn: boolean;
  // Resolved server-side, and only ever for a signed-in viewer — the page does
  // not query property_contacts at all for a signed-out visitor, and RLS
  // would refuse it if it did. So there is no path by which a number reaches
  // the browser of somebody who hasn't signed in.
  phone?: string | null;
  email?: string | null;
  // The contributor viewing their own property. They already know how to
  // reach themselves, and the database refuses a self-message.
  isOwnContribution?: boolean;
};

// One action, four outcomes, decided by what the contributor chose at
// registration:
//   phone   -> reveal and dial the number they gave
//   email   -> reveal and open a mail to the address they gave
//   message -> a short note delivered inside RentalIntel
//   none    -> nothing at all is rendered
//
// A signed-out visitor sees the action and is sent to log in, because contact
// details are gated on having an account — that is a database rule here, not a
// UI convention.
export default function ContactContributor({
  slug,
  contactMethod,
  submittedAs,
  isSignedIn,
  phone = null,
  email = null,
  isOwnContribution = false,
}: ContactContributorProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (contactMethod === "none" || isOwnContribution) return null;

  // "Contact owner" only when somebody claimed to be one. For a tenant or
  // community contribution the honest label is what they are, and calling
  // them an owner would assert a relationship to the property that was never
  // claimed.
  const label = submittedAs === "owner" ? "Contact owner" : "Contact contributor";

  function handleGuestClick() {
    const next = encodeURIComponent(`/property/${slug}`);
    router.push(`/login?next=${next}`);
  }

  function handleSend() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      formData.set("body", body);
      const result = await sendPropertyMessage(formData);

      if (result.error) {
        setError(result.error);
        return;
      }
      setIsSent(true);
      setBody("");
    });
  }

  const buttonClass =
    "inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-medium text-white transition hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-border-subtle disabled:cursor-not-allowed disabled:bg-muted";

  if (!isSignedIn) {
    return (
      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={handleGuestClick} className={buttonClass}>
          {label}
        </button>
        <p className="text-xs leading-5 text-muted">
          Sign in to see how this contributor prefers to be contacted.
        </p>
      </div>
    );
  }

  if (contactMethod === "phone") {
    return (
      <div className="flex flex-col gap-1.5">
        {isRevealed && phone ? (
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className={buttonClass}>
            {phone}
          </a>
        ) : (
          <button type="button" onClick={() => setIsRevealed(true)} className={buttonClass}>
            {label}
          </button>
        )}
        <p className="text-xs leading-5 text-muted">
          {isRevealed && phone
            ? "Shared by the contributor. Please be considerate about when you call."
            : "Shows a phone number the contributor chose to share."}
        </p>
      </div>
    );
  }

  if (contactMethod === "email") {
    return (
      <div className="flex flex-col gap-1.5">
        {isRevealed && email ? (
          <a href={`mailto:${email}`} className={`${buttonClass} break-all`}>
            {email}
          </a>
        ) : (
          <button type="button" onClick={() => setIsRevealed(true)} className={buttonClass}>
            {label}
          </button>
        )}
        <p className="text-xs leading-5 text-muted">
          {isRevealed && email
            ? "Shared by the contributor."
            : "Shows an email address the contributor chose to share."}
        </p>
      </div>
    );
  }

  if (isSent) {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
          Message sent. Their reply will come from them directly.
        </p>
        <p className="text-xs leading-5 text-muted">
          You can find this under{" "}
          <Link
            href="/account/messages"
            prefetch={false}
            className="font-medium text-accent-hover underline decoration-accent/50 underline-offset-4 hover:text-accent-hover"
          >
            Account → Messages
          </Link>{" "}
          any time.
        </p>
        <button type="button" onClick={() => setIsSent(false)} className={buttonClass}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {!isRevealed ? (
        <button type="button" onClick={() => setIsRevealed(true)} className={buttonClass}>
          {label}
        </button>
      ) : (
        <>
          <label htmlFor="contact-message" className="text-xs font-medium text-muted">
            Your message
          </label>
          <textarea
            id="contact-message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Is the property still available? I'd like to know about the deposit terms."
            className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isPending || body.trim().length < 10}
            aria-busy={isPending}
            className={buttonClass}
          >
            {isPending ? "Sending..." : "Send message"}
          </button>
          <p className="text-xs leading-5 text-muted">
            Sent inside RentalIntel. Your email address isn&apos;t shared.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="text-xs leading-5 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
