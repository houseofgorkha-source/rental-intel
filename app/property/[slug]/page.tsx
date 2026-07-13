import { properties } from "../../../data/properties";
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

  return (
    <main className="min-h-screen bg-gray-100 py-10">
      <div className="mx-auto max-w-5xl px-6">

        <h1 className="text-5xl font-bold text-gray-900">
          {property.name}
        </h1>

        <p className="mt-2 text-lg text-gray-600">
          {property.location}
        </p>

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

        <div className="mt-8 grid gap-6 md:grid-cols-2">

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              Deposit Experience
            </h2>

            <p className="mt-3 text-yellow-500 text-xl">
              {property.depositExperience}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              Society Rules
            </h2>

            <p className="mt-3 text-yellow-500 text-xl">
              {property.societyRules}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              Rent
            </h2>

            <p className="mt-3 text-3xl font-bold text-[#1B4332]">
              {property.rent}
            </p>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold">
              Nearby
            </h2>

            <ul className="mt-3 list-disc pl-5 text-gray-600">
              {property.nearby.map((place) => (
                <li key={place}>{place}</li>
              ))}
            </ul>
          </div>

        </div>

      </div>
    </main>
  );
}