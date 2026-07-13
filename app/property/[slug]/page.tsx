import { properties } from "../../../data/properties";
import { reviews } from "../../../data/reviews";
import { notFound } from "next/navigation";

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

        {/* Property Header */}

        <h1 className="text-5xl font-bold text-gray-900">
          {property.name}
        </h1>

        <p className="mt-2 text-lg text-gray-600">
          {property.location}
        </p>

        {/* Trust Score */}

        <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-8 shadow-lg">

          <p className="text-sm font-semibold uppercase tracking-widest text-gray-500">
            Overall Trust Score
          </p>

          <div className="mt-3 flex items-center gap-4">
            <span className="text-6xl font-extrabold text-[#1B4332]">
              {property.trustScore}
            </span>

            <div>
              <p className="text-xl text-yellow-500">★★★★★</p>
              <p className="text-gray-500">
                Based on verified tenant reviews
              </p>
            </div>
          </div>

        </div>

        {/* Information Cards */}

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Deposit Experience
            </h2>

            <p className="mt-3 text-xl text-yellow-500">
              {property.depositExperience}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Society Rules
            </h2>

            <p className="mt-3 text-xl text-yellow-500">
              {property.societyRules}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">
              Rent
            </h2>

            <p className="mt-3 text-3xl font-bold text-[#1B4332]">
              {property.rent}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
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

          <h2 className="mb-6 text-3xl font-bold text-gray-900">
            Verified Tenant Reviews
          </h2>

          <div className="space-y-6">

            {propertyReviews.map((review) => (
              <div
                key={review.id}
                className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
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

                <div className="mt-4 flex gap-4 text-sm text-gray-500">

                  <span>✅ {review.reviewer}</span>

                  <span>{review.stay}</span>

                </div>

              </div>
            ))}

          </div>

        </div>

      </div>
    </main>
  );
}