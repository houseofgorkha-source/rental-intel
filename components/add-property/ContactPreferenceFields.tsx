"use client";

import { useState } from "react";
import InputField from "../shared/InputField";
import type { ContactMethod } from "@/lib/property-attributes";

type ContactPreferenceFieldsProps = {
  defaultMethod?: ContactMethod;
  defaultPhone?: string | null;
  defaultEmail?: string | null;
};

const CONTACT_CHOICES = [
  {
    value: "phone",
    title: "Phone",
    description: "Signed-in renters can see and call the number you enter below.",
  },
  {
    value: "email",
    title: "Email",
    description: "Signed-in renters can see and email the address you enter below.",
  },
  {
    value: "message",
    title: "Message here",
    description:
      "Renters message you inside RentalIntel. Your phone and email stay private.",
  },
] as const satisfies readonly {
  value: ContactMethod;
  title: string;
  description: string;
}[];
// "none" ("No direct contact") is deliberately not offered as a choice any
// more — every property should be reachable somehow. It remains a valid,
// stored value: existing rows saved with it before this change still work
// exactly as before (ContactContributor.tsx already renders nothing for
// contact_method='none'), this only stops anyone from newly choosing it.

// How the contributor is willing to be reached, and the details for the
// channel they picked.
//
// The detail fields appear only for the channel selected, because asking for
// a phone number the product has just been told not to show is how a private
// number ends up stored for no reason. The server stores only the detail
// matching the chosen method, for the same reason.
export default function ContactPreferenceFields({
  defaultMethod = "message",
  defaultPhone = null,
  defaultEmail = null,
}: ContactPreferenceFieldsProps) {
  // "none" is no longer an offered choice (see CONTACT_CHOICES) — a property
  // saved with it before this change still lands here on edit, and needs a
  // real, visibly-selected starting point rather than showing no pill
  // selected at all.
  const [method, setMethod] = useState<ContactMethod>(
    defaultMethod === "none" ? "message" : defaultMethod,
  );

  const selectedChoice = CONTACT_CHOICES.find((choice) => choice.value === method);

  return (
    <div className="space-y-3">
      {/* One row of pill choices rather than four stacked cards — the detail
          that used to live under each card now shows once, below, for
          whichever one is currently selected, so no information is lost. */}
      <div className="flex flex-wrap gap-2">
        {CONTACT_CHOICES.map((choice) => {
          const isSelected = method === choice.value;
          return (
            <label
              key={choice.value}
              className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                isSelected
                  ? "bg-accent text-white"
                  : "border border-border-subtle bg-surface text-muted hover:bg-surface-raised"
              }`}
            >
              <input
                type="radio"
                name="contactMethod"
                value={choice.value}
                checked={isSelected}
                onChange={() => setMethod(choice.value)}
                className="sr-only"
              />
              {choice.title}
            </label>
          );
        })}
      </div>

      {selectedChoice && (
        <p className="text-sm text-muted">{selectedChoice.description}</p>
      )}

      {method === "phone" && (
        <InputField
          label="Phone Number"
          placeholder="+91 98765 43210"
          name="contactPhone"
          type="tel"
          defaultValue={defaultPhone ?? undefined}
          helperText="Only shown to signed-in RentalIntel users. Never shown publicly."
          required
        />
      )}

      {method === "email" && (
        <InputField
          label="Contact Email"
          placeholder="you@example.com"
          name="contactEmail"
          type="email"
          defaultValue={defaultEmail ?? undefined}
          helperText="Only shown to signed-in RentalIntel users. Never shown publicly."
          required
        />
      )}
      {/* Nothing else is collected for "message here" or "no direct contact"
          — the description above already covers both, and messages now
          arrive in the floating chat widget, not a dedicated page. */}
    </div>
  );
}
