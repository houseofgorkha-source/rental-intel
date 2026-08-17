"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { registerBroker } from "@/app/actions/broker";
import InputField from "@/components/shared/InputField";
import TextAreaField from "@/components/shared/TextAreaField";
import Button from "@/components/shared/Button";
import AreaMultiSelect from "@/components/property/AreaMultiSelect";
import { DEFAULT_CITY, LOCALITIES_BY_CITY } from "@/lib/cities";
import type { ContactMethod } from "@/lib/property-attributes";

// Deliberately NOT the same ContactPreferenceFields properties/reviews use:
// that component's "message" option reads "Messages arrive in your account
// under Messages" — true for a property (property_messages is keyed to a
// property_id), not true for a broker (no broker-messaging table exists).
// Rather than reuse copy that would be wrong here, a broker only ever
// chooses phone, email, or neither — no half-built "message" promise.
const BROKER_CONTACT_CHOICES = [
  { value: "phone", title: "Phone", description: "Visible to anyone browsing the directory." },
  { value: "email", title: "Email", description: "Visible to anyone browsing the directory." },
  { value: "none", title: "No direct contact", description: "Your listing is still visible, just not contactable yet." },
] as const satisfies readonly { value: ContactMethod; title: string; description: string }[];

export type ExistingBroker = {
  name: string;
  agencyName: string | null;
  city: string;
  areas: string[];
  bio: string | null;
  contactMethod: ContactMethod;
  contactPhone: string | null;
  contactEmail: string | null;
};

type BrokerFormProps = {
  existingBroker?: ExistingBroker;
};

// One form for both registering and amending a listing — registerBroker
// itself is an upsert keyed on the unique created_by column (one broker
// profile per account, not many the way property submissions are), so
// there's no separate update action to branch to.
export default function BrokerForm({ existingBroker }: BrokerFormProps) {
  const isEditing = Boolean(existingBroker);
  const [city, setCity] = useState(existingBroker?.city ?? DEFAULT_CITY);
  const [areas, setAreas] = useState<string[]>(existingBroker?.areas ?? []);
  const [contactMethod, setContactMethod] = useState<ContactMethod>(
    existingBroker?.contactMethod ?? "none",
  );
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      const result = await registerBroker(new FormData(event.currentTarget));
      if (result.error) {
        setSubmissionError(result.error);
        return;
      }
      router.push("/account/brokers");
      router.refresh();
    } catch {
      setSubmissionError("Unable to save your broker listing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">About you</h2>
        <div className="mt-6 space-y-6">
          <InputField
            label="Your Name"
            placeholder="Anita Rao"
            name="name"
            defaultValue={existingBroker?.name}
            required
          />
          <InputField
            label="Agency Name"
            placeholder="Rao Realty (optional)"
            name="agencyName"
            defaultValue={existingBroker?.agencyName ?? undefined}
          />
          <InputField
            label="City"
            placeholder="Bengaluru"
            name="city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            required
          />
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              Areas you work in
            </label>
            <AreaMultiSelect
              areas={LOCALITIES_BY_CITY[city] ?? []}
              value={areas}
              onChange={setAreas}
            />
            {areas.map((area) => (
              <input key={area} type="hidden" name="areas" value={area} />
            ))}
          </div>
          <TextAreaField
            label="About your services"
            placeholder="What you help renters with, how long you've been active in these areas..."
            name="bio"
            defaultValue={existingBroker?.bio ?? undefined}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">
          How should renters reach you?
        </h2>
        {/* Unlike a property owner's contact preference, a broker listing is
            fully public — anyone visiting the directory can see whatever
            detail is chosen below, signed in or not. That's the point of a
            directory: being reachable. */}
        <p className="mt-1 text-sm text-muted">
          Whatever you choose here is visible to anyone browsing the broker
          directory, not only signed-in users.
        </p>
        <div className="mt-6 space-y-6">
          <div className="grid gap-3">
            {BROKER_CONTACT_CHOICES.map((choice) => {
              const isSelected = contactMethod === choice.value;
              return (
                <label
                  key={choice.value}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-border-subtle bg-surface hover:border-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="contactMethod"
                    value={choice.value}
                    checked={isSelected}
                    onChange={() => setContactMethod(choice.value)}
                    className="mt-1 accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">
                      {choice.title}
                    </span>
                    <span className="mt-1 block text-sm text-muted">{choice.description}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {contactMethod === "phone" && (
            <InputField
              label="Phone Number"
              placeholder="+91 98765 43210"
              name="contactPhone"
              type="tel"
              defaultValue={existingBroker?.contactPhone ?? undefined}
              required
            />
          )}

          {contactMethod === "email" && (
            <InputField
              label="Contact Email"
              placeholder="you@example.com"
              name="contactEmail"
              type="email"
              defaultValue={existingBroker?.contactEmail ?? undefined}
              required
            />
          )}
        </div>
      </section>

      {submissionError && (
        <p role="alert" className="text-sm text-danger">
          {submissionError}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "List Yourself as a Broker"}
      </Button>
    </form>
  );
}
