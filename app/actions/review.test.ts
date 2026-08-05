import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser },
      rpc,
    }),
}));

const { createReview } = await import("./review");

const baseInput = {
  propertyId: "property-1",
  overallRating: 4,
  recommendation: "yes" as const,
  comment: "Great place to live.",
  wouldRentAgain: "Probably",
  quickRatings: { cleanliness: 5, safety: 4 },
  ownerRating: 3,
  positiveTraits: ["responsive"],
  negativeTraits: [],
  depositTaken: "yes" as const,
  depositMonths: 2,
  depositMoreThanTwoMonths: "no" as const,
  depositReturned: "yes" as const,
  depositReturnedOnTime: "yes" as const,
  depositAdditionalDeductions: "no" as const,
  depositDeductionReason: "",
  depositDeductionAmount: null,
  depositExperienceRating: 4,
};

beforeEach(() => {
  rpc.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
});

describe("createReview", () => {
  it("rejects an out-of-range overall rating without calling the RPC", async () => {
    const result = await createReview({ ...baseInput, overallRating: 0 });

    expect(result).toEqual({ error: "Please select an overall rating." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an empty comment without calling the RPC", async () => {
    const result = await createReview({ ...baseInput, comment: "   " });

    expect(result).toEqual({ error: "Please add a comment before publishing." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the auth error and skips the RPC when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await createReview(baseInput);

    expect(result).toEqual({ error: "Please sign in to publish a review." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls create_review with correctly mapped parameters", async () => {
    rpc.mockResolvedValue({ data: "review-1", error: null });

    const result = await createReview(baseInput);

    expect(rpc).toHaveBeenCalledWith("create_review", {
      p_property_id: "property-1",
      p_overall_rating: 4,
      p_recommendation: "yes",
      p_comment: "Great place to live.",
      p_would_rent_again: "probably",
      p_positive_owner_traits: ["responsive"],
      p_negative_owner_traits: [],
      p_deposit_taken: true,
      p_deposit_months: 2,
      p_deposit_more_than_two_months: false,
      p_deposit_returned: true,
      p_deposit_returned_on_time: true,
      p_deposit_additional_deductions: false,
      p_deposit_deduction_reason: null,
      p_deposit_deduction_amount: null,
      p_deposit_experience_rating: 4,
      p_category_slugs: ["cleanliness", "safety", "owner_behavior"],
      p_category_ratings: [5, 4, 3],
    });
    expect(result).toEqual({ reviewId: "review-1" });
  });

  it("omits quick-rating categories with a rating below 1", async () => {
    rpc.mockResolvedValue({ data: "review-1", error: null });

    await createReview({
      ...baseInput,
      quickRatings: { cleanliness: 5, safety: 0 },
      ownerRating: 0,
    });

    const call = rpc.mock.calls[0][1];
    expect(call.p_category_slugs).toEqual(["cleanliness"]);
    expect(call.p_category_ratings).toEqual([5]);
  });

  it("surfaces a generic error and does not throw when the RPC errors", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("rpc failed") });

    const result = await createReview(baseInput);

    expect(result).toEqual({
      error: "Unable to publish your review. Please try again.",
    });
  });

  it("surfaces a generic error when the RPC returns no reviewId", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    const result = await createReview(baseInput);

    expect(result).toEqual({
      error: "Unable to publish your review. Please try again.",
    });
  });
});
