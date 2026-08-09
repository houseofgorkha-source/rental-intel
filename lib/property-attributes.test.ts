import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTACT_METHODS,
  FURNISHING_OPTIONS,
  POSTED_BY_OPTIONS,
  PROPERTY_CONFIGURATIONS,
  PROPERTY_TYPES,
  isContactMethod,
  isFurnishing,
  isPropertyConfiguration,
  isPropertyType,
} from "./property-attributes";

// The one thing that must never drift: these lists and the Postgres enums are
// the same values. If they diverge, a form offers an option the database
// rejects, or a filter chip exists that no row can ever carry — the exact
// failure mode this whole set of attributes was added to avoid. Reading the
// migration is the only way to assert it without a live database.
const migration = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../supabase/migrations/20260810000000_add_property_attributes_and_contact.sql",
  ),
  "utf8",
);

function enumValues(typeName: string): string[] {
  const match = migration.match(
    new RegExp(`create type public\\.${typeName} as enum \\(([^)]*)\\)`, "s"),
  );
  if (!match) throw new Error(`No enum named ${typeName} in the migration`);

  return [...match[1].matchAll(/'([^']*)'/g)].map((value) => value[1]);
}

describe("canonical property attribute values", () => {
  it("matches the property_configuration enum, including 1 RK", () => {
    expect(enumValues("property_configuration")).toEqual([...PROPERTY_CONFIGURATIONS]);
    expect(PROPERTY_CONFIGURATIONS).toContain("1 RK");
  });

  it("matches the property_type enum", () => {
    expect(enumValues("property_type")).toEqual([...PROPERTY_TYPES]);
  });

  it("matches the property_furnishing enum", () => {
    expect(enumValues("property_furnishing")).toEqual([...FURNISHING_OPTIONS]);
  });

  it("matches the property_contact_method enum", () => {
    expect(enumValues("property_contact_method")).toEqual([...CONTACT_METHODS]);
  });

  // "1RK" and "RK 1" are the specific variants that must not become
  // representable anywhere. Only "1 RK" exists, and nothing accepts the others.
  it("has exactly one spelling for a room-kitchen configuration", () => {
    const roomKitchenValues = PROPERTY_CONFIGURATIONS.filter((value) =>
      value.replace(/\s/g, "").toUpperCase().includes("RK"),
    );

    expect(roomKitchenValues).toEqual(["1 RK"]);
    expect(isPropertyConfiguration("1RK")).toBe(false);
    expect(isPropertyConfiguration("RK 1")).toBe(false);
    expect(isPropertyConfiguration("1 rk")).toBe(false);
    expect(isPropertyConfiguration("1 RK")).toBe(true);
  });

  it("rejects unknown values in every guard", () => {
    expect(isPropertyType("Houseboat")).toBe(false);
    expect(isFurnishing("Partly furnished")).toBe(false);
    expect(isContactMethod("whatsapp")).toBe(false);
    expect(isPropertyType("Studio")).toBe(true);
  });

  // Provenance has one home — properties.submitted_as. A "Posted by" option
  // that isn't a submitter role could never match a property.
  it("only offers Posted by options that exist as submitter roles", () => {
    expect(POSTED_BY_OPTIONS.map((option) => option.value)).toEqual([
      "owner",
      "tenant",
      "helper",
    ]);
    expect(POSTED_BY_OPTIONS.map((option) => option.value)).not.toContain("broker");
  });
});
