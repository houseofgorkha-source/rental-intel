import Link from "next/link";
import { notFound } from "next/navigation";
import PropertyGallery from "@/components/property/PropertyGallery";
import ReviewSection from "@/components/property/ReviewSection";
import PropertyShareButton from "@/components/property/PropertyShareButton";
import ContributionStatusCards from "@/components/property/ContributionStatusCards";
import RelatedProperties from "@/components/property/RelatedProperties";
import type { Review } from "@/components/property/ReviewCard";
import { createClient } from "@/lib/supabase/server";
import { calculateAverageRating, formatINRPerMonth, getPropertyImageUrl } from "@/lib/property-format";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY } from "@/lib/cities";

type PropertyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ verification?: string }>;
};

type ReviewRow = {
  id: string;
  title: string;
  body: string;
  overall_rating: number;
  recommendation: "yes" | "maybe" | "no";
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  stay_start_date: string | null;
  stay_end_date: string | null;
  created_at: string;
  is_anonymous: boolean;
  author: { display_name: string }[];
};

function formatStay(stayStartDate: string | null, stayEndDate: string | null) {
  if (!stayStartDate) return "Stay dates not provided";

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat("en-IN", {
      month: "short",
      year: "numeric",
    }).format(new Date(`${date}T00:00:00`));

  return `${formatDate(stayStartDate)} - ${
    stayEndDate ? formatDate(stayEndDate) : "Present"
  }`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatRent(rent: number | null) {
  return rent === null ? "Not available" : formatINRPerMonth(rent);
}

export default async function PropertyPage({
  params,
  searchParams,
}: PropertyPageProps) {
  const { slug } = await params;
  const { verification } = await searchParams;
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !property) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: propertyImages }, { data: reviewRows }, cityProperties, { data: ownReview }] = await Promise.all([
    supabase
      .from("property_images")
      .select("storage_path, alt_text")
      .eq("property_id", property.id)
      .order("sort_order"),
    supabase
      .from("reviews")
      .select(
        "id, title, body, overall_rating, recommendation, verification_status, stay_start_date, stay_end_date, created_at, is_anonymous, author:profiles!reviews_author_id_fkey(display_name)",
      )
      .eq("property_id", property.id)
      .order("created_at", { ascending: false }),
    getDiscoveryProperties(DEFAULT_CITY),
    // The current viewer's own review on this property, if any — drives the
    // "Review"/"Verify My Stay" status cards below. Readable even on a
    // still-pending property thanks to the "author can read their own
    // review" RLS policy (reviews are otherwise published-property-only).
    user
      ? supabase
          .from("reviews")
          .select("id, verification_status")
          .eq("property_id", property.id)
          .eq("author_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const images =
    propertyImages?.map((image) => ({
      src: getPropertyImageUrl(supabase, image.storage_path),
      alt: image.alt_text ?? property.name,
    })) ?? [];

  const propertyReviews: Review[] = ((reviewRows ?? []) as ReviewRow[]).map(
    (review) => ({
      id: review.id,
      reviewer: review.is_anonymous
        ? "Anonymous"
        : review.author[0]?.display_name ?? "RentalIntel member",
      rating: review.overall_rating,
      title: review.title,
      review: review.body,
      stay: formatStay(review.stay_start_date, review.stay_end_date),
      verified: review.verification_status === "verified",
      date: review.created_at,
      wouldRecommend: review.recommendation === "yes",
    }),
  );

  const recommendedCount = propertyReviews.filter(
    (review) => review.wouldRecommend,
  ).length;
  const recommendationPercentage =
    propertyReviews.length === 0
      ? 0
      : Math.round((recommendedCount / propertyReviews.length) * 100);
  const overallRating = calculateAverageRating(
    propertyReviews.map((review) => review.rating),
  );
  const latestReview = propertyReviews[0];

  // Rent and deposit are only shown as listing facts when they came from an
  // owner listing — that's the only context in which they're an offer rather
  // than an unset column.
  const isOwnerListing = property.submitted_as === "owner";

  // Drives the trust badge below. A verified review is the only evidence this
  // schema holds that anyone has proven they stayed here.
  const hasVerifiedReview = propertyReviews.some((review) => review.verified);

  // Provenance is a self-declared claim, never a verified fact — the owner
  // case says so explicitly, since that's the one with a commercial
  // incentive to misstate it.
  const provenanceLabel =
    property.submitted_as === "owner"
      ? "🏠 Listed by owner (unverified)"
      : property.submitted_as === "tenant"
        ? "🔑 Added by a resident"
        : property.submitted_as === "helper"
          ? "🤝 Added by a community member"
          : null;

  // A property only carries commercial facts when it was submitted as an
  // owner listing. For a tenant or helper contribution asking_rent is
  // structurally always null, so showing "Rent: Not available" stated a
  // missing value where there is no value to miss.
  //
  // `status` is deliberately absent: it is the moderation state, not a fact
  // about the property, and the raw enum ("pending") leaked to every visitor.
  // The creator already sees it, humanised, in ContributionStatusCards.
  const facts = [
    ...(isOwnerListing
      ? [
          { label: "Rent", value: formatRent(property.asking_rent) },
          {
            label: "Security deposit",
            value: formatRent(property.security_deposit),
          },
          {
            label: "Availability",
            value: property.is_available
              ? "Available for rent"
              : "Not currently available",
          },
        ]
      : []),
    { label: "Area", value: property.area },
    { label: "Address", value: property.address_line_1 },
    { label: "Notes", value: property.notes ?? "Not available" },
  ];

  const searchProperties = cityProperties.map((discoveryProperty) => ({
    slug: discoveryProperty.slug,
    name: discoveryProperty.name,
    location: `${discoveryProperty.area}, ${discoveryProperty.city}`,
  }));

  return (
    <main className="min-h-screen bg-[#fbfbfa] pb-20 pt-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link href="/" className="transition hover:text-slate-900">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/property" className="transition hover:text-slate-900">{property.city}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/property" className="transition hover:text-slate-900">{property.area}</Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-slate-900">{property.name}</span>
        </nav>

        {verification === "submitted" && (
          <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Verification submitted. We&apos;ll review your documents.
          </p>
        )}

        <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(17rem,3fr)] lg:items-start">
          {/* min-w-0: a grid item defaults to min-width:auto and refuses to
              shrink below its content's intrinsic minimum, which pushed this
              column to 430px inside a 342px grid at 390px wide and scrolled
              the whole page sideways. Same fix HomeDiscovery already uses. */}
          <div className="min-w-0">
            <section aria-labelledby="property-title">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                Rental property
              </p>
              <h1 id="property-title" className="mt-4 max-w-4xl text-4xl font-medium tracking-[-0.045em] text-slate-950 sm:text-5xl">
                {property.name}
              </h1>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">
                {property.area} <span aria-hidden="true">•</span> {property.city}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
                <span className="font-medium text-slate-950">
                  {overallRating === null ? "No ratings yet" : `${overallRating.toFixed(1)} / 5 overall rating`}
                </span>
                <span className="text-slate-500">
                  {propertyReviews.length} {propertyReviews.length === 1 ? "review" : "reviews"}
                </span>
                {/* Only shown when a review on this property has actually
                    been verified. It previously rendered unconditionally —
                    including on properties with no reviews at all — which
                    asserted a trust signal the data did not support. Named
                    for the signal it uses, not a vaguer "Community
                    verified". */}
                {hasVerifiedReview && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
                    ✓ Verified resident review
                  </span>
                )}
                {provenanceLabel && (
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-600">
                    {provenanceLabel}
                  </span>
                )}
              </div>

              <div className="mt-7 flex flex-col gap-4 lg:hidden">
                <ContributionStatusCards
                  propertySlug={property.slug}
                  propertyStatus={property.status}
                  submittedAs={property.submitted_as}
                  isAvailable={property.is_available}
                  ownReview={ownReview}
                />
                <PropertyShareButton propertyName={property.name} />
              </div>
            </section>

            <PropertyGallery images={images} />

            <section aria-labelledby="quick-facts-heading" className="mt-14 border-t border-slate-200 pt-10">
              <div className="max-w-2xl">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">At a glance</p>
                <h2 id="quick-facts-heading" className="mt-3 text-3xl font-medium tracking-[-0.035em] text-slate-950">Quick facts</h2>
              </div>
              <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
                {facts.map((fact) => (
                  <div key={fact.label} className="bg-white p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.13em] text-slate-500">{fact.label}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-900">{fact.value}</p>
                  </div>
                ))}
                {property.maps_url && (
                  <a href={property.maps_url} target="_blank" rel="noreferrer" className="bg-white p-5 transition hover:bg-slate-50">
                    <p className="text-xs font-medium uppercase tracking-[0.13em] text-slate-500">Maps</p>
                    <p className="mt-2 text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-4">Open location</p>
                  </a>
                )}
              </div>
            </section>

            <section aria-labelledby="score-heading" className="mt-14 border-t border-slate-200 pt-10">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">RentalIntel score</p>
              <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                  <h2 id="score-heading" className="text-3xl font-medium tracking-[-0.035em] text-slate-950">The renter&apos;s view, in one place.</h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">A clearer score is coming as this property receives more community input.</p>
                </div>
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-4 text-sm font-medium text-slate-600">Coming Soon</div>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {["Owner", "Deposit", "Water", "Noise", "Security", "Maintenance"].map((metric) => (
                  <div key={metric} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                    <p className="text-sm font-medium text-slate-700">{metric}</p>
                    <p className="mt-2 text-xs text-slate-500">Coming Soon</p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="highlights-heading" className="mt-14 border-t border-slate-200 pt-10">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Community highlights</p>
              <h2 id="highlights-heading" className="mt-3 text-3xl font-medium tracking-[-0.035em] text-slate-950">Built from lived experience.</h2>
              <p className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-6 text-sm leading-6 text-slate-600">Community insights will appear as more reviews are submitted.</p>
            </section>

            <section id="reviews" aria-label="Property reviews" className="mt-14 border-t border-slate-200 pt-1">
              <ReviewSection propertySlug={property.slug} propertyReviews={propertyReviews} recommendationPercentage={recommendationPercentage} recommendedCount={recommendedCount} canWriteReview={(property.status === "published" || property.created_by === user?.id) && !(isOwnerListing && property.created_by === user?.id)} />
            </section>

            <section aria-labelledby="timeline-heading" className="mt-14 border-t border-slate-200 pt-10">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Timeline</p>
              <h2 id="timeline-heading" className="mt-3 text-3xl font-medium tracking-[-0.035em] text-slate-950">Property history</h2>
              <div className="mt-7 space-y-5 border-l border-slate-200 pl-5">
                <div><p className="text-sm font-medium text-slate-900">Property added</p><p className="mt-1 text-sm text-slate-500">{formatDate(property.created_at)}</p></div>
                {latestReview && <div><p className="text-sm font-medium text-slate-900">Latest review</p><p className="mt-1 text-sm text-slate-500">{formatDate(latestReview.date)}</p></div>}
                <div><p className="text-sm font-medium text-slate-900">Last updated</p><p className="mt-1 text-sm text-slate-500">{formatDate(property.updated_at)}</p></div>
              </div>
            </section>

            <p className="mt-14 border-t border-slate-200 pt-10 text-sm text-slate-600">
              Didn&apos;t find what you&apos;re looking for?{" "}
              <Link
                href="/property"
                className="font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
              >
                Search more properties →
              </Link>
            </p>

            <RelatedProperties
              currentSlug={property.slug}
              area={property.area}
              city={property.city}
              properties={cityProperties}
              searchProperties={searchProperties}
            />
          </div>

          <aside className="hidden lg:sticky lg:top-8 lg:block">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-40px_rgba(15,23,42,0.4)]">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Your next step</p>
              <div className="mt-5 flex flex-col gap-3">
                <ContributionStatusCards
                  propertySlug={property.slug}
                  propertyStatus={property.status}
                  submittedAs={property.submitted_as}
                  isAvailable={property.is_available}
                  ownReview={ownReview}
                />
                <PropertyShareButton propertyName={property.name} />
              </div>
              <div className="mt-7 border-t border-slate-100 pt-6">
                <p className="text-sm font-medium text-slate-950">RentalIntel Score</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">A property score will be available as more renter experiences are shared.</p>
              </div>
              <div className="mt-6 border-t border-slate-100 pt-6">
                <p className="text-sm font-medium text-slate-950">{property.area}, {property.city}</p>
                <p className="mt-2 text-sm text-slate-500">{formatRent(property.asking_rent)}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
