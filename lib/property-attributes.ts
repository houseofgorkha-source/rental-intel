// The canonical property attribute values.
//
// These arrays mirror the Postgres enums in
// 20260810000000_add_property_attributes_and_contact.sql exactly, value for
// value. That is the point: the registration form, the stored row, the filter
// chips, the filter query and the property page all read these same strings,
// so "1 RK" cannot become "1RK" in one place and "RK 1" in another. The
// database rejects anything not in this list, and TypeScript rejects it here,
// so a drifting variant has nowhere to live.
//
// Changing any value below therefore requires a matching migration. Adding a
// configuration is `alter type ... add value`, not an edit here alone.

export const PROPERTY_CONFIGURATIONS = [
  "1 RK",
  "1 BHK",
  "2 BHK",
  "3 BHK",
  "4 BHK",
  "5+ BHK",
] as const;

export const PROPERTY_TYPES = [
  "Apartment",
  "Independent house",
  "Villa",
  "PG / Co-living",
  "Studio",
] as const;

export const FURNISHING_OPTIONS = [
  "Unfurnished",
  "Semi-furnished",
  "Fully furnished",
] as const;

export const CONTACT_METHODS = ["phone", "email", "message", "none"] as const;

export type PropertyConfiguration = (typeof PROPERTY_CONFIGURATIONS)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type Furnishing = (typeof FURNISHING_OPTIONS)[number];
export type ContactMethod = (typeof CONTACT_METHODS)[number];

// Everything arriving from a form is a self-declared string, so each of these
// re-validates against the list rather than casting. An unrecognised value
// becomes null ("not provided") instead of an error: a property is still
// worth having without its furnishing, and rejecting the whole submission
// over one unknown select value would lose the rest of the contribution.
export function isPropertyConfiguration(
  value: unknown,
): value is PropertyConfiguration {
  return PROPERTY_CONFIGURATIONS.includes(value as PropertyConfiguration);
}

export function isPropertyType(value: unknown): value is PropertyType {
  return PROPERTY_TYPES.includes(value as PropertyType);
}

export function isFurnishing(value: unknown): value is Furnishing {
  return FURNISHING_OPTIONS.includes(value as Furnishing);
}

export function isContactMethod(value: unknown): value is ContactMethod {
  return CONTACT_METHODS.includes(value as ContactMethod);
}

// "Posted by" reuses `submitted_as` rather than a column of its own — the
// provenance question is already answered there. The labels differ from the
// stored values because "helper" is internal vocabulary; renters read
// "Community member".
//
// There is deliberately no "Broker" option. RentalIntel has no broker role,
// and offering a filter for one would let people select a category that can
// never match a single property — the exact failure this whole change is
// fixing.
export const POSTED_BY_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
  { value: "helper", label: "Community member" },
] as const;

export type PostedBy = (typeof POSTED_BY_OPTIONS)[number]["value"];

export const CONTACT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: "Phone",
  email: "Email",
  message: "Message here",
  none: "No direct contact",
};
