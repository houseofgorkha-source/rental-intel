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
              className={`flex cursor-pointer flex-col rounded-2xl border p-5 transition ${
                isSelected
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-300"
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
                  isSelected ? "text-blue-700" : "text-gray-900"
                }`}
              >
                {option.title}
              </span>

              <span className="mt-2 text-sm leading-6 text-gray-600">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
