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
  addressLine1: string;
  submittedAs: "owner" | "tenant" | "helper" | null;
  landmark: string | null;
  configuration: string | null;
  propertyType: string | null;
  furnishing: string | null;
  carpetAreaSqft: number | null;
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
export default function PropertyEditForm({ property }: { property: EditableProperty }) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const isOwnerListing = property.submittedAs === "owner";

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

      {/* Stated up front rather than discovered by looking for missing
          inputs. The name and address are not editable anywhere, by anyone —
          reviews are permanently attached to them (CLAUDE.md §26) — so the
          honest thing is to show them as fixed facts and say why. */}
      <section className="rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground">This property</h2>
        <p className="mt-3 text-base font-medium text-foreground">{property.name}</p>
        <p className="mt-1 text-sm text-muted">
          {property.addressLine1}, {property.area}, {property.city}
        </p>
        <p className="mt-4 text-sm leading-6 text-muted">
          A property&apos;s name and address can&apos;t be changed — reviews stay
          attached to them permanently. Everything below is yours to keep current.
        </p>
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
            }}
          />
        </div>
        <div className="mt-6">
          <InputField
            label="Landmark"
            placeholder="Opposite BDA Complex, behind Empire Restaurant"
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
            fallbackCenter={getAreaCoordinates(property.area) ?? getCityCoordinates(property.city)}
            // Static values, not live-typed input: addressLine1/area/city
            // are frozen here (§26 identity immutability — this field never
            // unlocks them, only reads them). If a confirmed pin already
            // exists, PropertyLocationField skips geocoding entirely and
            // keeps it; otherwise this runs once to offer a better starting
            // point than the raw area centroid.
            addressLine1={property.addressLine1}
            area={property.area}
            city={property.city}
          />
        </div>
      </section>

      {isOwnerListing && (
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
      )}

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
