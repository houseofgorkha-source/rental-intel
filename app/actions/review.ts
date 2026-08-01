"use server";

import { createClient } from "@/lib/supabase/server";

type CreateReviewInput = {
  propertyId: string;
  overallRating: number;
  recommendation: "yes" | "no";
  comment: string;
};

type CreateReviewResult = {
  error?: string;
  reviewId?: string;
};

export async function createReview({
  propertyId,
  overallRating,
  recommendation,
  comment,
}: CreateReviewInput): Promise<CreateReviewResult> {
  if (overallRating < 1 || overallRating > 5) {
    return { error: "Please select an overall rating." };
  }

  if (!comment.trim()) {
    return { error: "Please add a comment before publishing." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Please sign in to publish a review." };
  }

  const { data: review, error } = await supabase
    .from("reviews")
    .insert({
      property_id: propertyId,
      author_id: user.id,
      title: "Tenant review",
      body: comment.trim(),
      overall_rating: overallRating,
      recommendation,
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Unable to publish your review. Please try again." };
  }

  return { reviewId: review.id };
}
