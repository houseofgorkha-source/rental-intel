import TrustBadge from "@/components/shared/TrustBadge";
import { depositOutcomeLabel, formatINR } from "@/lib/property-format";

export type Review = {
  id: string;
  reviewer: string;
  rating: number;
  title: string;
  review: string;
  stay: string;
  verified: boolean;
  // What backs the "Verified Tenant" badge, e.g. "Rental agreement and Rent
  // receipt" — never rendered unless `verified` is also true, so an
  // unverified review can never carry a stray disclosure line.
  verifiedVia: string | null;
  date: string;
  wouldRecommend: boolean;
  // The reviewer's own confirmation of which amenities were actually
  // present — independent of the property's own listed amenities.
  amenities: string[];
  // This review's own deposit outcome (see lib/property-format.ts's
  // calculateDepositOutcomeScore) — null when no deposit was taken, or the
  // reviewer never said whether it was returned, in which case nothing
  // deposit-related renders on this card.
  depositScore: number | null;
  depositAdditionalDeductions: boolean | null;
  depositDeductionReason: string | null;
  depositDeductionAmount: number | null;
};

type ReviewCardProps = {
  review: Review;
};

export default function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-6">

      <div className="flex items-center justify-between">

        <h3 className="text-xl font-semibold text-foreground">
          {review.title}
          <p className="mt-1 text-sm text-muted">
  By {review.reviewer}
</p>
        </h3>

        <div className="text-right">
  <div className="text-yellow-500 text-lg">
    {"★".repeat(review.rating)}
  </div>
  <div className="text-xs text-muted">
    {review.rating}/5
  </div>
</div>

      </div>

      <p className="mt-3 text-muted">
        {review.review}
      </p>

      {review.amenities.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {review.amenities.map((amenity) => (
            <li
              key={amenity}
              className="rounded-full border border-border-subtle bg-surface-raised px-2.5 py-1 text-xs font-medium text-muted"
            >
              {amenity}
            </li>
          ))}
        </ul>
      )}

      {review.depositScore !== null && (
        <div className="mt-3 rounded-xl border border-border-subtle bg-surface-raised px-3 py-2.5 text-sm">
          <p className="font-medium text-foreground">
            {depositOutcomeLabel(review.depositScore)}
          </p>
          {review.depositAdditionalDeductions === true &&
            (review.depositDeductionAmount !== null || review.depositDeductionReason) && (
              <p className="mt-1 text-muted">
                {review.depositDeductionAmount !== null &&
                  `${formatINR(review.depositDeductionAmount)} deducted`}
                {review.depositDeductionAmount !== null && review.depositDeductionReason && " — "}
                {review.depositDeductionReason}
              </p>
            )}
        </div>
      )}

    <div className="mt-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <div>
      <TrustBadge type={review.verified ? "tenant" : "community"} />
      {review.verified && review.verifiedVia && (
        <p className="mt-1 text-xs text-muted">Verified via {review.verifiedVia}</p>
      )}
    </div>

    <span
      className={`text-sm font-medium ${
        review.wouldRecommend ? "text-green-600" : "text-danger"
      }`}
    >
      {review.wouldRecommend
        ? "👍 Recommends"
        : "👎 Doesn't recommend"}
    </span>
  </div>

  <span className="text-sm text-muted">
    {review.stay}
  </span>
</div>

    </div>
  );
}
