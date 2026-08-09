import TrustBadge from "@/components/shared/TrustBadge";

export type Review = {
  id: string;
  reviewer: string;
  rating: number;
  title: string;
  review: string;
  stay: string;
  verified: boolean;
  date: string;
  wouldRecommend: boolean;
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

    <div className="mt-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <TrustBadge type={review.verified ? "tenant" : "community"} />

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
