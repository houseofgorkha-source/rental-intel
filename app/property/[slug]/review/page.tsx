import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ReviewForm, { type ExistingReview } from "../../../../components/review/ReviewForm";
import { rentAgainOptions, type RentAgainOption } from "@/components/review/reviewCategories";

type ReviewPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type YesNoValue = "yes" | "no" | null;

function toYesNo(value: boolean | null): YesNoValue {
  if (value === true) return "yes";
  if (value === false) return "no";
  return null;
}

// "probably" -> "Probably", the inverse of ReviewForm's own
// label.toLowerCase().replace(/\s+/g, "_") — only ever applied to a value
// this same form wrote, so every DB value is expected to match one of these.
function fromRentAgainValue(value: string | null): RentAgainOption | null {
  if (!value) return null;
  return (
    rentAgainOptions.find(
      (option) => option.toLowerCase().replace(/\s+/g, "_") === value,
    ) ?? null
  );
}

export default async function ReviewPage({
  params,
}: ReviewPageProps) {
  const { slug } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/property/${slug}/review`);

  // `select("*")` rather than naming submitted_as: a named column that
  // doesn't exist yet (pending migration) fails the whole query and would
  // 404 this page, whereas `*` simply omits it and the owner check below
  // falls back to the pre-existing behaviour.
  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !property) {
    notFound();
  }

  // Anyone can review a published property; a property's own creator can
  // also review it while it's still pending approval — everyone else must
  // wait, same as the reviews RLS insert policy enforces server-side.
  if (property.status !== "published" && property.created_by !== user.id) {
    notFound();
  }

  // An owner cannot review the property they listed. This mirrors the RLS
  // insert policy exactly so the UI never offers something the database
  // would reject — the database remains the actual boundary.
  if (property.submitted_as === "owner" && property.created_by === user.id) {
    notFound();
  }

  // If the current user already has a review here, this page edits it
  // instead of creating a second one — there is no UI path to a duplicate
  // review, and none at the database level either (this query plus
  // update_review's ownership check are what make that true).
  const { data: existingReviewRow } = await supabase
    .from("reviews")
    .select(
      "id, overall_rating, recommendation, would_rent_again, positive_owner_traits, negative_owner_traits, deposit_taken, security_deposit, deposit_more_than_two_months, deposit_returned, deposit_returned_on_time, deposit_additional_deductions, deposit_deduction_reason, deposit_deduction_amount, deposit_experience_rating, body, is_anonymous, amenities",
    )
    .eq("property_id", property.id)
    .eq("author_id", user.id)
    .maybeSingle();

  let existingReview: ExistingReview | undefined;
  if (existingReviewRow) {
    const { data: categoryRatingRows } = await supabase
      .from("review_category_ratings")
      .select("rating, category:review_categories(slug)")
      .eq("review_id", existingReviewRow.id);

    const quickRatings: Record<string, number> = {};
    let ownerRating = 0;
    for (const row of categoryRatingRows ?? []) {
      const category = Array.isArray(row.category) ? row.category[0] : row.category;
      if (!category) continue;
      if (category.slug === "owner_behavior") {
        ownerRating = row.rating;
      } else {
        quickRatings[category.slug] = row.rating;
      }
    }

    existingReview = {
      id: existingReviewRow.id,
      overallRating: existingReviewRow.overall_rating,
      wouldRecommend: existingReviewRow.recommendation === "yes" ? "yes" : "no",
      wouldRentAgain: fromRentAgainValue(existingReviewRow.would_rent_again),
      quickRatings,
      ownerRating,
      positiveTraits: existingReviewRow.positive_owner_traits ?? [],
      negativeTraits: existingReviewRow.negative_owner_traits ?? [],
      depositTaken: toYesNo(existingReviewRow.deposit_taken),
      depositAmount: existingReviewRow.security_deposit,
      depositMoreThanTwoMonths: toYesNo(existingReviewRow.deposit_more_than_two_months),
      depositReturned: toYesNo(existingReviewRow.deposit_returned),
      depositReturnedOnTime: toYesNo(existingReviewRow.deposit_returned_on_time),
      depositAdditionalDeductions: toYesNo(existingReviewRow.deposit_additional_deductions),
      depositDeductionReason: existingReviewRow.deposit_deduction_reason ?? "",
      depositDeductionAmount: existingReviewRow.deposit_deduction_amount,
      depositExperienceRating: existingReviewRow.deposit_experience_rating ?? 0,
      comment: existingReviewRow.body,
      isAnonymous: existingReviewRow.is_anonymous,
      amenities: existingReviewRow.amenities ?? [],
    };
  }

  return (
    // `pt-28`, matching the header-clearance convention used elsewhere
    // (account/admin/property-detail) — `py-12` (48px) wasn't enough to
    // clear the absolutely-positioned header. `px-4` on mobile (was px-6)
    // widens the form; sm:px-6 unchanged.
    <main className="min-h-screen bg-surface pb-12 pt-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">

        <Link
          href={`/property/${property.slug}`}
          className="inline-flex items-center text-sm font-medium text-accent transition-colors hover:text-accent-hover"
        >
          ← Back to Property
        </Link>

        <div className="mt-8 rounded-2xl border border-border-subtle bg-surface p-8">

          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            {existingReview ? "Edit Your Review" : "Share Your Experience"}
          </h1>

          <p className="mt-3 text-muted">
            {existingReview
              ? "Update your review of "
              : "Help future tenants by sharing your honest experience at "}
            <span className="font-medium text-foreground">
              {property.name}
            </span>.
          </p>

        </div>

        <div className="mt-8">
          <ReviewForm
            propertyId={property.id}
            propertyArea={property.area}
            existingReview={existingReview}
          />
        </div>

      </div>
    </main>
  );
}
