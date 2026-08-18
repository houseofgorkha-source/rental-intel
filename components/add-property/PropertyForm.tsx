"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createProperty } from "@/app/actions/property";
import InputField from "../shared/InputField";
import SectionTitle from "./SectionTitle";
import InfoCard from "./InfoCard";
import RoleSelector from "./RoleSelector";
import PropertyAttributeFields from "./PropertyAttributeFields";
import ContactPreferenceFields from "./ContactPreferenceFields";
import PropertyLocationField from "./PropertyLocationField";
import type { SubmitterRole } from "@/lib/property-roles";
import Button from "../shared/Button";
import UseMyLocationButton from "../shared/UseMyLocationButton";
import {
  findNearestArea,
  findNearestCity,
  getAreaCoordinates,
  getCityCoordinates,
  type Coordinates,
} from "@/lib/area-coordinates";

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
  // From /add-property?intent=review (the /review page's "can't find your
  // property" fallback): send a successful submission straight to its
  // review form instead of the property page. Only applied when the
  // submitted role can actually review — an owner submission still lands on
  // the property page, since an owner reviewing their own listing is
  // blocked server-side anyway (see /property/[slug]/review's own check).
  redirectToReviewAfterSubmit?: boolean;
};

export default function PropertyForm({
  initialRole = null,
  redirectToReviewAfterSubmit = false,
}: PropertyFormProps) {
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [role, setRole] = useState<SubmitterRole | null>(initialRole);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [locationResult, setLocationResult] = useState<string | null>(null);
  const router = useRouter();

  // addressLine1/addressLine2 gain an onChange below purely to track their
  // live value for PropertyLocationField's auto-locate step — they stay
  // uncontrolled inputs (no `value` prop), so form submission is unaffected.

  // Suggests city/area from the user's location — never stores the
  // coordinates themselves; only the resulting text values, which the user
  // can still edit before submitting. Reuses the same nearest-city/area
  // lookup the homepage's location button uses, not a separate lookup.
  //
  // Permission-denied, unsupported-browser and lookup-failure states are all
  // handled inside UseMyLocationButton. What it cannot know is whether the
  // coordinates it returned actually matched anywhere we cover, so that
  // outcome is reported here — silently filling in nothing looked identical
  // to the button not working.
  function handleLocated(coordinates: Coordinates) {
    const nearestCity = findNearestCity(coordinates);
    const nearestArea = nearestCity ? findNearestArea(coordinates, nearestCity) : null;

    if (!nearestCity) {
      setLocationResult(
        "We couldn't match your location to a city we cover yet. Please fill in the address below.",
      );
      return;
    }

    setCity(nearestCity);
    if (nearestArea) setArea(nearestArea);
    setLocationResult(
      nearestArea
        ? `Filled in ${nearestArea}, ${nearestCity}. Change either one if that's not right.`
        : `Filled in ${nearestCity}. Add your area below.`,
    );
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
      const goToReview = redirectToReviewAfterSubmit && role !== "owner";
      router.push(goToReview ? `/property/${result.slug}/review` : `/property/${result.slug}`);
    } catch {
      setSubmissionError("Unable to submit your property. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // `pt-28`, not `py-12` — matches the header-clearance convention every
    // other page uses (account/admin/property-detail/review); `py-12`
    // (48px) wasn't enough to clear the absolutely-positioned header, so
    // this heading sat right underneath — and often touching — the logo.
    // `px-4` (was `px-6`) on mobile widens the form's usable width; sm:px-6
    // unchanged.
    <div className="mx-auto max-w-2xl px-4 pb-12 pt-28 sm:px-6">

      <div className="text-center">

        {/* Same fix as AuthHeader.tsx: this standalone 🏠 emoji predates the
            site having a real header logo and now sits close enough to the
            persistent global header's own Logo to overlap/duplicate it. */}
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Add a Property
        </h1>

        <p className="mt-3 text-muted">
          Help future tenants by adding a property that isn&apos;t yet listed on RentalIntel.
        </p>

      </div>

      <div className="mt-6">

        <InfoCard title="Before you begin">
          Your property goes live as soon as you submit it. You can keep its
          details, rent and availability current any time from your account.
        </InfoCard>

      </div>

      <form onSubmit={handleSubmit}>
        <div className="mt-6 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">

          <SectionTitle
            title="What's your relationship to this property?"
            description="This tells renters where the information came from."
          />

          <RoleSelector value={role} onChange={setRole} />

        </div>

        {role && (
        <div className="mt-6 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">

        <SectionTitle
          title="Property Details"
          description="Help us identify this property as accurately as possible."
        />

        <div className="space-y-5">

          <InputField
            label="Property / Society Name"
            placeholder="Prestige Shantiniketan"
            name="name"
            required
          />

          {/* Before the address fields, not buried among them: this is the
              shortcut that saves the user typing the next few, so it has to
              be visible before they start typing. It fills city and area
              only — the street address is still theirs to enter. */}
          <div className="rounded-xl border border-border-subtle bg-surface-raised/70 p-4">
            <UseMyLocationButton onLocated={handleLocated} compact />
            <p className="mt-1.5 text-sm text-muted">
              Fills in your city and area. You can edit both afterwards.
            </p>
            {locationResult && (
              <p role="status" aria-live="polite" className="mt-2 text-sm font-medium text-accent-hover">
                {locationResult}
              </p>
            )}
          </div>

          {/* Address Line 1/2 paired in one row, and Area/City/State/PIN
              grouped into two more rows below, instead of six stacked
              full-width fields — same fields, same labels and helper text,
              just less scrolling to reach the end of the form. */}
          <div className="grid gap-6 md:grid-cols-2">
            <InputField
              label="Address"
              placeholder="Plot 12, ITPL Main Road"
              name="addressLine1"
              onChange={(event) => setAddressLine1(event.target.value)}
              helperText="House number, building, street or anything that helps identify the property."
              required
            />

            <InputField
              label="Address Line 2"
              placeholder="Tower 4, Flat 502"
              name="addressLine2"
              onChange={(event) => setAddressLine2(event.target.value)}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <InputField
              label="Area / Locality"
              placeholder="Whitefield"
              name="area"
              value={area}
              onChange={(event) => setArea(event.target.value)}
              required
            />

            <InputField
              label="City"
              placeholder="Bengaluru"
              name="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              required
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <InputField
              label="State"
              placeholder="Karnataka"
              name="state"
              required
            />

            <InputField
              label="PIN Code"
              placeholder="560066"
              name="postalCode"
            />
          </div>

          {/* Landmark paired with the Maps link — both are supplementary
              location aids, not part of the required address itself. In
              Indian cities a landmark is how an address is actually given
              and found, so it still gets its own labeled field rather than
              a line inside free-text notes; it's just no longer a full-width
              row of its own. */}
          <div className="grid gap-6 md:grid-cols-2">
            <InputField
              label="Landmark"
              placeholder="Near Forum Shantiniketan Mall"
              name="landmark"
              helperText="The nearest well-known place. This is often how people find a property."
            />

            <InputField
              label="Google Maps Link"
              placeholder="https://maps.google.com/..."
              name="mapsUrl"
              type="url"
              helperText="Optional. Helps us verify the property faster."
            />
          </div>

          {/* Auto-locates from the full typed address (debounced inside the
              component) and falls back to the area/city centroid whenever
              that fails or nothing has been typed yet. Nothing here is
              submitted until the viewer actually confirms a point
              themselves — see PropertyLocationField. */}
          <PropertyLocationField
            fallbackCenter={getAreaCoordinates(area) ?? getCityCoordinates(city)}
            addressLine1={addressLine1}
            addressLine2={addressLine2}
            area={area}
            city={city}
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

        {/* Asked of every role, not just owners: these are facts about the
            property itself, and they are what the discovery filters search
            on. Collecting them only from owners would leave a tenant's
            contribution unreachable by a "2 BHK" search — the filter would
            work and still appear broken. Every field is optional, because a
            community member adding a property they don't live in genuinely
            may not know. */}
        {role && (
          <div className="mt-6 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">

            <SectionTitle
              title="About the Property"
              description="Renters filter by these, so anything you can answer helps this property be found."
            />

            <PropertyAttributeFields />

          </div>
        )}

        {/* Listing details are an owner's commercial offer, so they're only
            collected from owners. What a tenant actually paid is a different
            fact and belongs on their review, not on the property. */}
        {role === "owner" && (
          <div className="mt-6 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">

            <SectionTitle
              title="Listing Details"
              description="What you're asking for this property. You can change these any time from your account."
            />

            <div className="space-y-5">

              <div className="grid gap-6 md:grid-cols-2">

                <InputField
                  label="Monthly Rent (₹)"
                  placeholder="28000"
                  name="askingRent"
                  type="number"
                  min="0"
                  step="1"
                />

                <InputField
                  label="Security Deposit (₹)"
                  placeholder="150000"
                  name="securityDeposit"
                  type="number"
                  min="0"
                  step="1"
                />

              </div>

              {/* Deliberately unchecked by default: advertising a property as
                  available is a claim the owner must opt into, not something
                  they opt out of. An unnoticed pre-ticked box would badge
                  occupied properties as vacant. */}
              <label className="flex items-center gap-2 text-muted">
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

        {/* Contact preference is asked of every role too: a tenant or a
            community member may well be willing to answer a question about a
            place they know, and the person asking has no other way to reach
            them. The default is "no direct contact" — nothing is exposed
            unless it is chosen. */}
        {role && (
          <div className="mt-6 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">

            <SectionTitle
              title="How should interested renters reach you?"
              description="Your choice controls what is shown. Contact details are never visible to signed-out visitors."
            />

            <ContactPreferenceFields />

          </div>
        )}

        {submissionError && (
          <p role="alert" className="mt-6 text-sm text-danger">
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
