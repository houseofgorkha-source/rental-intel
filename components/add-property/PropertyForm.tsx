"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createProperty } from "@/app/actions/property";
import InputField from "../shared/InputField";
import TextAreaField from "../shared/TextAreaField";
import SectionTitle from "./SectionTitle";
import InfoCard from "./InfoCard";
import Button from "../shared/Button";

export default function PropertyForm() {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmissionError(null);
    setIsSubmitting(true);

    const result = await createProperty(new FormData(event.currentTarget));

    if (result.error) {
      setSubmissionError(result.error);
      setIsSubmitting(false);
      return;
    }

    router.push(`/property/${result.slug}`);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">

      <div className="text-center">

        <div className="text-5xl">🏠</div>

        <h1 className="mt-5 text-3xl font-bold tracking-tight text-gray-900">
          Add a Property
        </h1>

        <p className="mt-3 text-gray-600">
          Help future tenants by adding a property that isn&apos;t yet listed on RentalIntel.
        </p>

      </div>

      <div className="mt-10">

        <InfoCard title="Before you begin">
          Every property submitted is manually reviewed before it is published.
          This helps prevent duplicate listings and keeps RentalIntel
          trustworthy.
        </InfoCard>

      </div>

      <form onSubmit={handleSubmit}>
        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

        <SectionTitle
          title="Property Details"
          description="Help us identify this property as accurately as possible."
        />

        <div className="space-y-6">

          <InputField
            label="Property / Society Name"
            placeholder="Prestige Lakeside Habitat"
            name="name"
            required
          />

          <InputField
            label="Address"
            placeholder="#31, C/o Anna PG, 27th Main Road"
            name="addressLine1"
            helperText="House number, building, street or anything that helps identify the property."
            required
          />

          <InputField
            label="Address Line 2"
            placeholder="Near Empire Restaurant, Opposite BDA Complex"
            name="addressLine2"
          />

          <InputField
            label="Area / Locality"
            placeholder="Ejipura"
            name="area"
            required
          />

          <div className="grid gap-6 md:grid-cols-2">

            <InputField
              label="City"
              placeholder="Bengaluru"
              name="city"
              required
            />

            <InputField
              label="State"
              placeholder="Karnataka"
              name="state"
              required
            />

          </div>

          <InputField
            label="PIN Code"
            placeholder="560095"
            name="postalCode"
          />

          <InputField
            label="Google Maps Link"
            placeholder="https://maps.google.com/..."
            name="mapsUrl"
            type="url"
            helperText="Optional for Version 1. Adding a Google Maps link helps us verify the property faster."
          />

          <TextAreaField
            label="Additional Notes"
            placeholder="Anything else that helps identify this property?"
            name="notes"
          />

          <InputField
            label="Property Images"
            placeholder=""
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            helperText="Optional. You can select multiple JPG, PNG, or WebP images."
          />

        </div>

        </div>

        {submissionError && (
          <p role="alert" className="mt-6 text-sm text-red-600">
            {submissionError}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={isSubmitting}
          className="mt-10"
        >
          {isSubmitting ? "Submitting..." : "Submit Property"}
        </Button>
      </form>

    </div>
  );
}
