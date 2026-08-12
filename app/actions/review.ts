"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type YesNo = "yes" | "no" | null;

type CreateReviewInput = {
  propertyId: string;
  overallRating: number;
  recommendation: "yes" | "no";
  comment: string;
  wouldRentAgain: string | null;
  quickRatings: Record<string, number>;
  ownerRating: number;
  positiveTraits: string[];
  negativeTraits: string[];
  depositTaken: YesNo;
  depositMonths: number | null;
  depositMoreThanTwoMonths: YesNo;
  depositReturned: YesNo;
  depositReturnedOnTime: YesNo;
  depositAdditionalDeductions: YesNo;
  depositDeductionReason: string;
  depositDeductionAmount: number | null;
  depositExperienceRating: number;
  isAnonymous: boolean;
};

type CreateReviewResult = {
  error?: string;
  reviewId?: string;
};

function toBoolean(value: YesNo): boolean | null {
  if (value === "yes") return true;
  if (value === "no") return false;
  return null;
}

// "Definitely" -> "definitely", "Probably Not" -> "probably_not", matching
// the public.rent_again_option enum values.
function toRentAgainValue(label: string | null): string | null {
  if (!label) return null;
  return label.toLowerCase().replace(/\s+/g, "_");
}

export async function createReview({
  propertyId,
  overallRating,
  recommendation,
  comment,
  wouldRentAgain,
  quickRatings,
  ownerRating,
  positiveTraits,
  negativeTraits,
  depositTaken,
  depositMonths,
  depositMoreThanTwoMonths,
  depositReturned,
  depositReturnedOnTime,
  depositAdditionalDeductions,
  depositDeductionReason,
  depositDeductionAmount,
  depositExperienceRating,
  isAnonymous,
}: CreateReviewInput): Promise<CreateReviewResult> {
  if (overallRating < 1 || overallRating > 5) {
    return { error: "Please select an overall rating." };
  }

  if (!comment.trim()) {
    return { error: "Please add a comment before publishing." };
  }

  const supabase = await createClient();
  const { error: authFailure } = await requireUser(
    supabase,
    "Please sign in to publish a review.",
  );

  if (authFailure) {
    return { error: authFailure };
  }

  // Quick ratings + the owner rating (reusing the existing 'owner_behavior'
  // category) are zipped into parallel slug/rating arrays for the RPC.
  const categorySlugs: string[] = [];
  const categoryRatings: number[] = [];

  for (const [slug, rating] of Object.entries(quickRatings)) {
    if (rating >= 1) {
      categorySlugs.push(slug);
      categoryRatings.push(rating);
    }
  }

  if (ownerRating >= 1) {
    categorySlugs.push("owner_behavior");
    categoryRatings.push(ownerRating);
  }

  // Atomic: the review row and its category ratings succeed or fail
  // together, via a SECURITY INVOKER Postgres function (see the
  // create_review_rpc migration) rather than sequential client-side inserts.
  const { data: reviewId, error } = await supabase.rpc("create_review", {
    p_property_id: propertyId,
    p_overall_rating: overallRating,
    p_recommendation: recommendation,
    p_comment: comment.trim(),
    p_would_rent_again: toRentAgainValue(wouldRentAgain),
    p_positive_owner_traits: positiveTraits,
    p_negative_owner_traits: negativeTraits,
    p_deposit_taken: toBoolean(depositTaken),
    p_deposit_months: depositMonths,
    p_deposit_more_than_two_months: toBoolean(depositMoreThanTwoMonths),
    p_deposit_returned: toBoolean(depositReturned),
    p_deposit_returned_on_time: toBoolean(depositReturnedOnTime),
    p_deposit_additional_deductions: toBoolean(depositAdditionalDeductions),
    p_deposit_deduction_reason: depositDeductionReason.trim() || null,
    p_deposit_deduction_amount: depositDeductionAmount,
    p_deposit_experience_rating: depositExperienceRating >= 1 ? depositExperienceRating : null,
    p_category_slugs: categorySlugs,
    p_category_ratings: categoryRatings,
    p_is_anonymous: isAnonymous,
  });

  if (error || !reviewId) {
    return { error: "Unable to publish your review. Please try again." };
  }

  return { reviewId };
}
