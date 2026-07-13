import { notFound } from "next/navigation";
import { properties } from "../../../../data/properties";
import ReviewForm from "../../../../components/review/ReviewForm";
import Link from "next/link";

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
    <main className="min-h-screen bg-gray-100 py-10">
      <div className="mx-auto max-w-5xl px-6">

        <Link
  href={`/property/${property.slug}`}
  className="mb-6 inline-block text-[#1B4332] hover:underline"
>
  ← Back to Property
</Link>

        <h1 className="text-5xl font-bold text-gray-900">
          {property.name}
        </h1>

        <p className="mt-2 mb-10 text-lg text-gray-600">
          Share your honest experience to help future tenants.
        </p>

        <ReviewForm />

      </div>
    </main>
  );
}