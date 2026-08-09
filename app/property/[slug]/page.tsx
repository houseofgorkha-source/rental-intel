import Link from "next/link";
import { notFound } from "next/navigation";
import PropertyGallery from "@/components/property/PropertyGallery";
import ReviewSection from "@/components/property/ReviewSection";
import PropertyShareButton from "@/components/property/PropertyShareButton";
import ContributionStatusCards from "@/components/property/ContributionStatusCards";
import WishlistButton from "@/components/property/WishlistButton";
import ContactContributor from "@/components/property/ContactContributor";
import { isContactMethod } from "@/lib/property-attributes";
import RelatedProperties from "@/components/property/RelatedProperties";
import type { Review } from "@/components/property/ReviewCard";
import { createClient } from "@/lib/supabase/server";
import { calculateAverageRating, formatINRPerMonth, getPropertyImageUrl } from "@/lib/property-format";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { one } from "@/lib/embedded";
import { DEFAULT_CITY } from "@/lib/cities";

type PropertyPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ verification?: string; wishlist?: string }>;
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
  author: { display_name: string } | { display_name: string }[] | null;
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
  const { verification, wishlist } = await searchParams;
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

  // Both are signed-in-only queries, deliberately kept out of the Promise.all
  // above so a signed-out visitor issues neither. property_contacts has no
  // policy for anon at all, so this is belt and braces on top of RLS: contact
  // details never enter the render for somebody without an account.
  const isContributor = property.created_by === user?.id;
  const contactMethod = isContactMethod(property.contact_method)
    ? property.contact_method
    : "none";

  const [{ data: wishlistRow }, { data: contactDetails }] = await Promise.all([
    user
      ? supabase
          .from("wishlists")
          .select("property_id")
          .eq("property_id", property.id)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user && (contactMethod === "phone" || contactMethod === "email")
      ? supabase
          .from("property_contacts")
          .select("phone, email")
          .eq("property_id", property.id)
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
      // `one()` because PostgREST returns this many-to-one embed as an
      // object — indexing it as an array quietly attributed every named
      // review to "RentalIntel member". See lib/embedded.ts.
      reviewer: review.is_anonymous
        ? "Anonymous"
        : one(review.author)?.display_name ?? "RentalIntel member",
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
    // Only rendered when answered. An unanswered attribute is a question
    // nobody got to, not a missing value, and "Configuration: Not available"
    // reads as a defect in the property rather than a gap in what we know.
    ...(property.configuration
      ? [{ label: "Configuration", value: property.configuration }]
      : []),
    ...(property.property_type
      ? [{ label: "Property type", value: property.property_type }]
      : []),
    ...(property.furnishing ? [{ label: "Furnishing", value: property.furnishing }] : []),
    ...(property.carpet_area_sqft
      ? [{ label: "Built-up area", value: `${property.carpet_area_sqft} sq.ft` }]
      : []),
    { label: "Area", value: property.area },
    { label: "Address", value: property.address_line_1 },
    // Landmark is its own fact now. `notes` is only rendered for rows
    // submitted before the landmark field existed — the column still holds
    // real contributed text and dropping it would lose it. Neither row is
    // shown as "Not available": an absent landmark is not a missing value,
    // it is a question that wasn't answered.
    ...(property.landmark ? [{ label: "Landmark", value: property.landmark }] : []),
    ...(property.notes ? [{ label: "Notes", value: property.notes }] : []),
  ];

  // Rendered in both the mobile block and the desktop sidebar. Built once so
  // the two placements can never drift into offering different actions.
  const viewerActions = (
    <>
      <WishlistButton
        slug={property.slug}
        isSignedIn={Boolean(user)}
        initialSaved={Boolean(wishlistRow)}
        pendingSave={wishlist === "add"}
      />
      <ContactContributor
        slug={property.slug}
        contactMethod={contactMethod}
        submittedAs={property.submitted_as}
        isSignedIn={Boolean(user)}
        phone={contactDetails?.phone ?? null}
        email={contactDetails?.email ?? null}
        isOwnContribution={isContributor}
      />
    </>
  );

  const searchProperties = cityProperties.map((discoveryProperty) => ({
    slug: discoveryProperty.slug,
    name: discoveryProperty.name,
    location: `${discoveryProperty.area}, ${discoveryProperty.city}`,
  }));

  return (
    <main className="min-h-screen bg-background pb-20 pt-28">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <Link href="/" className="transition hover:text-foreground">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/property" className="transition hover:text-foreground">{property.city}</Link>
          <span aria-hidden="true">/</span>
          <Link href="/property" className="transition hover:text-foreground">{property.area}</Link>
          <span aria-hidden="true">/</span>
          <span className="truncate text-foreground">{property.name}</span>
        </nav>

        {verification === "submitted" && (
          <p className="mt-6 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success">
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
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Rental property
              </p>
              <h1 id="property-title" className="mt-4 max-w-4xl text-4xl font-medium tracking-[-0.045em] text-foreground sm:text-5xl">
                {property.name}
              </h1>
              <p className="mt-4 text-base text-muted sm:text-lg">
                {property.area} <span aria-hidden="true">•</span> {property.city}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
                <span className="font-medium text-foreground">
                  {overallRating === null ? "No ratings yet" : `${overallRating.toFixed(1)} / 5 overall rating`}
                </span>
                <span className="text-muted">
                  {propertyReviews.length} {propertyReviews.length === 1 ? "review" : "reviews"}
                </span>
                {/* Only shown when a review on this property has actually
                    been verified. It previously rendered unconditionally —
                    including on properties with no reviews at all — which
                    asserted a trust signal the data did not support. Named
                    for the signal it uses, not a vaguer "Community
                    verified". */}
                {hasVerifiedReview && (
                  <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1.5 font-medium text-success">
                    ✓ Verified resident review
                  </span>
                )}
                {provenanceLabel && (
                  <span className="rounded-full border border-border-subtle bg-surface px-3 py-1.5 font-medium text-muted">
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
                {viewerActions}
                <PropertyShareButton propertyName={property.name} />
              </div>
            </section>

            <PropertyGallery images={images} />

            <section aria-labelledby="quick-facts-heading" className="mt-14 border-t border-border-subtle pt-10">
              <div className="max-w-2xl">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">At a glance</p>
                <h2 id="quick-facts-heading" className="mt-3 text-3xl font-medium tracking-[-0.035em] text-foreground">Quick facts</h2>
              </div>
              <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-border-subtle bg-surface-raised sm:grid-cols-2">
                {facts.map((fact) => (
                  <div key={fact.label} className="bg-surface p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.13em] text-muted">{fact.label}</p>
                    <p className="mt-2 text-sm leading-6 text-foreground">{fact.value}</p>
                  </div>
                ))}
                {property.maps_url && (
                  <a href={property.maps_url} target="_blank" rel="noreferrer" className="bg-surface p-5 transition hover:bg-surface-raised">
                    <p className="text-xs font-medium uppercase tracking-[0.13em] text-muted">Maps</p>
                    <p className="mt-2 text-sm font-medium text-foreground underline decoration-border-subtle underline-offset-4">Open location</p>
                  </a>
                )}
              </div>
            </section>

            <section aria-labelledby="score-heading" className="mt-14 border-t border-border-subtle pt-10">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">RentalIntel score</p>
              <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
                <div>
                  <h2 id="score-heading" className="text-3xl font-medium tracking-[-0.035em] text-foreground">The renter&apos;s view, in one place.</h2>
                  <p className="mt-3 text-sm leading-6 text-muted">A clearer score is coming as this property receives more community input.</p>
                </div>
                <div className="rounded-2xl border border-dashed border-border-subtle bg-surface px-5 py-4 text-sm font-medium text-muted">Coming Soon</div>
              </div>
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {["Owner", "Deposit", "Water", "Noise", "Security", "Maintenance"].map((metric) => (
                  <div key={metric} className="rounded-xl border border-border-subtle bg-surface px-4 py-4">
                    <p className="text-sm font-medium text-muted">{metric}</p>
                    <p className="mt-2 text-xs text-muted">Coming Soon</p>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="highlights-heading" className="mt-14 border-t border-border-subtle pt-10">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Community highlights</p>
              <h2 id="highlights-heading" className="mt-3 text-3xl font-medium tracking-[-0.035em] text-foreground">Built from lived experience.</h2>
              <p className="mt-5 rounded-2xl border border-border-subtle bg-surface px-5 py-6 text-sm leading-6 text-muted">Community insights will appear as more reviews are submitted.</p>
            </section>

            <section id="reviews" aria-label="Property reviews" className="mt-14 border-t border-border-subtle pt-1">
              <ReviewSection propertySlug={property.slug} propertyReviews={propertyReviews} recommendationPercentage={recommendationPercentage} recommendedCount={recommendedCount} canWriteReview={(property.status === "published" || property.created_by === user?.id) && !(isOwnerListing && property.created_by === user?.id)} />
            </section>

            <section aria-labelledby="timeline-heading" className="mt-14 border-t border-border-subtle pt-10">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Timeline</p>
              <h2 id="timeline-heading" className="mt-3 text-3xl font-medium tracking-[-0.035em] text-foreground">Property history</h2>
              <div className="mt-7 space-y-5 border-l border-border-subtle pl-5">
                <div><p className="text-sm font-medium text-foreground">Property added</p><p className="mt-1 text-sm text-muted">{formatDate(property.created_at)}</p></div>
                {latestReview && <div><p className="text-sm font-medium text-foreground">Latest review</p><p className="mt-1 text-sm text-muted">{formatDate(latestReview.date)}</p></div>}
                <div><p className="text-sm font-medium text-foreground">Last updated</p><p className="mt-1 text-sm text-muted">{formatDate(property.updated_at)}</p></div>
              </div>
            </section>

            <p className="mt-14 border-t border-border-subtle pt-10 text-sm text-muted">
              Didn&apos;t find what you&apos;re looking for?{" "}
              <Link
                href="/property"
                className="font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent"
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
            <div className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-[0_20px_50px_-40px_rgba(14,143,94,0.4)]">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Your next step</p>
              <div className="mt-5 flex flex-col gap-3">
                <ContributionStatusCards
                  propertySlug={property.slug}
                  propertyStatus={property.status}
                  submittedAs={property.submitted_as}
                  isAvailable={property.is_available}
                  ownReview={ownReview}
                />
                {viewerActions}
                <PropertyShareButton propertyName={property.name} />
              </div>
              <div className="mt-7 border-t border-border-subtle pt-6">
                <p className="text-sm font-medium text-foreground">RentalIntel Score</p>
                <p className="mt-2 text-sm leading-6 text-muted">A property score will be available as more renter experiences are shared.</p>
              </div>
              <div className="mt-6 border-t border-border-subtle pt-6">
                <p className="text-sm font-medium text-foreground">{property.area}, {property.city}</p>
                <p className="mt-2 text-sm text-muted">{formatRent(property.asking_rent)}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
