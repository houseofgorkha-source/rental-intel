import { describe, expect, it } from "vitest";
import { cityMatches, normalizeCityName } from "./cities";

describe("normalizeCityName", () => {
  it("normalizes a known alias to its canonical name", () => {
    expect(normalizeCityName("Bangalore")).toBe("Bengaluru");
    expect(normalizeCityName("BANGALORE")).toBe("Bengaluru");
    expect(normalizeCityName("bangalore")).toBe("Bengaluru");
  });

  it("normalizes the canonical name itself, case-insensitively", () => {
    expect(normalizeCityName("bengaluru")).toBe("Bengaluru");
    expect(normalizeCityName("BENGALURU")).toBe("Bengaluru");
  });

  it("normalizes a known-but-unavailable city to its canonical name", () => {
    expect(normalizeCityName("hyderabad")).toBe("Hyderabad");
    expect(normalizeCityName("mumbai")).toBe("Mumbai");
    expect(normalizeCityName("gurgaon")).toBe("Gurgaon");
  });

  it("title-cases an unrecognized city instead of rejecting it", () => {
    expect(normalizeCityName("kochi")).toBe("Kochi");
    expect(normalizeCityName("NEW DELHI")).toBe("New Delhi");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCityName("  Bangalore  ")).toBe("Bengaluru");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(normalizeCityName("")).toBeNull();
    expect(normalizeCityName("   ")).toBeNull();
  });
});

describe("cityMatches", () => {
  it("matches a property city against a known alias", () => {
    expect(cityMatches("Bangalore", "Bengaluru")).toBe(true);
    expect(cityMatches("BANGALORE", "Bengaluru")).toBe(true);
    expect(cityMatches("Bengaluru", "Bengaluru")).toBe(true);
  });

  it("does not match a different city", () => {
    expect(cityMatches("Mumbai", "Bengaluru")).toBe(false);
  });
});
