"use client";



import InputField from "./InputField";
import TextAreaField from "./TextAreaField";
import SectionTitle from "./SectionTitle";
import InfoCard from "./InfoCard";
import Button from "../shared/Button";

export default function PropertyForm() {
  

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

      <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

        <SectionTitle
          title="Property Details"
          description="Help us identify this property as accurately as possible."
        />

        <div className="space-y-6">

          <InputField
            label="Property / Society Name"
            placeholder="Prestige Lakeside Habitat"
            required
          />

          <InputField
            label="Address"
            placeholder="#31, C/o Anna PG, 27th Main Road"
            helperText="House number, building, street or anything that helps identify the property."
            required
          />

          <InputField
            label="Address Line 2"
            placeholder="Near Empire Restaurant, Opposite BDA Complex"
          />

          <InputField
            label="Area / Locality"
            placeholder="Ejipura"
            required
          />

          <div className="grid gap-6 md:grid-cols-2">

            <InputField
              label="City"
              placeholder="Bengaluru"
              required
            />

            <InputField
              label="State"
              placeholder="Karnataka"
              required
            />

          </div>

          <InputField
            label="PIN Code"
            placeholder="560095"
          />

          <InputField
            label="Google Maps Link"
            placeholder="https://maps.google.com/..."
            helperText="Optional for Version 1. Adding a Google Maps link helps us verify the property faster."
          />

          <TextAreaField
            label="Additional Notes"
            placeholder="Anything else that helps identify this property?"
          />

        </div>

      </div>

      <Button
  type="button"
  variant="primary"
  fullWidth
  className="mt-10"
>
  Submit Property
</Button>

    </div>
  );
}