"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type YesNo = "yes" | "no" | null;

type ReviewFields = {
  overallRating: number;
  recommendation: "yes" | "no";
  comment: string;
  wouldRentAgain: string | null;
  quickRatings: Record<string, number>;
  ownerRating: number;
  positiveTraits: string[];
  negativeTraits: string[];
  depositTaken: YesNo;
  // The total deposit amount paid, in rupees — not a number of months' rent
  // (see 20260819000000's own comment for why the earlier "months" field was
  // replaced: it was being displayed as a currency figure while being
  // collected as a unitless month count).
  depositAmount: number | null;
  depositMoreThanTwoMonths: YesNo;
  depositReturned: YesNo;
  depositReturnedOnTime: YesNo;
  depositAdditionalDeductions: YesNo;
  depositDeductionReason: string;
  depositDeductionAmount: number | null;
  depositExperienceRating: number;
  isAnonymous: boolean;
  amenities: string[];
};

type CreateReviewInput = ReviewFields & {
  propertyId: string;
};

type UpdateReviewInput = ReviewFields & {
  reviewId: string;
};

type ReviewActionResult = {
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

// Quick ratings + the owner rating (reusing the existing 'owner_behavior'
// category) are zipped into parallel slug/rating arrays for the RPC. Shared
// by create and update so the two can't drift on which ratings count.
function buildCategoryRatings(
  quickRatings: Record<string, number>,
  ownerRating: number,
): { categorySlugs: string[]; categoryRatings: number[] } {
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

  return { categorySlugs, categoryRatings };
}

function validate(overallRating: number, comment: string): string | null {
  if (overallRating < 1 || overallRating > 5) {
    return "Please select an overall rating.";
  }
  if (!comment.trim()) {
    return "Please add a comment before publishing.";
  }
  return null;
}

// Same reasoning as MAX_PROPERTIES_PER_DAY in app/actions/property.ts: a
// free, zero-infrastructure deterrent against a scripted flood, generous
// enough that no real reviewer would ever hit it in a day.
const MAX_REVIEWS_PER_DAY = 10;

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
  depositAmount,
  depositMoreThanTwoMonths,
  depositReturned,
  depositReturnedOnTime,
  depositAdditionalDeductions,
  depositDeductionReason,
  depositDeductionAmount,
  depositExperienceRating,
  isAnonymous,
  amenities,
}: CreateReviewInput): Promise<ReviewActionResult> {
  const validationError = validate(overallRating, comment);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to publish a review.",
  );
  if (!user) return { error: authFailure };

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentReviewCount } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .gte("created_at", oneDayAgo);

  if ((recentReviewCount ?? 0) >= MAX_REVIEWS_PER_DAY) {
    return {
      error: `You've published ${MAX_REVIEWS_PER_DAY} reviews in the last 24 hours. Please try again tomorrow.`,
    };
  }

  const { categorySlugs, categoryRatings } = buildCategoryRatings(quickRatings, ownerRating);

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
    // Deprecated (see 20260819000000) — the form no longer collects a
    // months figure, so this is always null for a new review. The column
    // and parameter stay so existing rows keep their data.
    p_deposit_months: null,
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
    p_security_deposit: depositAmount,
    p_amenities: amenities,
  });

  if (error || !reviewId) {
    return { error: "Unable to publish your review. Please try again." };
  }

  return { reviewId };
}

// Amends the caller's own review. Ownership is enforced by the `update_review`
// RPC's underlying RLS policy (author_id = auth.uid()), not by this action —
// the reviewId is trusted no further than that.
export async function updateReview({
  reviewId,
  overallRating,
  recommendation,
  comment,
  wouldRentAgain,
  quickRatings,
  ownerRating,
  positiveTraits,
  negativeTraits,
  depositTaken,
  depositAmount,
  depositMoreThanTwoMonths,
  depositReturned,
  depositReturnedOnTime,
  depositAdditionalDeductions,
  depositDeductionReason,
  depositDeductionAmount,
  depositExperienceRating,
  isAnonymous,
  amenities,
}: UpdateReviewInput): Promise<ReviewActionResult> {
  const validationError = validate(overallRating, comment);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error: authFailure } = await requireUser(
    supabase,
    "Please sign in to edit your review.",
  );
  if (authFailure) return { error: authFailure };

  const { categorySlugs, categoryRatings } = buildCategoryRatings(quickRatings, ownerRating);

  const { data: updatedReviewId, error } = await supabase.rpc("update_review", {
    p_review_id: reviewId,
    p_overall_rating: overallRating,
    p_recommendation: recommendation,
    p_comment: comment.trim(),
    p_would_rent_again: toRentAgainValue(wouldRentAgain),
    p_positive_owner_traits: positiveTraits,
    p_negative_owner_traits: negativeTraits,
    p_deposit_taken: toBoolean(depositTaken),
    p_deposit_more_than_two_months: toBoolean(depositMoreThanTwoMonths),
    p_deposit_returned: toBoolean(depositReturned),
    p_deposit_returned_on_time: toBoolean(depositReturnedOnTime),
    p_deposit_additional_deductions: toBoolean(depositAdditionalDeductions),
    p_deposit_deduction_reason: depositDeductionReason.trim() || null,
    p_deposit_deduction_amount: depositDeductionAmount,
    p_deposit_experience_rating: depositExperienceRating >= 1 ? depositExperienceRating : null,
    p_security_deposit: depositAmount,
    p_amenities: amenities,
    p_category_slugs: categorySlugs,
    p_category_ratings: categoryRatings,
    p_is_anonymous: isAnonymous,
  });

  if (error || !updatedReviewId) {
    return { error: "Unable to save your changes. Please try again." };
  }

  return { reviewId: updatedReviewId };
}
