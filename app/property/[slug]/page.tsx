import Link from "next/link";
import { notFound } from "next/navigation";
import { reviews } from "@/data/reviews";
import PropertyGallery from "@/components/property/PropertyGallery";
import ReviewSection from "@/components/property/ReviewSection";
import { createClient } from "@/lib/supabase/server";

type PropertyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PropertyPage({
  params,
}: PropertyPageProps) {
  const { slug } = await params;

const supabase = await createClient();

const { data: property, error } = await supabase
  .from("properties")
  .select("*")
  .eq("slug", slug)
  .eq("status", "published")
  .single();

if (error || !property) {
  notFound();
}

const { data: propertyImages } = await supabase
  .from("property_images")
  .select("storage_path, alt_text")
  .eq("property_id", property.id)
  .order("sort_order");

const images =
  propertyImages?.map((image) => {
    const {
      data: { publicUrl },
    } = supabase.storage
      .from("property-images")
      .getPublicUrl(image.storage_path);

    return {
      src: publicUrl,
      alt: image.alt_text ?? property.name,
    };
  }) ?? [];

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

    return (
    <main className="min-h-screen bg-white py-10">
       <div className="mx-auto max-w-5xl px-6">

        {/* Header */}

        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to Search
        </Link>

        <h1 className="mt-6 text-5xl font-bold text-gray-900">
          {property.name}
        </h1>

        <p className="mt-2 text-lg text-gray-600">
          {property.area}, {property.city}, {property.state}
        </p>

        <PropertyGallery images={images} />

        

        {/* Trust Score */}

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8">
          <p className="text-sm uppercase tracking-wider text-gray-500">
            Overall Trust Score
          </p>

          <div className="mt-4 flex items-center gap-4">
            <span className="text-6xl font-bold text-gray-900">
              {recommendationPercentage}%
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
              Not available
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Society Rules
            </h2>

            <p className="mt-3 text-gray-700">
              Not available
            </p>
          </div>

          <div className="rounded-3xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Rent
            </h2>

            <p className="mt-3 text-3xl font-bold text-gray-900 ">
              {property.asking_rent === null
                ? "Not available"
                : `₹${property.asking_rent.toLocaleString("en-IN")}/month`}
            </p>
          </div>

        <div className="rounded-3xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">
            Nearby
          </h2>

          <p className="mt-3 text-gray-700">
            Not available
          </p>
        </div>

        </div>

        {/* Reviews */}

<ReviewSection
  propertySlug={property.slug}
  propertyReviews={propertyReviews}
  recommendationPercentage={recommendationPercentage}
  recommendedCount={recommendedCount}
/>

    </div>
  </main>
  );
}
