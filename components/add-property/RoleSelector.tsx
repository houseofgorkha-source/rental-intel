"use client";

import type { SubmitterRole } from "@/lib/property-roles";

type RoleSelectorProps = {
  value: SubmitterRole | null;
  onChange: (role: SubmitterRole) => void;
};

// What the submitter CLAIMS their relationship to the property is. This is
// provenance, not verified ownership -- nothing here is checked, and the
// property page presents it as an unverified claim. Each option states its
// own consequences up front so the choice is informed rather than guessed.
const roleOptions: {
  role: SubmitterRole;
  icon: string;
  title: string;
  description: string;
}[] = [
  {
    role: "owner",
    icon: "🏠",
    title: "I own this property",
    description:
      "List it for rent. You can add rent and deposit details and manage the listing later. Owners can't review their own property.",
  },
  {
    role: "tenant",
    icon: "🔑",
    title: "I live or lived here",
    description:
      "Share the place you call home. You can write a review and verify your stay.",
  },
  {
    role: "helper",
    icon: "🤝",
    title: "I'm adding it for someone else",
    description:
      "Add a property on someone's behalf. Reviews can only be written by someone who has lived there.",
  },
];

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">What is your relationship to this property?</legend>

      <div className="grid gap-3 md:grid-cols-3">
        {roleOptions.map((option) => {
          const isSelected = value === option.role;

          return (
            <label
              key={option.role}
              className={`flex cursor-pointer flex-col rounded-2xl border p-5 transition-all duration-200 ${
                isSelected
                  ? "border-accent bg-accent/10 shadow-[0_10px_28px_-10px_rgba(255,90,54,0.55)]"
                  : "border-border-subtle bg-surface hover:-translate-y-1 hover:border-accent/60 hover:shadow-[0_14px_32px_-14px_rgba(255,90,54,0.4)]"
              }`}
            >
              <input
                type="radio"
                name="submittedAs"
                value={option.role}
                checked={isSelected}
                onChange={() => onChange(option.role)}
                className="sr-only"
              />

              <span className="text-2xl" aria-hidden="true">
                {option.icon}
              </span>

              <span
                className={`mt-3 font-semibold ${
                  isSelected ? "text-accent-hover" : "text-foreground"
                }`}
              >
                {option.title}
              </span>

              <span className="mt-2 text-sm leading-6 text-muted">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
