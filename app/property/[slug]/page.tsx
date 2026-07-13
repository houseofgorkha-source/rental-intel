import Link from "next/link";
import { notFound } from "next/navigation";
import { properties } from "@/data/properties";
import { reviews } from "@/data/reviews";

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

  return (
    <main className="min-h-screen bg-gray-100 py-10">
      <div className="mx-auto max-w-5xl px-6">

        {/* Header */}

        <h1 className="text-5xl font-bold text-gray-900">
          {property.name}
        </h1>

        <p className="mt-2 text-lg text-gray-600">
          {property.location}
        </p>

        {/* Trust Score */}

        <div className="mt-8 rounded-3xl bg-white p-8 shadow-lg">
          <p className="text-sm uppercase tracking-wider text-gray-500">
            Overall Trust Score
          </p>

          <div className="mt-4 flex items-center gap-4">
            <span className="text-6xl font-bold text-[#1B4332]">
              {property.trustScore}
            </span>

            <div>
              <p className="text-yellow-500 text-xl">★★★★★</p>

              <p className="text-gray-500">
                Based on verified tenant reviews
              </p>
            </div>
          </div>
        </div>

        {/* Information */}

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Deposit Experience
            </h2>

            <p className="mt-3 text-yellow-500">
              {property.depositExperience}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Society Rules
            </h2>

            <p className="mt-3 text-yellow-500">
              {property.societyRules}
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Rent
            </h2>

            <p className="mt-3 text-3xl font-bold text-[#1B4332]">
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

          <div className="flex items-center justify-between">

            <h2 className="text-3xl font-bold text-gray-900">
              Reviews
            </h2>

            <Link
              href={`/property/${property.slug}/review`}
              className="rounded-xl bg-[#1B4332] px-5 py-3 font-semibold text-white hover:bg-[#2D6A4F]"
            >
              Share Your Experience
            </Link>

          </div>

          <div className="mt-6 space-y-6">

            {propertyReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-3xl bg-white p-6 shadow"
              >

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
            ))}

          </div>

        </div>

      </div>
    </main>
  );
}