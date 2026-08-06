import Link from "next/link";
import { PropertyList } from "@/components/property/PropertyDiscovery";
import DetailPageSearch from "@/components/property/DetailPageSearch";
import type { DiscoveryProperty } from "@/lib/property-discovery";

type SearchProperty = { slug: string; name: string; location: string };

type RelatedPropertiesProps = {
  currentSlug: string;
  area: string;
  city: string;
  properties: DiscoveryProperty[];
  searchProperties: SearchProperty[];
};

// --- Filtering logic, isolated from the JSX below ---------------------------
// Each function is a stand-in for a future dedicated query
// (getSimilarProperties(), getTopReviewedProperties(), etc.) that would run
// server-side against real signals — see CLAUDE.md's "Related Properties"
// section for the full list of future ranking signals under consideration
// (trust score, verified reviews, recent activity, popularity). Swapping
// those in later only touches this block — PropertyList and the section
// markup below don't change, they just render whatever array each function
// returns.

// "Similar" currently means "same area" — the schema has no other
// similarity signal yet (no price-band, bedroom-count, or amenity data to
// score against). A hypothetical getAreaProperties() would compute the same
// thing today, so it isn't defined as a separate function: two functions
// returning identical data would just tempt someone into rendering two
// identical-looking sections later, which is exactly what section 2 of this
// change asks to avoid. Split it out once a real similarity signal exists.
function getSimilarProperties(
  properties: DiscoveryProperty[],
  currentSlug: string,
  area: string,
): DiscoveryProperty[] {
  return properties.filter((property) => property.slug !== currentSlug && property.area === area);
}

// "Top Reviewed" uses review count (falling back to rating) as its signal —
// that's real data already in the schema, named for exactly what it is
// rather than "Popular" (which would imply view/save counts that don't
// exist yet). `excludeSlugs` keeps this from repeating whatever
// getSimilarProperties() already surfaced above it.
function getTopReviewedProperties(
  properties: DiscoveryProperty[],
  currentSlug: string,
  excludeSlugs: Set<string>,
): DiscoveryProperty[] {
  return properties
    .filter((property) => property.slug !== currentSlug && !excludeSlugs.has(property.slug))
    .slice()
    .sort(
      (a, b) =>
        b.reviewCount - a.reviewCount || (b.averageRating ?? 0) - (a.averageRating ?? 0),
    );
}

// The property detail page's "keep going" module: the reusable search
// widget (DetailPageSearch — same HomeSearch/FiltersButton as everywhere
// else, not a new implementation) plus whichever discovery sections above
// actually have distinct content to show.
export default function RelatedProperties({
  currentSlug,
  area,
  city,
  properties,
  searchProperties,
}: RelatedPropertiesProps) {
  const similar = getSimilarProperties(properties, currentSlug, area);
  const topReviewed = getTopReviewedProperties(
    properties,
    currentSlug,
    new Set(similar.map((property) => property.slug)),
  );

  return (
    <section aria-labelledby="related-properties-heading" className="mt-14 border-t border-slate-200 pt-10">
      <h2 id="related-properties-heading" className="text-3xl font-medium tracking-[-0.035em] text-slate-950">
        Continue Exploring
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
        Search by city, area, or budget — or browse a few more homes below.
      </p>

      <div className="mt-7">
        <DetailPageSearch properties={searchProperties} />
      </div>

      {(similar.length > 0 || topReviewed.length > 0) && (
        <div className="mt-10 flex flex-col gap-10">
          {similar.length > 0 && (
            <PropertyList
              properties={similar.slice(0, 6)}
              heading={`Similar properties in ${area}`}
              compact
            />
          )}
          {topReviewed.length > 0 && (
            <PropertyList
              properties={topReviewed.slice(0, 6)}
              heading={`Top Reviewed in ${city}`}
              compact
            />
          )}
        </div>
      )}

      <Link
        href={`/property?city=${encodeURIComponent(city)}`}
        className="mt-8 inline-flex text-sm font-medium text-blue-600 underline decoration-blue-200 underline-offset-4 transition hover:text-blue-700 hover:decoration-blue-400"
      >
        Browse all properties in {city}
      </Link>
    </section>
  );
}
