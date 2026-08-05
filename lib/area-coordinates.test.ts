import { describe, expect, it } from "vitest";
import { findNearestArea, findNearestCity, getAreaCoordinates, isNearArea } from "./area-coordinates";

describe("findNearestCity", () => {
  it("finds Bengaluru for coordinates near central Bengaluru", () => {
    expect(findNearestCity({ lat: 12.9716, lng: 77.5946 })).toBe("Bengaluru");
  });

  it("finds Mumbai for coordinates near central Mumbai", () => {
    expect(findNearestCity({ lat: 19.076, lng: 72.8777 })).toBe("Mumbai");
  });
});

describe("findNearestArea", () => {
  it("finds the nearest Bengaluru locality to a point near it", () => {
    const koramangala = getAreaCoordinates("Koramangala")!;
    expect(findNearestArea(koramangala, "Bengaluru")).toBe("Koramangala");
  });

  it("returns null for a city with no area coordinate data", () => {
    expect(findNearestArea({ lat: 19.076, lng: 72.8777 }, "Mumbai")).toBeNull();
  });

  it("returns null for an unknown city", () => {
    expect(findNearestArea({ lat: 12.9716, lng: 77.5946 }, "Nowhereville")).toBeNull();
  });
});

describe("isNearArea", () => {
  it("returns true when the point is at the area's coordinates", () => {
    const koramangala = getAreaCoordinates("Koramangala")!;
    expect(isNearArea(koramangala, "Koramangala")).toBe(true);
  });

  it("returns false when the point is far from the area", () => {
    expect(isNearArea({ lat: 19.076, lng: 72.8777 }, "Koramangala")).toBe(false);
  });

  it("returns false for an area with no coordinate data", () => {
    expect(isNearArea({ lat: 12.9716, lng: 77.5946 }, "Nowhere Layout")).toBe(false);
  });
});
