"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ReviewCard from "@/components/property/ReviewCard";
import { Review } from "@/data/reviews";

type Props = {
  propertySlug: string;
  propertyReviews: Review[];
  recommendationPercentage: number;
  recommendedCount: number;
};

const sortOptions = [
  "Newest",
  "Highest Rated",
  "Lowest Rated",
] as const;

const filterOptions = [
  "All",
  "Verified",
  "Recommended",
  "Not Recommended",
  "5 Stars",
] as const;

export default function ReviewSection({
  propertySlug,
  propertyReviews,
  recommendationPercentage,
  recommendedCount,
}: Props) {
  const [filter, setFilter] =
    useState<(typeof filterOptions)[number]>("All");

  const [sort, setSort] =
    useState<(typeof sortOptions)[number]>("Newest");

  const displayedReviews = useMemo(() => {
    let data = [...propertyReviews];

    switch (filter) {
      case "Verified":
        data = data.filter((r) => r.verified);
        break;

      case "Recommended":
        data = data.filter((r) => r.wouldRecommend);
        break;

      case "Not Recommended":
        data = data.filter((r) => !r.wouldRecommend);
        break;

      case "5 Stars":
        data = data.filter((r) => r.rating === 5);
        break;
    }

    switch (sort) {
      case "Highest Rated":
        data.sort((a, b) => b.rating - a.rating);
        break;

      case "Lowest Rated":
        data.sort((a, b) => a.rating - b.rating);
        break;

      case "Newest":
      default:
        data.sort(
          (a, b) =>
            new Date(b.date).getTime() -
            new Date(a.date).getTime()
        );
    }
    
    return data;
  }, [filter, sort, propertyReviews]);

  const ratingCounts = {
  5: propertyReviews.filter((r) => r.rating === 5).length,
  4: propertyReviews.filter((r) => r.rating === 4).length,
  3: propertyReviews.filter((r) => r.rating === 3).length,
  2: propertyReviews.filter((r) => r.rating === 2).length,
  1: propertyReviews.filter((r) => r.rating === 1).length,
};

const maxCount = Math.max(...Object.values(ratingCounts), 1);

  return (
    <div className="mt-10">

      <div className="flex flex-col gap-6">

        <p className="text-3xl font-bold text-green-600">
  {recommendationPercentage}% Recommend
</p>

<p className="mt-2 text-gray-600">
  👍 {recommendedCount} of {propertyReviews.length}{" "}
  {propertyReviews.length === 1
    ? "reviewer recommends"
    : "reviewers recommend"}{" "}
  this property.
</p>

<div className="mt-6 space-y-3">
  {[5, 4, 3, 2, 1].map((star) => (
    <div key={star} className="flex items-center gap-3">

      <span className="w-10 text-sm font-medium text-gray-700">
        {star} ★
      </span>

      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">

        <div
          className="h-full rounded-full bg-yellow-400"
          style={{
            width: `${
              (ratingCounts[star as keyof typeof ratingCounts] /
                maxCount) *
              100
            }%`,
          }}
        />

      </div>

      <span className="w-6 text-right text-sm text-gray-600">
        {ratingCounts[star as keyof typeof ratingCounts]}
      </span>

    </div>
  ))}
</div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <h2 className="text-3xl font-bold text-gray-900">
            Reviews ({displayedReviews.length})
          </h2>

          <div className="flex flex-wrap items-center gap-3">

            <select
              value={sort}
              onChange={(e) =>
                setSort(
                  e.target.value as (typeof sortOptions)[number]
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm"
            >
              {sortOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>

            <Link
              href={`/property/${propertySlug}/review`}
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              ✍️ Write Review
            </Link>

          </div>

        </div>

        <div className="flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option}
              onClick={() => setFilter(option)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                filter === option
                  ? "bg-blue-600 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {option}
            </button>
          ))}
        </div>

      </div>

      <div className="mt-6 space-y-6">

        {displayedReviews.length > 0 ? (
          displayedReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
            <h3 className="text-xl font-semibold">
              No reviews found
            </h3>

            <p className="mt-2 text-gray-600">
              Try another filter.
            </p>
          </div>
        )}

      </div>

    </div>
  );
}