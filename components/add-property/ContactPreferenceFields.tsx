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
  {
    value: "none",
    title: "No direct contact",
    description: "No contact option is shown. Your property is still fully visible.",
  },
] as const satisfies readonly {
  value: ContactMethod;
  title: string;
  description: string;
}[];

// Exhaustiveness guard: adding a value to the property_contact_method enum
// without giving it a choice above becomes a type error here, rather than a
// method that exists in the database and can never be selected.
const _everyMethodHasAChoice: (typeof CONTACT_CHOICES)[number]["value"] =
  null as unknown as ContactMethod;
void _everyMethodHasAChoice;

// How the contributor is willing to be reached, and the details for the
// channel they picked.
//
// The detail fields appear only for the channel selected, because asking for
// a phone number the product has just been told not to show is how a private
// number ends up stored for no reason. The server stores only the detail
// matching the chosen method, for the same reason.
export default function ContactPreferenceFields({
  defaultMethod = "none",
  defaultPhone = null,
  defaultEmail = null,
}: ContactPreferenceFieldsProps) {
  const [method, setMethod] = useState<ContactMethod>(defaultMethod);

  return (
    <div className="space-y-6">
      <div className="grid gap-3">
        {CONTACT_CHOICES.map((choice) => {
          const isSelected = method === choice.value;
          return (
            <label
              key={choice.value}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                isSelected
                  ? "border-accent bg-accent/10/60"
                  : "border-border-subtle bg-surface hover:border-muted"
              }`}
            >
              <input
                type="radio"
                name="contactMethod"
                value={choice.value}
                checked={isSelected}
                onChange={() => setMethod(choice.value)}
                className="mt-1 accent-blue-600"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">
                  {choice.title}
                </span>
                <span className="mt-1 block text-sm text-muted">
                  {choice.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>

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

      {/* Nothing is collected for "message here" — the sender's account is the
          address, so there is no detail to store. */}
      {method === "message" && (
        <p className="rounded-xl border border-border-subtle bg-surface-raised p-4 text-sm text-muted">
          Messages arrive in your account under{" "}
          <span className="font-medium text-foreground">Messages</span>. Nothing else
          about you is shared.
        </p>
      )}
    </div>
  );
}
