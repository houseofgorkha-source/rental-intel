import type { Review } from "@/data/reviews";


type ReviewCardProps = {
  review: {
    id: number;
    title: string;
    rating: number;
    review: string;
    reviewer: string;
    stay: string;
  };
};

export default function ReviewCard({ review }: ReviewCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">

      <div className="flex items-center justify-between">

        <h3 className="text-xl font-semibold text-gray-900">
          {review.title}
        </h3>

        <span className="text-yellow-500">
          {"★".repeat(review.rating)}
        </span>

      </div>

      <p className="mt-3 text-gray-700">
        {review.review}
      </p>

      <div className="mt-4 text-sm text-gray-500">
        ✅ {review.reviewer} • {review.stay}
      </div>

    </div>
  );
}