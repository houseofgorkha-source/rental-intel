"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createProperty } from "@/app/actions/property";
import InputField from "../shared/InputField";
import TextAreaField from "../shared/TextAreaField";
import SectionTitle from "./SectionTitle";
import InfoCard from "./InfoCard";
import RoleSelector from "./RoleSelector";
import type { SubmitterRole } from "@/lib/property-roles";
import Button from "../shared/Button";
import UseMyLocationButton from "../shared/UseMyLocationButton";
import { findNearestArea, findNearestCity, type Coordinates } from "@/lib/area-coordinates";

const maxFileSize = 5 * 1024 * 1024;
const maxFileCount = 5;
const maxTotalSize = 20 * 1024 * 1024;
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];

function getImageError(files: File[]) {
  if (files.length > maxFileCount) return "You can upload up to 5 images.";
  if (files.some((file) => !allowedImageTypes.includes(file.type) || file.size > maxFileSize)) return "Images must be JPG, PNG, or WebP files up to 5 MB each.";
  if (files.reduce((total, file) => total + file.size, 0) > maxTotalSize) return "Total image upload size must be 20 MB or less.";
  return null;
}

type PropertyFormProps = {
  // Seeded from /add-property?as=... when the user arrived via one of the
  // homepage "List Your Property" entry points. Always re-shown as a
  // selection they can change, never hidden.
  initialRole?: SubmitterRole | null;
};

export default function PropertyForm({ initialRole = null }: PropertyFormProps) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState<SubmitterRole | null>(initialRole);
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const router = useRouter();

  // Suggests city/area from the user's location — never stores the
  // coordinates themselves; only the resulting text values, which the user
  // can still edit before submitting. Reuses the same nearest-city/area
  // lookup the homepage's location button uses, not a separate lookup.
  function handleLocated(coordinates: Coordinates) {
    const nearestCity = findNearestCity(coordinates);
    if (nearestCity) setCity(nearestCity);
    const nearestArea = nearestCity ? findNearestArea(coordinates, nearestCity) : null;
    if (nearestArea) setArea(nearestArea);
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const imageError = getImageError(Array.from(new FormData(event.currentTarget).getAll("images")).filter((value): value is File => value instanceof File && value.size > 0));
    if (imageError) {
      setSubmissionError(imageError);
      return;
    }
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      const result = await createProperty(new FormData(event.currentTarget));
      if (result.error) {
        setSubmissionError(result.error);
        return;
      }
      router.push(`/property/${result.slug}`);
    } catch {
      setSubmissionError("Unable to submit your property. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
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
            title="What's your relationship to this property?"
            description="This tells renters where the information came from. We show it as an unverified claim."
          />

          <RoleSelector value={role} onChange={setRole} />

        </div>

        {role && (
        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

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

          <UseMyLocationButton onLocated={handleLocated} compact />

          <InputField
            label="Area / Locality"
            placeholder="Ejipura"
            name="area"
            value={area}
            onChange={(event) => setArea(event.target.value)}
            required
          />

          <div className="grid gap-6 md:grid-cols-2">

            <InputField
              label="City"
              placeholder="Bengaluru"
              name="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
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
            onChange={(event) => {
              const imageError = getImageError(Array.from(event.target.files ?? []));
              setSubmissionError(imageError);
              if (imageError) event.target.value = "";
            }}
            helperText="Optional. You can select multiple JPG, PNG, or WebP images."
          />

        </div>

        </div>
        )}

        {/* Listing details are an owner's commercial offer, so they're only
            collected from owners. What a tenant actually paid is a different
            fact and belongs on their review, not on the property. */}
        {role === "owner" && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">

            <SectionTitle
              title="Listing Details"
              description="What you're asking for this property. You can change these any time from your account."
            />

            <div className="space-y-6">

              <div className="grid gap-6 md:grid-cols-2">

                <InputField
                  label="Monthly Rent (₹)"
                  placeholder="28000"
                  name="askingRent"
                  type="number"
                  min="0"
                  step="500"
                />

                <InputField
                  label="Security Deposit (₹)"
                  placeholder="150000"
                  name="securityDeposit"
                  type="number"
                  min="0"
                  step="1000"
                />

              </div>

              {/* Deliberately unchecked by default: advertising a property as
                  available is a claim the owner must opt into, not something
                  they opt out of. An unnoticed pre-ticked box would badge
                  occupied properties as vacant. */}
              <label className="flex items-center gap-2 text-gray-700">
                <input
                  type="checkbox"
                  name="isAvailable"
                  className="accent-blue-600"
                />
                This property is currently available to rent
              </label>

            </div>

          </div>
        )}

        {submissionError && (
          <p role="alert" className="mt-6 text-sm text-red-600">
            {submissionError}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          fullWidth
          disabled={isSubmitting || !role}
          className="mt-10"
        >
          {isSubmitting ? "Submitting..." : "Submit Property"}
        </Button>
      </form>

    </div>
  );
}
