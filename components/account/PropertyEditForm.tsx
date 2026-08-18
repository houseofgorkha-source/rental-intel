"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateProperty } from "@/app/actions/property";
import InputField from "@/components/shared/InputField";
import Button from "@/components/shared/Button";
import PropertyAttributeFields from "@/components/add-property/PropertyAttributeFields";
import ContactPreferenceFields from "@/components/add-property/ContactPreferenceFields";
import PropertyLocationField from "@/components/add-property/PropertyLocationField";
import { getAreaCoordinates, getCityCoordinates } from "@/lib/area-coordinates";
import type { ContactMethod } from "@/lib/property-attributes";

export type EditableProperty = {
  slug: string;
  name: string;
  area: string;
  city: string;
  state: string;
  postalCode: string | null;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  configuration: string | null;
  propertyType: string | null;
  furnishing: string | null;
  carpetAreaSqft: number | null;
  amenities: string[];
  askingRent: number | null;
  securityDeposit: number | null;
  isAvailable: boolean;
  contactMethod: ContactMethod;
  contactPhone: string | null;
  contactEmail: string | null;
  latitude: number | null;
  longitude: number | null;
};

// Amending a property, reusing the exact field fragments the Add Property form
// uses (PropertyAttributeFields, ContactPreferenceFields) rather than a second
// set of inputs — so a value can never be registerable and not editable.
//
// Every identity/commercial/attribute field is editable here by whoever
// created this property, regardless of which of the three roles they
// submitted it as — a deliberate reversal of the earlier "identity is
// permanently fixed" and "listing fields are owner-only" rules, per an
// explicit product decision (see the 20260822000000 migration and
// updateProperty's own comment). Row scope (only your own property) is
// unchanged and is enforced by the database, not this form.
export default function PropertyEditForm({ property }: { property: EditableProperty }) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [addressLine1, setAddressLine1] = useState(property.addressLine1);
  const [addressLine2, setAddressLine2] = useState(property.addressLine2 ?? "");
  const [area, setArea] = useState(property.area);
  const [city, setCity] = useState(property.city);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const result = await updateProperty(new FormData(event.currentTarget));
      if (result.error) {
        setError(result.error);
        return;
      }
      router.push("/account/properties");
      router.refresh();
    } catch {
      setError("Unable to save your changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <input type="hidden" name="slug" value={property.slug} />

      <section className="rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">This property</h2>
        <p className="mt-1 text-sm text-muted">
          Editable by you, since you added it. Changing the name changes this
          property&apos;s page address.
        </p>
        <div className="mt-6 space-y-5">
          <InputField
            label="Property / Society Name"
            placeholder="Prestige Shantiniketan"
            name="name"
            defaultValue={property.name}
            required
          />
          <div className="grid gap-6 md:grid-cols-2">
            <InputField
              label="Address"
              placeholder="Plot 12, ITPL Main Road"
              name="addressLine1"
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
              required
            />
            <InputField
              label="Address Line 2"
              placeholder="Tower 4, Flat 502"
              name="addressLine2"
              value={addressLine2}
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
              defaultValue={property.state}
              required
            />
            <InputField
              label="PIN Code"
              placeholder="560066"
              name="postalCode"
              defaultValue={property.postalCode ?? undefined}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">About the property</h2>
        <p className="mt-1 text-sm text-muted">
          Renters filter by these, so completing them helps this property be found.
        </p>
        <div className="mt-6">
          <PropertyAttributeFields
            defaults={{
              configuration: property.configuration,
              propertyType: property.propertyType,
              furnishing: property.furnishing,
              carpetAreaSqft: property.carpetAreaSqft,
              amenities: property.amenities,
            }}
          />
        </div>
        <div className="mt-6">
          <InputField
            label="Landmark"
            placeholder="Near Forum Shantiniketan Mall"
            name="landmark"
            defaultValue={property.landmark ?? undefined}
            helperText="The nearest well-known place. This is often how people find a property."
          />
        </div>
        <div className="mt-6">
          <PropertyLocationField
            defaultCoordinates={
              property.latitude !== null && property.longitude !== null
                ? { lat: property.latitude, lng: property.longitude }
                : null
            }
            fallbackCenter={getAreaCoordinates(area) ?? getCityCoordinates(city)}
            // Live-typed now that identity fields are editable — mirrors
            // PropertyForm.tsx's own pattern. If a confirmed pin already
            // exists, PropertyLocationField skips geocoding entirely and
            // keeps it; otherwise this reruns as the address is edited.
            addressLine1={addressLine1}
            addressLine2={addressLine2}
            area={area}
            city={city}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">Listing details</h2>
        <p className="mt-1 text-sm text-muted">
          What you&apos;re asking for this property.
        </p>
        <div className="mt-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <InputField
              label="Monthly Rent (₹)"
              placeholder="28000"
              name="askingRent"
              type="number"
              min="0"
              step="1"
              defaultValue={
                property.askingRent === null ? undefined : String(property.askingRent)
              }
            />
            <InputField
              label="Security Deposit (₹)"
              placeholder="150000"
              name="securityDeposit"
              type="number"
              min="0"
              step="1"
              defaultValue={
                property.securityDeposit === null
                  ? undefined
                  : String(property.securityDeposit)
              }
            />
          </div>
          {/* Unticking this is how a property is marked as rented. It removes
              the "Available for rent" badge and nothing else — the page, its
              reviews and its history stay live and searchable, because a
              property's rental history has to outlive any one tenancy. */}
          <label className="flex items-center gap-2 text-muted">
            <input
              type="checkbox"
              name="isAvailable"
              defaultChecked={property.isAvailable}
              className="accent-blue-600"
            />
            This property is currently available to rent
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">
          How should interested renters reach you?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Your choice controls what is shown. Contact details are never visible to
          signed-out visitors.
        </p>
        <div className="mt-6">
          <ContactPreferenceFields
            defaultMethod={property.contactMethod}
            defaultPhone={property.contactPhone}
            defaultEmail={property.contactEmail}
          />
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
        <Link
          href="/account/properties"
          className="text-sm font-medium text-muted underline decoration-border-subtle underline-offset-4 transition hover:text-foreground"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
