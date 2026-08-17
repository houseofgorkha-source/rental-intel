import { describe, expect, it } from "vitest";
import {
  aggregateCategoryRatings,
  aggregateDepositInsights,
  calculateAverageRating,
  calculateDepositOutcomeScore,
  calculateDepositReturnedPercent,
  depositOutcomeLabel,
  type DepositReviewRow,
} from "./property-format";

function depositRow(overrides: Partial<DepositReviewRow> = {}): DepositReviewRow {
  return {
    depositTaken: null,
    depositAmount: null,
    depositReturned: null,
    depositReturnedOnTime: null,
    depositAdditionalDeductions: null,
    depositDeductionReason: null,
    depositDeductionAmount: null,
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
      depositRow({
        depositTaken: true,
        depositReturned: true,
        depositAdditionalDeductions: false,
        depositAmount: 200000,
      }),
      depositRow({ depositTaken: false, depositReturned: false, depositAmount: 999999 }),
    ]);

    expect(result?.reviewsWithDeposit).toBe(1);
    expect(result?.averageAmount).toBe(200000);
    expect(result?.returnedPercentage).toBe(100);
  });

  it("computes returned and on-time percentages only from reviews that answered", () => {
    const result = aggregateDepositInsights([
      // Both confirm no deductions, so their returned-percent is a clean
      // 100 each — this test is isolating the on-time logic, not the
      // deduction-fraction one (see calculateDepositReturnedPercent's own
      // tests for that).
      depositRow({
        depositTaken: true,
        depositReturned: true,
        depositReturnedOnTime: true,
        depositAdditionalDeductions: false,
      }),
      depositRow({
        depositTaken: true,
        depositReturned: true,
        depositReturnedOnTime: false,
        depositAdditionalDeductions: false,
      }),
      depositRow({ depositTaken: true, depositReturned: false }),
      // Left the "returned?" question blank — excluded from the percentage,
      // not counted as "not returned".
      depositRow({ depositTaken: true, depositReturned: null }),
    ]);

    expect(result?.returnedPercentage).toBe(67); // (100 + 100 + 0) / 3
    expect(result?.onTimePercentage).toBe(50); // 1 of 2 returned deposits was on time
  });

  it("discounts the returned percentage for a deposit returned minus a deduction, not just whether it came back at all", () => {
    const result = aggregateDepositInsights([
      depositRow({
        depositTaken: true,
        depositReturned: true,
        depositAdditionalDeductions: true,
        depositAmount: 100000,
        depositDeductionAmount: 30000,
      }),
    ]);

    // (100000 - 30000) / 100000 = 70%, not the 100% a plain "did they say
    // yes" rate would have shown.
    expect(result?.returnedPercentage).toBe(70);
  });

  it("blends a clean return and a partial-deduction return into one average", () => {
    const result = aggregateDepositInsights([
      depositRow({
        depositTaken: true,
        depositReturned: true,
        depositAdditionalDeductions: false,
        depositAmount: 100000,
      }),
      depositRow({
        depositTaken: true,
        depositReturned: true,
        depositAdditionalDeductions: true,
        depositAmount: 100000,
        depositDeductionAmount: 30000,
      }),
    ]);

    // (100 + 70) / 2 = 85.
    expect(result?.returnedPercentage).toBe(85);
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

  it("averages the deposit outcome score only from reviews that answered whether it was returned", () => {
    const result = aggregateDepositInsights([
      depositRow({
        depositTaken: true,
        depositReturned: true,
        depositReturnedOnTime: true,
        depositAdditionalDeductions: false,
      }),
      depositRow({ depositTaken: true, depositReturned: false }),
      // Never said whether it was returned — excluded from the average, not
      // counted as a 0.
      depositRow({ depositTaken: true, depositReturned: null }),
    ]);

    // (100 + 0) / 2 = 50 — the unanswered row must not drag this to 33.
    expect(result?.averageScore).toBe(50);
  });
});

describe("calculateDepositOutcomeScore", () => {
  it("returns null when the reviewer never said whether the deposit was returned", () => {
    expect(
      calculateDepositOutcomeScore({
        depositReturned: null,
        depositReturnedOnTime: null,
        depositAdditionalDeductions: null,
      }),
    ).toBeNull();
  });

  it("scores 0 when the deposit was never returned, regardless of other answers", () => {
    expect(
      calculateDepositOutcomeScore({
        depositReturned: false,
        depositReturnedOnTime: true,
        depositAdditionalDeductions: false,
      }),
    ).toBe(0);
  });

  it("scores 100 for a clean, on-time, no-deductions return", () => {
    expect(
      calculateDepositOutcomeScore({
        depositReturned: true,
        depositReturnedOnTime: true,
        depositAdditionalDeductions: false,
      }),
    ).toBe(100);
  });

  it("scores 90 for on-time but with deductions", () => {
    expect(
      calculateDepositOutcomeScore({
        depositReturned: true,
        depositReturnedOnTime: true,
        depositAdditionalDeductions: true,
      }),
    ).toBe(90);
  });

  it("scores 85 for late but with no deductions", () => {
    expect(
      calculateDepositOutcomeScore({
        depositReturned: true,
        depositReturnedOnTime: false,
        depositAdditionalDeductions: false,
      }),
    ).toBe(85);
  });

  it("scores 75 for late with deductions", () => {
    expect(
      calculateDepositOutcomeScore({
        depositReturned: true,
        depositReturnedOnTime: false,
        depositAdditionalDeductions: true,
      }),
    ).toBe(75);
  });

  it("treats an unanswered on-time/deductions question the same as a 'no' for that question", () => {
    expect(
      calculateDepositOutcomeScore({
        depositReturned: true,
        depositReturnedOnTime: null,
        depositAdditionalDeductions: null,
      }),
    ).toBe(75);
  });
});

describe("calculateDepositReturnedPercent", () => {
  it("returns null when the reviewer never said whether it was returned", () => {
    expect(
      calculateDepositReturnedPercent({
        depositReturned: null,
        depositAdditionalDeductions: null,
        depositAmount: null,
        depositDeductionAmount: null,
      }),
    ).toBeNull();
  });

  it("is 0 when the deposit was never returned", () => {
    expect(
      calculateDepositReturnedPercent({
        depositReturned: false,
        depositAdditionalDeductions: null,
        depositAmount: 50000,
        depositDeductionAmount: null,
      }),
    ).toBe(0);
  });

  it("is 100 when returned with no deductions", () => {
    expect(
      calculateDepositReturnedPercent({
        depositReturned: true,
        depositAdditionalDeductions: false,
        depositAmount: 50000,
        depositDeductionAmount: null,
      }),
    ).toBe(100);
  });

  it("computes the exact fraction retained when both amounts are known", () => {
    expect(
      calculateDepositReturnedPercent({
        depositReturned: true,
        depositAdditionalDeductions: true,
        depositAmount: 100000,
        depositDeductionAmount: 30000,
      }),
    ).toBe(70);
  });

  it("clamps to 0 if a deduction is entered larger than the deposit itself", () => {
    expect(
      calculateDepositReturnedPercent({
        depositReturned: true,
        depositAdditionalDeductions: true,
        depositAmount: 50000,
        depositDeductionAmount: 80000,
      }),
    ).toBe(0);
  });

  it("returns null when deductions happened but the amount was never given", () => {
    expect(
      calculateDepositReturnedPercent({
        depositReturned: true,
        depositAdditionalDeductions: true,
        depositAmount: 100000,
        depositDeductionAmount: null,
      }),
    ).toBeNull();
  });

  it("returns null when whether there were deductions was never answered", () => {
    expect(
      calculateDepositReturnedPercent({
        depositReturned: true,
        depositAdditionalDeductions: null,
        depositAmount: 100000,
        depositDeductionAmount: null,
      }),
    ).toBeNull();
  });
});

describe("depositOutcomeLabel", () => {
  it("maps every possible score to a distinct label", () => {
    expect(depositOutcomeLabel(0)).toBe("Deposit not returned");
    expect(depositOutcomeLabel(75)).toBe("Deposit returned late, with deductions");
    expect(depositOutcomeLabel(85)).toBe("Deposit returned late, no deductions");
    expect(depositOutcomeLabel(90)).toBe("Deposit returned on time, with deductions");
    expect(depositOutcomeLabel(100)).toBe("Deposit fully returned, on time, no deductions");
  });
});
