import { notFound } from "next/navigation";
import Link from "next/link";

import { properties } from "../../../../data/properties";
import ReviewForm from "../../../../components/review/ReviewForm";

type ReviewPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ReviewPage({
  params,
}: ReviewPageProps) {
  const { slug } = await params;

  const property = properties.find((p) => p.slug === slug);

  if (!property) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white py-12">
      <div className="mx-auto max-w-4xl px-6">

        <Link
          href={`/property/${property.slug}`}
          className="inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          ← Back to Property
        </Link>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">

          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            Share Your Experience
          </h1>

          <p className="mt-3 text-gray-600">
            Help future tenants by sharing your honest experience at{" "}
            <span className="font-medium text-gray-900">
              {property.name}
            </span>.
          </p>

        </div>

        <div className="mt-8">
          <ReviewForm />
        </div>

      </div>
    </main>
  );
}