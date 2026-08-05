import { describe, expect, it } from "vitest";
import { normalizeCityName } from "./cities";

describe("normalizeCityName", () => {
  it("normalizes a known alias to its canonical name", () => {
    expect(normalizeCityName("Bengaluru")).toBe("Bangalore");
    expect(normalizeCityName("BENGALURU")).toBe("Bangalore");
    expect(normalizeCityName("bengaluru")).toBe("Bangalore");
  });

  it("normalizes the canonical name itself, case-insensitively", () => {
    expect(normalizeCityName("bangalore")).toBe("Bangalore");
    expect(normalizeCityName("BANGALORE")).toBe("Bangalore");
  });

  it("normalizes a known-but-unavailable city to its canonical name", () => {
    expect(normalizeCityName("hyderabad")).toBe("Hyderabad");
  });

  it("title-cases an unrecognized city instead of rejecting it", () => {
    expect(normalizeCityName("mumbai")).toBe("Mumbai");
    expect(normalizeCityName("NEW DELHI")).toBe("New Delhi");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeCityName("  Bengaluru  ")).toBe("Bangalore");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(normalizeCityName("")).toBeNull();
    expect(normalizeCityName("   ")).toBeNull();
  });
});
