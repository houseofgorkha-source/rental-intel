type StorageClient = {
  storage: {
    from: (bucket: string) => {
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

export function getPropertyImageUrl(supabase: StorageClient, storagePath: string): string {
  return supabase.storage.from("property-images").getPublicUrl(storagePath).data.publicUrl;
}

export function calculateAverageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return ratings.reduce((total, rating) => total + rating, 0) / ratings.length;
}

export function formatINRPerMonth(rent: number): string {
  return `₹${rent.toLocaleString("en-IN")}/month`;
}

export type CategoryRatingRow = {
  slug: string;
  label: string;
  sortOrder: number;
  rating: number;
};

export type CategoryAggregate = {
  slug: string;
  label: string;
  sortOrder: number;
  average: number;
  count: number;
};

// Turns a flat list of per-review, per-category ratings (review_category_ratings
// joined to review_categories) into: an overall synthesized score (the mean
// across every individual category rating, not the same number as the
// per-review `overall_rating` average shown elsewhere on the property page —
// that one only reflects the single "how was your stay" question; this one
// reflects the full 10+-category breakdown), plus per-category averages
// sorted the same way the review form presents them. A category nobody has
// rated simply doesn't appear — never a fabricated average.
export function aggregateCategoryRatings(
  rows: CategoryRatingRow[],
): { overallScore: number | null; categories: CategoryAggregate[] } {
  if (rows.length === 0) return { overallScore: null, categories: [] };

  const bySlug = new Map<string, { label: string; sortOrder: number; ratings: number[] }>();
  for (const row of rows) {
    const existing = bySlug.get(row.slug);
    if (existing) {
      existing.ratings.push(row.rating);
    } else {
      bySlug.set(row.slug, { label: row.label, sortOrder: row.sortOrder, ratings: [row.rating] });
    }
  }

  const categories = Array.from(bySlug.entries())
    .map(([slug, { label, sortOrder, ratings }]) => ({
      slug,
      label,
      sortOrder,
      average: calculateAverageRating(ratings) as number,
      count: ratings.length,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    overallScore: calculateAverageRating(rows.map((row) => row.rating)),
    categories,
  };
}

export type DepositReviewRow = {
  depositTaken: boolean | null;
  depositMonths: number | null;
  depositReturned: boolean | null;
  depositReturnedOnTime: boolean | null;
  depositAdditionalDeductions: boolean | null;
  depositDeductionReason: string | null;
  depositExperienceRating: number | null;
};

export type DepositInsights = {
  reviewsWithDeposit: number;
  averageMonths: number | null;
  // Percentages are computed only over reviews that actually answered the
  // relevant question — a review that left it blank is excluded from that
  // specific percentage rather than silently counted as "not returned".
  returnedPercentage: number | null;
  onTimePercentage: number | null;
  averageExperienceRating: number | null;
  // Real, verbatim reasons reviewers gave for a deduction — deduplicated and
  // capped, never a generated/paraphrased summary.
  deductionReasons: string[];
};

// A review that never took a deposit (`depositTaken !== true`) has nothing to
// contribute here — including it would silently drag every percentage toward
// "not applicable" rather than the real experience of renters who actually
// paid one. Returns null (render nothing) rather than a block of zeros when
// no review on this property mentions a deposit at all.
export function aggregateDepositInsights(reviews: DepositReviewRow[]): DepositInsights | null {
  const withDeposit = reviews.filter((review) => review.depositTaken === true);
  if (withDeposit.length === 0) return null;

  const months = withDeposit
    .map((review) => review.depositMonths)
    .filter((value): value is number => value !== null);

  const returnedAnswers = withDeposit
    .map((review) => review.depositReturned)
    .filter((value): value is boolean => value !== null);

  const returnedYes = withDeposit.filter((review) => review.depositReturned === true);
  const onTimeAnswers = returnedYes
    .map((review) => review.depositReturnedOnTime)
    .filter((value): value is boolean => value !== null);

  const experienceRatings = withDeposit
    .map((review) => review.depositExperienceRating)
    .filter((value): value is number => value !== null);

  const deductionReasons = Array.from(
    new Set(
      withDeposit
        .filter((review) => review.depositAdditionalDeductions === true)
        .map((review) => review.depositDeductionReason?.trim())
        .filter((reason): reason is string => Boolean(reason)),
    ),
  ).slice(0, 5);

  return {
    reviewsWithDeposit: withDeposit.length,
    averageMonths: calculateAverageRating(months),
    returnedPercentage:
      returnedAnswers.length === 0
        ? null
        : Math.round((returnedAnswers.filter(Boolean).length / returnedAnswers.length) * 100),
    onTimePercentage:
      onTimeAnswers.length === 0
        ? null
        : Math.round((onTimeAnswers.filter(Boolean).length / onTimeAnswers.length) * 100),
    averageExperienceRating: calculateAverageRating(experienceRatings),
    deductionReasons,
  };
}
