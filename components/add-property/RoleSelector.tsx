"use client";

import type { SubmitterRole } from "@/lib/property-roles";

type RoleSelectorProps = {
  value: SubmitterRole | null;
  onChange: (role: SubmitterRole) => void;
};

// What the submitter says their relationship to the property is —
// self-declared, kept short and to the point, not a checklist of
// consequences. Whether reviewing/verification apply to a given role is
// explained where it's actually relevant later in the flow, not up front
// here.
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
    description: "List it for rent, with rent and deposit details.",
  },
  {
    role: "tenant",
    icon: "🔑",
    title: "I live or lived here",
    description: "Share the place you call home.",
  },
  {
    role: "helper",
    icon: "🤝",
    title: "I'm adding it for someone else",
    description: "Add it on their behalf.",
  },
];

export default function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <fieldset>
      <legend className="sr-only">What is your relationship to this property?</legend>

      {/* Same at-rest/hover/responsive treatment as the homepage's
          ListYourPropertySection cards (CLAUDE.md-documented visual
          language: accent border always visible on mobile since touch has
          no hover, transparent-until-hover on desktop; description hidden
          below `sm` for room) — plus a distinct selected state these
          homepage cards don't need, since these are real radio choices. */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {roleOptions.map((option) => {
          const isSelected = value === option.role;

          return (
            <label
              key={option.role}
              className={`flex cursor-pointer flex-col items-center rounded-xl border-2 p-4 text-center transition-all duration-200 sm:items-start sm:border sm:p-5 sm:text-left ${
                isSelected
                  ? "border-accent bg-accent/10 shadow-[0_10px_28px_-10px_rgba(14,143,94,0.55)]"
                  : "border-accent bg-surface shadow-[0_1px_2px_rgba(14,143,94,0.04)] hover:-translate-y-1 hover:shadow-[0_18px_45px_-20px_rgba(14,143,94,0.5)] sm:border-transparent sm:shadow-none sm:hover:border-accent/60"
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
                className={`mt-2 text-sm font-medium leading-tight sm:mt-3 sm:font-semibold sm:leading-normal ${
                  isSelected ? "text-accent-hover" : "text-foreground"
                }`}
              >
                {option.title}
              </span>

              <span className="mt-1.5 hidden text-sm leading-6 text-muted sm:block">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
