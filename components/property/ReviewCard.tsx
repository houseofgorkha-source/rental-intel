import TrustBadge from "@/components/shared/TrustBadge";
import type { Review } from "@/data/reviews";

type ReviewCardProps = {
  review: Review;
};

export default function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">

      <div className="flex items-center justify-between">

        <h3 className="text-xl font-semibold text-gray-900">
          {review.title}
          <p className="mt-1 text-sm text-gray-500">
  By {review.reviewer}
</p>
        </h3>

        <div className="text-right">
  <div className="text-yellow-500 text-lg">
    {"★".repeat(review.rating)}
  </div>
  <div className="text-xs text-gray-500">
    {review.rating}/5
  </div>
</div>

      </div>

      <p className="mt-3 text-gray-700">
        {review.review}
      </p>

    <div className="mt-4 flex items-center justify-between">
  <div className="flex items-center gap-3">
    <TrustBadge type={review.verified ? "tenant" : "community"} />

    <span
      className={`text-sm font-medium ${
        review.wouldRecommend ? "text-green-600" : "text-red-600"
      }`}
    >
      {review.wouldRecommend
        ? "👍 Recommends"
        : "👎 Doesn't recommend"}
    </span>
  </div>

  <span className="text-sm text-gray-500">
    {review.stay}
  </span>
</div>

    </div>
  );
}