import { describe, expect, it } from "vitest";
import {
  aggregateCategoryRatings,
  aggregateDepositInsights,
  calculateAverageRating,
  type DepositReviewRow,
} from "./property-format";

function depositRow(overrides: Partial<DepositReviewRow> = {}): DepositReviewRow {
  return {
    depositTaken: null,
    depositMonths: null,
    depositReturned: null,
    depositReturnedOnTime: null,
    depositAdditionalDeductions: null,
    depositDeductionReason: null,
    depositExperienceRating: null,
    ...overrides,
  };
}

describe("calculateAverageRating", () => {
  it("averages a list of ratings", () => {
    expect(calculateAverageRating([4, 5, 3])).toBeCloseTo(4);
  });

  it("returns null for an empty list", () => {
    expect(calculateAverageRating([])).toBeNull();
  });
});

describe("aggregateCategoryRatings", () => {
  it("returns null score and no categories for no ratings", () => {
    expect(aggregateCategoryRatings([])).toEqual({ overallScore: null, categories: [] });
  });

  it("groups ratings by category and averages each one", () => {
    const result = aggregateCategoryRatings([
      { slug: "water_supply", label: "Water Supply", sortOrder: 3, rating: 4 },
      { slug: "water_supply", label: "Water Supply", sortOrder: 3, rating: 2 },
      { slug: "security", label: "Security", sortOrder: 4, rating: 5 },
    ]);

    expect(result.categories).toEqual([
      { slug: "water_supply", label: "Water Supply", sortOrder: 3, average: 3, count: 2 },
      { slug: "security", label: "Security", sortOrder: 4, average: 5, count: 1 },
    ]);
  });

  it("sorts categories by sortOrder regardless of input order", () => {
    const result = aggregateCategoryRatings([
      { slug: "safety", label: "Safety", sortOrder: 10, rating: 5 },
      { slug: "owner_behavior", label: "Owner Behaviour", sortOrder: 1, rating: 4 },
    ]);

    expect(result.categories.map((c) => c.slug)).toEqual(["owner_behavior", "safety"]);
  });

  it("computes the overall score as the mean across every individual rating, not per-category averages", () => {
    // Category A: two ratings averaging 5. Category B: one rating of 1.
    // A naive "average of category averages" would give (5+1)/2 = 3.
    // The flat mean across all 3 individual ratings is (5+5+1)/3 = 3.67.
    const result = aggregateCategoryRatings([
      { slug: "a", label: "A", sortOrder: 1, rating: 5 },
      { slug: "a", label: "A", sortOrder: 1, rating: 5 },
      { slug: "b", label: "B", sortOrder: 2, rating: 1 },
    ]);

    expect(result.overallScore).toBeCloseTo(3.6667, 3);
  });

  it("omits a category entirely rather than fabricating a zero average", () => {
    const result = aggregateCategoryRatings([
      { slug: "security", label: "Security", sortOrder: 4, rating: 5 },
    ]);

    expect(result.categories).toHaveLength(1);
    expect(result.categories.find((c) => c.slug === "water_supply")).toBeUndefined();
  });
});

describe("aggregateDepositInsights", () => {
  it("returns null when no review mentions a deposit", () => {
    expect(aggregateDepositInsights([depositRow({ depositTaken: false }), depositRow()])).toBeNull();
  });

  it("excludes reviews that never took a deposit from every stat", () => {
    const result = aggregateDepositInsights([
      depositRow({ depositTaken: true, depositReturned: true, depositMonths: 2 }),
      depositRow({ depositTaken: false, depositReturned: false, depositMonths: 99 }),
    ]);

    expect(result?.reviewsWithDeposit).toBe(1);
    expect(result?.averageMonths).toBe(2);
    expect(result?.returnedPercentage).toBe(100);
  });

  it("computes returned and on-time percentages only from reviews that answered", () => {
    const result = aggregateDepositInsights([
      depositRow({ depositTaken: true, depositReturned: true, depositReturnedOnTime: true }),
      depositRow({ depositTaken: true, depositReturned: true, depositReturnedOnTime: false }),
      depositRow({ depositTaken: true, depositReturned: false }),
      // Left the "returned?" question blank — excluded from the percentage,
      // not counted as "not returned".
      depositRow({ depositTaken: true, depositReturned: null }),
    ]);

    expect(result?.returnedPercentage).toBe(67); // 2 of 3 answered "yes"
    expect(result?.onTimePercentage).toBe(50); // 1 of 2 returned deposits was on time
  });

  it("only computes on-time percentage from deposits that were actually returned", () => {
    const result = aggregateDepositInsights([
      depositRow({ depositTaken: true, depositReturned: false, depositReturnedOnTime: true }),
    ]);

    // depositReturnedOnTime shouldn't be counted for a deposit that was
    // never returned, even if the field happens to hold a stray value.
    expect(result?.onTimePercentage).toBeNull();
  });

  it("collects real, deduplicated deduction reasons, capped at 5", () => {
    const result = aggregateDepositInsights([
      depositRow({ depositTaken: true, depositAdditionalDeductions: true, depositDeductionReason: "Paint touch-up" }),
      depositRow({ depositTaken: true, depositAdditionalDeductions: true, depositDeductionReason: "Paint touch-up" }),
      depositRow({ depositTaken: true, depositAdditionalDeductions: true, depositDeductionReason: "Broken fixture" }),
      depositRow({ depositTaken: true, depositAdditionalDeductions: false, depositDeductionReason: "Should be ignored" }),
    ]);

    expect(result?.deductionReasons).toEqual(["Paint touch-up", "Broken fixture"]);
  });

  it("averages deposit experience rating only from reviews that gave one", () => {
    const result = aggregateDepositInsights([
      depositRow({ depositTaken: true, depositExperienceRating: 5 }),
      depositRow({ depositTaken: true, depositExperienceRating: 3 }),
      depositRow({ depositTaken: true, depositExperienceRating: null }),
    ]);

    expect(result?.averageExperienceRating).toBe(4);
    expect(result?.reviewsWithDeposit).toBe(3);
  });
});
