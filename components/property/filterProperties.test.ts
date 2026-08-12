import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  DEPOSIT_MAX,
  RENT_MAX,
  countActiveFilters,
  filterProperties,
  sortProperties,
  type PropertyFilters,
} from "./PropertyDiscovery";
import type { DiscoveryProperty } from "@/lib/property-discovery";

// These cover the bug this file's filtering was rewritten to fix: the panel
// let people select a configuration, a property type, a furnishing, a minimum
// area or a "Posted by" role, and none of it reached the results. Each group
// therefore gets a test that fails if it is ever unwired again.

const NOW = Date.now();
const daysAgo = (days: number) =>
  new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

function property(overrides: Partial<DiscoveryProperty> = {}): DiscoveryProperty {
  return {
    slug: "a-property",
    name: "A Property",
    area: "Koramangala",
    city: "Bengaluru",
    askingRent: 25000,
    image: null,
    averageRating: null,
    reviewCount: 0,
    submittedAs: "owner",
    isAvailable: true,
    configuration: "2 BHK",
    propertyType: "Apartment",
    furnishing: "Semi-furnished",
    carpetAreaSqft: 900,
    securityDeposit: 100000,
    amenities: [],
    createdAt: daysAgo(1),
    coordinates: null,
    ...overrides,
  };
}

function withFilters(overrides: Partial<PropertyFilters>): PropertyFilters {
  return { ...DEFAULT_FILTERS, ...overrides };
}

const run = (properties: DiscoveryProperty[], filters: PropertyFilters) =>
  filterProperties(properties, { areas: [], filters }).map((item) => item.slug);

describe("filterProperties", () => {
  it("returns everything when no filter is applied", () => {
    const properties = [
      property({ slug: "one" }),
      property({ slug: "two", configuration: "1 RK", submittedAs: "tenant" }),
    ];

    expect(run(properties, DEFAULT_FILTERS)).toEqual(["one", "two"]);
  });

  describe("configuration", () => {
    it("filters to 1 RK without matching 1 BHK", () => {
      const properties = [
        property({ slug: "rk", configuration: "1 RK" }),
        property({ slug: "bhk1", configuration: "1 BHK" }),
        property({ slug: "bhk2", configuration: "2 BHK" }),
      ];

      expect(run(properties, withFilters({ configurations: ["1 RK"] }))).toEqual(["rk"]);
    });

    it("still filters the existing BHK configurations", () => {
      const properties = [
        property({ slug: "rk", configuration: "1 RK" }),
        property({ slug: "bhk1", configuration: "1 BHK" }),
        property({ slug: "bhk2", configuration: "2 BHK" }),
        property({ slug: "bhk5", configuration: "5+ BHK" }),
      ];

      expect(run(properties, withFilters({ configurations: ["1 BHK", "2 BHK"] }))).toEqual([
        "bhk1",
        "bhk2",
      ]);
      expect(run(properties, withFilters({ configurations: ["5+ BHK"] }))).toEqual(["bhk5"]);
    });

    it("excludes a property that never stated its configuration", () => {
      const properties = [
        property({ slug: "known", configuration: "2 BHK" }),
        property({ slug: "unknown", configuration: null }),
      ];

      expect(run(properties, withFilters({ configurations: ["2 BHK"] }))).toEqual(["known"]);
    });
  });

  it("filters by property type and furnishing", () => {
    const properties = [
      property({ slug: "villa", propertyType: "Villa", furnishing: "Unfurnished" }),
      property({ slug: "flat", propertyType: "Apartment", furnishing: "Fully furnished" }),
    ];

    expect(run(properties, withFilters({ propertyTypes: ["Villa"] }))).toEqual(["villa"]);
    expect(run(properties, withFilters({ furnishing: ["Fully furnished"] }))).toEqual(["flat"]);
  });

  describe("amenities", () => {
    it("matches a property that has every selected amenity", () => {
      const properties = [
        property({ slug: "both", amenities: ["Lift", "Gym"] }),
        property({ slug: "one-only", amenities: ["Lift"] }),
        property({ slug: "neither", amenities: [] }),
      ];

      expect(run(properties, withFilters({ amenities: ["Lift", "Gym"] }))).toEqual(["both"]);
    });

    it("is AND across selected amenities, not OR", () => {
      const properties = [
        property({ slug: "lift-only", amenities: ["Lift"] }),
        property({ slug: "gym-only", amenities: ["Gym"] }),
      ];

      expect(run(properties, withFilters({ amenities: ["Lift", "Gym"] }))).toEqual([]);
    });
  });

  it("filters by minimum area and excludes unmeasured properties", () => {
    const properties = [
      property({ slug: "big", carpetAreaSqft: 1200 }),
      property({ slug: "small", carpetAreaSqft: 450 }),
      property({ slug: "unmeasured", carpetAreaSqft: null }),
    ];

    expect(run(properties, withFilters({ minAreaSqft: 800 }))).toEqual(["big"]);
  });

  // The reported symptom: selecting "Tenant" changed nothing.
  describe("posted by", () => {
    it("filters by the contributor's declared role", () => {
      const properties = [
        property({ slug: "owner", submittedAs: "owner" }),
        property({ slug: "tenant", submittedAs: "tenant" }),
        property({ slug: "helper", submittedAs: "helper" }),
      ];

      expect(run(properties, withFilters({ postedBy: ["tenant"] }))).toEqual(["tenant"]);
      expect(run(properties, withFilters({ postedBy: ["owner", "helper"] }))).toEqual([
        "owner",
        "helper",
      ]);
    });

    it("excludes legacy rows with unknown provenance", () => {
      const properties = [
        property({ slug: "tenant", submittedAs: "tenant" }),
        property({ slug: "legacy", submittedAs: null }),
      ];

      expect(run(properties, withFilters({ postedBy: ["tenant"] }))).toEqual(["tenant"]);
    });
  });

  describe("price ranges", () => {
    it("filters by rent but keeps properties with no stated rent", () => {
      const properties = [
        property({ slug: "cheap", askingRent: 8000 }),
        property({ slug: "pricey", askingRent: 60000 }),
        property({ slug: "unpriced", askingRent: null }),
      ];

      expect(run(properties, withFilters({ rentRange: [3000, 20000] }))).toEqual([
        "cheap",
        "unpriced",
      ]);
    });

    it("treats the top of each range as no upper cap", () => {
      const properties = [property({ slug: "expensive", askingRent: 500000 })];

      expect(run(properties, withFilters({ rentRange: [3000, RENT_MAX] }))).toEqual([
        "expensive",
      ]);
    });

    it("filters by security deposit", () => {
      const properties = [
        property({ slug: "low", securityDeposit: 50000 }),
        property({ slug: "high", securityDeposit: 900000 }),
        property({ slug: "unstated", securityDeposit: null }),
      ];

      expect(run(properties, withFilters({ depositRange: [0, 100000] }))).toEqual([
        "low",
        "unstated",
      ]);
    });
  });

  it("filters by when the property was listed", () => {
    const properties = [
      property({ slug: "new", createdAt: daysAgo(2) }),
      property({ slug: "old", createdAt: daysAgo(120) }),
    ];

    expect(run(properties, withFilters({ listedWithinDays: 30 }))).toEqual(["new"]);
    expect(run(properties, withFilters({ listedWithinDays: null }))).toEqual(["new", "old"]);
  });

  it("applies the only-show filters", () => {
    const properties = [
      property({ slug: "reviewed", reviewCount: 3, image: { src: "a", alt: "a" } }),
      property({ slug: "bare", reviewCount: 0, image: null }),
    ];

    expect(
      run(properties, withFilters({ onlyShow: { reviewsOnly: true, photosOnly: true } })),
    ).toEqual(["reviewed"]);
  });

  it("combines filters as AND, not OR", () => {
    const properties = [
      property({ slug: "match", configuration: "1 RK", submittedAs: "owner", askingRent: 12000 }),
      property({ slug: "wrongRole", configuration: "1 RK", submittedAs: "tenant", askingRent: 12000 }),
      property({ slug: "wrongRent", configuration: "1 RK", submittedAs: "owner", askingRent: 90000 }),
      property({ slug: "wrongConfig", configuration: "3 BHK", submittedAs: "owner", askingRent: 12000 }),
    ];

    const filters = withFilters({
      configurations: ["1 RK"],
      postedBy: ["owner"],
      rentRange: [3000, 20000],
    });

    expect(run(properties, filters)).toEqual(["match"]);
  });

  it("restores every result when filters are reset to their defaults", () => {
    const properties = [
      property({ slug: "one", configuration: "1 RK" }),
      property({ slug: "two", configuration: "3 BHK", submittedAs: "helper" }),
      property({ slug: "three", configuration: null, submittedAs: null }),
    ];

    const narrowed = withFilters({ configurations: ["1 RK"], postedBy: ["owner"] });
    expect(run(properties, narrowed)).toEqual(["one"]);
    expect(run(properties, DEFAULT_FILTERS)).toEqual(["one", "two", "three"]);
  });

  it("still filters by area and free-text query", () => {
    const properties = [
      property({ slug: "kora", area: "Koramangala", name: "Lakeview Residency" }),
      property({ slug: "hsr", area: "HSR Layout", name: "Palm Grove" }),
    ];

    expect(
      filterProperties(properties, { areas: ["HSR Layout"], filters: DEFAULT_FILTERS }).map(
        (item) => item.slug,
      ),
    ).toEqual(["hsr"]);

    expect(
      filterProperties(properties, {
        areas: [],
        query: "lakeview",
        filters: DEFAULT_FILTERS,
      }).map((item) => item.slug),
    ).toEqual(["kora"]);
  });
});

describe("sortProperties", () => {
  it("leaves the order untouched when sortBy is null", () => {
    const properties = [
      property({ slug: "a", askingRent: 50000 }),
      property({ slug: "b", askingRent: 10000 }),
    ];

    expect(sortProperties(properties, null).map((item) => item.slug)).toEqual(["a", "b"]);
  });

  it("sorts by newest first", () => {
    const properties = [
      property({ slug: "old", createdAt: daysAgo(30) }),
      property({ slug: "new", createdAt: daysAgo(1) }),
    ];

    expect(sortProperties(properties, "newest").map((item) => item.slug)).toEqual([
      "new",
      "old",
    ]);
  });

  it("sorts by rent, ascending and descending, with unpriced properties always last", () => {
    const properties = [
      property({ slug: "mid", askingRent: 30000 }),
      property({ slug: "unpriced", askingRent: null }),
      property({ slug: "cheap", askingRent: 10000 }),
    ];

    expect(sortProperties(properties, "rent_asc").map((item) => item.slug)).toEqual([
      "cheap",
      "mid",
      "unpriced",
    ]);
    expect(sortProperties(properties, "rent_desc").map((item) => item.slug)).toEqual([
      "mid",
      "cheap",
      "unpriced",
    ]);
  });

  it("sorts by rating with unrated properties always last", () => {
    const properties = [
      property({ slug: "new", averageRating: null }),
      property({ slug: "good", averageRating: 4.5 }),
      property({ slug: "best", averageRating: 4.9 }),
    ];

    expect(sortProperties(properties, "rating_desc").map((item) => item.slug)).toEqual([
      "best",
      "good",
      "new",
    ]);
  });

  it("sorts by review count", () => {
    const properties = [
      property({ slug: "few", reviewCount: 2 }),
      property({ slug: "many", reviewCount: 10 }),
    ];

    expect(sortProperties(properties, "most_reviewed").map((item) => item.slug)).toEqual([
      "many",
      "few",
    ]);
  });

  it("does not mutate the input array", () => {
    const properties = [
      property({ slug: "a", askingRent: 50000 }),
      property({ slug: "b", askingRent: 10000 }),
    ];

    sortProperties(properties, "rent_asc");
    expect(properties.map((item) => item.slug)).toEqual(["a", "b"]);
  });
});

describe("countActiveFilters", () => {
  it("counts nothing for the default filters", () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
  });

  it("counts each narrowed group once", () => {
    const filters = withFilters({
      configurations: ["1 RK", "1 BHK"],
      postedBy: ["owner"],
      minAreaSqft: 500,
      rentRange: [10000, RENT_MAX],
      depositRange: [0, DEPOSIT_MAX],
      onlyShow: { reviewsOnly: true, photosOnly: false },
    });

    // configurations + postedBy + minArea + rentRange + reviewsOnly.
    // depositRange is untouched and must not count.
    expect(countActiveFilters(filters)).toBe(5);
  });
});
