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

// A lump-sum amount (a security deposit, a one-time deduction) is never
// "/month" — that suffix belongs to formatINRPerMonth alone. Kept as its own
// function rather than a flag on that one, so a deposit can never be
// accidentally formatted as a recurring rate again.
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// A rupee amount typed into a form field. Empty means "not provided" (null);
// anything else is rounded to a whole rupee before it's sent anywhere —
// matching the same defensive rounding app/actions/property.ts's
// parseAmount already applies to every other typed money field, which the
// review form's deposit fields had been skipping.
export function parseWholeAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;

  return Math.round(parsed);
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
  // The total amount paid as a deposit, in rupees — not a number of months'
  // rent (an earlier version of the review form collected months; the
  // schema's own `security_deposit` column is, and always was, a currency
  // amount).
  depositAmount: number | null;
  depositReturned: boolean | null;
  depositReturnedOnTime: boolean | null;
  depositAdditionalDeductions: boolean | null;
  depositDeductionReason: string | null;
  depositDeductionAmount: number | null;
  depositExperienceRating: number | null;
};

export type DepositInsights = {
  reviewsWithDeposit: number;
  averageAmount: number | null;
  // Percentages are computed only over reviews that actually answered the
  // relevant question — a review that left it blank is excluded from that
  // specific percentage rather than silently counted as "not returned".
  returnedPercentage: number | null;
  onTimePercentage: number | null;
  averageExperienceRating: number | null;
  // Mean of calculateDepositOutcomeScore across every review that answered
  // "was it returned" — see that function for the rubric.
  averageScore: number | null;
  // Real, verbatim reasons reviewers gave for a deduction — deduplicated and
  // capped, never a generated/paraphrased summary.
  deductionReasons: string[];
};

// A single review's deposit outcome, reduced to one 0–100 number: whether
// the deposit was returned at all is the dominant fact (0 vs. a 60-point
// floor), with "on time" and "no deductions" layered on top as secondary
// quality signals — a late or partially-docked return is still a
// fundamentally better outcome than one never returned, so that gap (0→60)
// is deliberately much larger than the gap between a clean return and an
// imperfect one (75→100). Null means "can't be scored" (the reviewer never
// said whether it was returned), not zero — a missing answer must never
// silently read as the worst possible outcome.
export function calculateDepositOutcomeScore(answers: {
  depositReturned: boolean | null;
  depositReturnedOnTime: boolean | null;
  depositAdditionalDeductions: boolean | null;
}): number | null {
  if (answers.depositReturned === null) return null;
  if (answers.depositReturned === false) return 0;

  // Returned. A sub-question left unanswered can't be credited as a
  // positive, so — for this single-review number, unlike the aggregate's
  // percentages above — it's treated the same as "no" rather than excluded,
  // since a definite score has to resolve to *some* number.
  const onTime = answers.depositReturnedOnTime === true;
  const noDeductions = answers.depositAdditionalDeductions === false;

  if (onTime && noDeductions) return 100;
  if (onTime) return 90;
  if (noDeductions) return 85;
  return 75;
}

// A short, human sentence for one review's deposit score — each of
// calculateDepositOutcomeScore's five possible outputs (0, 75, 85, 90, 100)
// maps to exactly one label, since the score already uniquely encodes which
// combination of answers produced it.
export function depositOutcomeLabel(score: number): string {
  switch (score) {
    case 100:
      return "Deposit fully returned, on time, no deductions";
    case 90:
      return "Deposit returned on time, with deductions";
    case 85:
      return "Deposit returned late, no deductions";
    case 75:
      return "Deposit returned late, with deductions";
    default:
      return "Deposit not returned";
  }
}

// What fraction of the deposit actually came back — not just whether it
// came back at all. A review that got ₹1,00,000 back minus a ₹30,000
// deduction returned 70%, not 100%: counting it as a full return (the old
// behaviour — this function replaces a plain "did you answer yes" rate)
// would hide exactly the fact a deposit-return statistic exists to surface.
// Returns null when the fraction genuinely can't be computed — deductions
// were made but no amount was given — rather than guessing a number; a
// missing figure is excluded from the average below, never assumed to be
// either 0% or 100%.
export function calculateDepositReturnedPercent(answers: {
  depositReturned: boolean | null;
  depositAdditionalDeductions: boolean | null;
  depositAmount: number | null;
  depositDeductionAmount: number | null;
}): number | null {
  if (answers.depositReturned === null) return null;
  if (answers.depositReturned === false) return 0;

  // Returned, and no deductions confirmed: the full amount came back.
  if (answers.depositAdditionalDeductions === false) return 100;

  // Returned, with deductions: the fraction retained, clamped to [0, 100]
  // in case a deduction is mistakenly entered larger than the deposit
  // itself.
  if (
    answers.depositAdditionalDeductions === true &&
    answers.depositAmount !== null &&
    answers.depositAmount > 0 &&
    answers.depositDeductionAmount !== null
  ) {
    const fraction = (answers.depositAmount - answers.depositDeductionAmount) / answers.depositAmount;
    return Math.max(0, Math.min(100, Math.round(fraction * 100)));
  }

  // Returned, but whether there were deductions (or how much) is unknown —
  // can't be quantified either way.
  return null;
}

// A review that never took a deposit (`depositTaken !== true`) has nothing to
// contribute here — including it would silently drag every percentage toward
// "not applicable" rather than the real experience of renters who actually
// paid one. Returns null (render nothing) rather than a block of zeros when
// no review on this property mentions a deposit at all.
export function aggregateDepositInsights(reviews: DepositReviewRow[]): DepositInsights | null {
  const withDeposit = reviews.filter((review) => review.depositTaken === true);
  if (withDeposit.length === 0) return null;

  const amounts = withDeposit
    .map((review) => review.depositAmount)
    .filter((value): value is number => value !== null);

  const returnedPercents = withDeposit
    .map((review) => calculateDepositReturnedPercent(review))
    .filter((value): value is number => value !== null);

  const returnedYes = withDeposit.filter((review) => review.depositReturned === true);
  const onTimeAnswers = returnedYes
    .map((review) => review.depositReturnedOnTime)
    .filter((value): value is boolean => value !== null);

  const experienceRatings = withDeposit
    .map((review) => review.depositExperienceRating)
    .filter((value): value is number => value !== null);

  const scores = withDeposit
    .map((review) => calculateDepositOutcomeScore(review))
    .filter((value): value is number => value !== null);

  const averageReturnedPercent = calculateAverageRating(returnedPercents);

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
    averageAmount: calculateAverageRating(amounts),
    // The average fraction of the deposit actually returned, not a plain
    // "answered yes" rate — see calculateDepositReturnedPercent for why a
    // deposit returned minus a deduction counts as less than 100%.
    returnedPercentage: averageReturnedPercent === null ? null : Math.round(averageReturnedPercent),
    onTimePercentage:
      onTimeAnswers.length === 0
        ? null
        : Math.round((onTimeAnswers.filter(Boolean).length / onTimeAnswers.length) * 100),
    averageExperienceRating: calculateAverageRating(experienceRatings),
    averageScore: calculateAverageRating(scores),
    deductionReasons,
  };
}
