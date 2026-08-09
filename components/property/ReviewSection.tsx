"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ReviewCard, { type Review } from "@/components/property/ReviewCard";

type Props = {
  propertySlug: string;
  propertyReviews: Review[];
  recommendationPercentage: number;
  recommendedCount: number;
  canWriteReview: boolean;
};

const sortOptions = ["Newest", "Highest Rated", "Lowest Rated"] as const;
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
  canWriteReview,
}: Props) {
  const [filter, setFilter] =
    useState<(typeof filterOptions)[number]>("All");
  const [sort, setSort] = useState<(typeof sortOptions)[number]>("Newest");

  const displayedReviews = useMemo(() => {
    let data = [...propertyReviews];

    switch (filter) {
      case "Verified":
        data = data.filter((review) => review.verified);
        break;
      case "Recommended":
        data = data.filter((review) => review.wouldRecommend);
        break;
      case "Not Recommended":
        data = data.filter((review) => !review.wouldRecommend);
        break;
      case "5 Stars":
        data = data.filter((review) => review.rating === 5);
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
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        );
    }

    return data;
  }, [filter, propertyReviews, sort]);

  const ratingCounts = {
    5: propertyReviews.filter((review) => review.rating === 5).length,
    4: propertyReviews.filter((review) => review.rating === 4).length,
    3: propertyReviews.filter((review) => review.rating === 3).length,
    2: propertyReviews.filter((review) => review.rating === 2).length,
    1: propertyReviews.filter((review) => review.rating === 1).length,
  };
  const maxCount = Math.max(...Object.values(ratingCounts), 1);

  return (
    <div className="mt-10">
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
              Community reviews
            </p>
            <h2 className="mt-3 text-3xl font-medium tracking-[-0.035em] text-foreground">
              Reviews ({displayedReviews.length})
            </h2>
          </div>

          {canWriteReview ? (
            <Link
              href={`/property/${propertySlug}/review`}
              className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-accent-hover"
            >
              Write Review
            </Link>
          ) : (
            <p className="text-sm font-medium text-muted">Pending approval</p>
          )}
        </div>

        <div className="grid gap-7 rounded-2xl border border-border-subtle bg-surface p-6 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]">
          <div>
            <p className="text-4xl font-medium tracking-[-0.04em] text-foreground">
              {recommendationPercentage}%
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              recommend this property
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              {recommendedCount} of {propertyReviews.length}{" "}
              {propertyReviews.length === 1 ? "reviewer recommends" : "reviewers recommend"}{" "}
              this property.
            </p>
          </div>

          <div className="space-y-2.5">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-muted">
                  {star} ★
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-accent-hover"
                    style={{
                      width: `${
                        (ratingCounts[star as keyof typeof ratingCounts] /
                          maxCount) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <span className="w-5 text-right text-sm text-muted">
                  {ratingCounts[star as keyof typeof ratingCounts]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${
                  filter === option
                    ? "bg-accent text-white"
                    : "border border-border-subtle bg-surface text-muted hover:bg-surface-raised"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only">Sort reviews</span>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as (typeof sortOptions)[number])
              }
              className="rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm font-medium text-foreground outline-none transition focus:border-muted"
            >
              {sortOptions.map((option) => (
                <option key={option} className="bg-surface text-foreground">
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mt-7 space-y-5">
        {displayedReviews.length > 0 ? (
          displayedReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border-subtle bg-surface p-8 text-center">
            <h3 className="text-lg font-medium text-foreground">No reviews found</h3>
            <p className="mt-2 text-sm text-muted">Try another filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
