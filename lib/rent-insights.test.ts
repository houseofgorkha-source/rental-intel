import { describe, expect, it } from "vitest";
import { aggregateRentByArea, MIN_RENT_SAMPLE_SIZE } from "./rent-insights";

describe("aggregateRentByArea", () => {
  it("omits an area below the minimum sample size", () => {
    const properties = Array.from({ length: MIN_RENT_SAMPLE_SIZE - 1 }, () => ({
      area: "Koramangala",
      askingRent: 30000,
    }));

    expect(aggregateRentByArea(properties)).toEqual([]);
  });

  it("includes an area once it reaches the minimum sample size", () => {
    const properties = Array.from({ length: MIN_RENT_SAMPLE_SIZE }, () => ({
      area: "Koramangala",
      askingRent: 30000,
    }));

    const result = aggregateRentByArea(properties);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ area: "Koramangala", averageRent: 30000, sampleSize: 3 });
  });

  it("merges differently-cased spellings of the same area", () => {
    const properties = [
      { area: "Whitefield", askingRent: 20000 },
      { area: "whitefield", askingRent: 30000 },
      { area: "  whitefield  ", askingRent: 40000 },
    ];

    const result = aggregateRentByArea(properties);
    expect(result).toHaveLength(1);
    expect(result[0].sampleSize).toBe(3);
    expect(result[0].averageRent).toBe(30000);
  });

  it("does not merge a genuinely different spelling (no fuzzy matching)", () => {
    const properties = [
      { area: "Whitefield", askingRent: 20000 },
      { area: "Whitefield", askingRent: 20000 },
      { area: "Whitefield", askingRent: 20000 },
      { area: "Whitehield", askingRent: 90000 },
      { area: "Whitehield", askingRent: 90000 },
    ];

    const result = aggregateRentByArea(properties);
    // "Whitehield" has only 2 — below the threshold, excluded entirely.
    expect(result).toHaveLength(1);
    expect(result[0].area).toBe("Whitefield");
  });

  it("excludes properties with no asking rent from the average and the sample count", () => {
    const properties = [
      { area: "Indiranagar", askingRent: 20000 },
      { area: "Indiranagar", askingRent: 30000 },
      { area: "Indiranagar", askingRent: 40000 },
      { area: "Indiranagar", askingRent: null },
    ];

    const result = aggregateRentByArea(properties);
    expect(result[0].sampleSize).toBe(3);
    expect(result[0].averageRent).toBe(30000);
  });

  it("uses the most common casing as the display name", () => {
    const properties = [
      { area: "HSR Layout", askingRent: 25000 },
      { area: "HSR Layout", askingRent: 25000 },
      { area: "hsr layout", askingRent: 25000 },
    ];

    expect(aggregateRentByArea(properties)[0].area).toBe("HSR Layout");
  });

  it("sorts results by sample size, largest first", () => {
    const properties = [
      ...Array.from({ length: 3 }, () => ({ area: "Small", askingRent: 10000 })),
      ...Array.from({ length: 5 }, () => ({ area: "Big", askingRent: 20000 })),
    ];

    const result = aggregateRentByArea(properties);
    expect(result.map((insight) => insight.area)).toEqual(["Big", "Small"]);
  });
});
