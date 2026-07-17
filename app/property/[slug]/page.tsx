import Link from "next/link";
import { notFound } from "next/navigation";
import { properties } from "@/data/properties";
import { reviews } from "@/data/reviews";
import ReviewCard from "@/components/property/ReviewCard";


type PropertyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PropertyPage({
  params,
}: PropertyPageProps) {
  const { slug } = await params;

  const property = properties.find((p) => p.slug === slug);

  if (!property) {
    notFound();
  }

  const propertyReviews = reviews.filter(
    (review) => review.propertySlug === property.slug
  );

  const recommendedCount = propertyReviews.filter(
  (review) => review.wouldRecommend
).length;

const recommendationPercentage =
  propertyReviews.length === 0
    ? 0
    : Math.round((recommendedCount / propertyReviews.length) * 100);

  const sortOptions = [
  "Newest",
  "Highest Rated",
  "Lowest Rated",
];

  return (
    <main className="min-h-screen bg-white py-10">
      <div className="mx-auto max-w-5xl px-6">

        {/* Header */}

        <h1 className="text-5xl font-bold text-gray-900">
          {property.name}
        </h1>

        <p className="mt-2 text-lg text-gray-600">
          {property.location}
        </p>

        {/* Trust Score */}

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
          <p className="text-sm uppercase tracking-wider text-gray-500">
            Overall Trust Score
          </p>

          <div className="mt-4 flex items-center gap-4">
            <span className="text-6xl font-bold text-gray-900">
              {property.trustScore}
            </span>

            <div>
              <p className="text-yellow-500 text-xl">★★★★★</p>

              <p className="text-gray-500">
  Based on {propertyReviews.length} verified{" "}
  {propertyReviews.length === 1 ? "review" : "reviews"}
</p>

            </div>
          </div>
        </div>

        {/* Information */}

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Deposit Experience
            </h2>

            <p className="mt-3 text-gray-700">
              {property.depositExperience}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Society Rules
            </h2>

            <p className="mt-3 text-gray-700">
              {property.societyRules}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Rent
            </h2>

            <p className="mt-3 text-3xl font-bold text-gray-900 ">
              {property.rent}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Nearby
            </h2>

            <ul className="mt-3 list-disc pl-5 text-gray-600">
              {property.nearby.map((place) => (
                <li key={place}>{place}</li>
              ))}
            </ul>
          </div>

        </div>

        {/* Reviews */}

        <div className="mt-10">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

  <h2 className="text-3xl font-bold text-gray-900">
    Reviews ({propertyReviews.length})
  </h2>

<div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6">
  <p className="text-2xl font-bold text-green-600">
    {recommendationPercentage}% Recommend
  </p>

  <p className="mt-2 text-gray-600">
    👍 {recommendedCount} of {propertyReviews.length}{" "}
    {propertyReviews.length === 1 ? "reviewer recommends" : "reviewers recommend"} this property.
  </p>
</div>

  <div className="flex items-center gap-3">

    <select
      className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
    >
      {sortOptions.map((option) => (
        <option key={option}>
          {option}
        </option>
      ))}
    </select>

    <Link
      href={`/property/${property.slug}/review`}
      className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
    >
      Share Your Experience
    </Link>

  </div>

</div>

          <div className="mt-6 space-y-6">

  {propertyReviews.length > 0 ? (
    propertyReviews.map((review) => (
      <ReviewCard
        key={review.id}
        review={review}
      />
    ))
  ) : (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <h3 className="text-xl font-semibold text-gray-900">
        No reviews yet
      </h3>

      <p className="mt-2 text-gray-600">
        Be the first tenant to share your experience.
      </p>
    </div>
  )}

</div>
        </div>

      </div>
    </main>
  );
}