import { createClient } from "@/lib/supabase/server";
import { CITY_NAME_ALIASES, DEFAULT_CITY } from "@/lib/cities";
import { calculateAverageRating, getPropertyImageUrl } from "@/lib/property-format";
import { getAreaCoordinates, type Coordinates } from "@/lib/area-coordinates";
import type {
  Amenity,
  Furnishing,
  PropertyConfiguration,
  PropertyType,
} from "@/lib/property-attributes";

export type DiscoveryProperty = {
  slug: string;
  name: string;
  area: string;
  city: string;
  askingRent: number | null;
  image: { src: string; alt: string } | null;
  averageRating: number | null;
  reviewCount: number;
  // Only an owner listing is a claim that the property is available to rent;
  // a tenant/helper contribution is knowledge, not a vacancy ad. Both are
  // needed to decide whether the "Available for rent" badge is truthful.
  submittedAs: "owner" | "tenant" | "helper" | null;
  isAvailable: boolean;
  // The filterable attributes. All nullable because they are only collected
  // from submissions made after 20260810000000 — a null is excluded from a
  // positive filter rather than treated as a match, so an older property
  // never pretends to be a 2 BHK.
  configuration: PropertyConfiguration | null;
  propertyType: PropertyType | null;
  furnishing: Furnishing | null;
  carpetAreaSqft: number | null;
  securityDeposit: number | null;
  // Empty when the property has none, never null — the column itself is
  // `not null default '{}'`, so there is no "not answered yet" state to
  // preserve the way there is for configuration/propertyType/furnishing.
  amenities: Amenity[];
  // Backs the "Listed on" filter. This is when the property was added to
  // RentalIntel, which is the only date the schema holds — it is not a
  // listing date on any external portal.
  createdAt: string;
  // Approximate — the area's centroid, not the property's real address.
  // See lib/area-coordinates.ts for why (no lat/lng column exists yet).
  coordinates: Coordinates | null;
};

type PropertyRow = {
  id: string;
  slug: string;
  name: string;
  area: string;
  city: string;
  asking_rent: number | null;
  created_at: string;
};

type ImageRow = {
  property_id: string;
  storage_path: string;
  alt_text: string;
};

type ReviewRow = {
  property_id: string;
  overall_rating: number;
};

type ListingRow = {
  id: string;
  is_available: boolean;
  submitted_as: "owner" | "tenant" | "helper" | null;
  configuration: PropertyConfiguration | null;
  property_type: PropertyType | null;
  furnishing: Furnishing | null;
  carpet_area_sqft: number | null;
  security_deposit: number | null;
  latitude: number | null;
  longitude: number | null;
  amenities: Amenity[] | null;
};

// Shared by every caller that already has a set of property rows and needs
// them turned into full DiscoveryProperty objects (images, reviews,
// availability/attributes) — getDiscoveryProperties (a city) and
// getWishlistedProperties (a specific id list) differ only in how they
// arrive at `properties`, not in what happens to them afterwards. Keeping
// this as one function is what stops the two from silently drifting apart
// the way the filter panel and the query it fed once did.
async function enrichProperties(
  supabase: Awaited<ReturnType<typeof createClient>>,
  properties: PropertyRow[],
): Promise<DiscoveryProperty[]> {
  const propertyIds = properties.map((property) => property.id);
  const [imagesResult, reviewsResult, availabilityResult] = propertyIds.length
    ? await Promise.all([
        supabase
          .from("property_images")
          .select("property_id, storage_path, alt_text")
          .in("property_id", propertyIds)
          .order("sort_order"),
        supabase
          .from("reviews")
          .select("property_id, overall_rating")
          .in("property_id", propertyIds),
        // Queried separately from the main properties fetch: these columns
        // arrived across several migrations and may not exist yet on every
        // environment. PostgREST fails the WHOLE query with 42703 when a
        // select names a missing column, so keeping them here means an
        // unapplied migration degrades the attribute filters rather than
        // emptying the property list itself. Every property then falls back to
        // "available, unknown provenance, no attributes" below, which renders
        // no availability badge and matches no positive attribute filter.
        supabase
          .from("properties")
          .select(
            "id, is_available, submitted_as, configuration, property_type, furnishing, carpet_area_sqft, security_deposit, latitude, longitude, amenities",
          )
          .in("id", propertyIds),
      ])
    : [{ data: [] }, { data: [] }, { data: null, error: null }];

  const firstImageByProperty = new Map<string, ImageRow>();
  ((imagesResult.data ?? []) as ImageRow[]).forEach((image) => {
    if (!firstImageByProperty.has(image.property_id)) {
      firstImageByProperty.set(image.property_id, image);
    }
  });

  const reviewsByProperty = new Map<string, ReviewRow[]>();
  ((reviewsResult.data ?? []) as ReviewRow[]).forEach((review) => {
    const reviews = reviewsByProperty.get(review.property_id) ?? [];
    reviews.push(review);
    reviewsByProperty.set(review.property_id, reviews);
  });

  const listingByProperty = new Map<string, ListingRow>();
  if (!availabilityResult.error) {
    ((availabilityResult.data ?? []) as ListingRow[]).forEach((row) => {
      listingByProperty.set(row.id, row);
    });
  }

  return properties.map((property) => {
    const listing = listingByProperty.get(property.id);
    const image = firstImageByProperty.get(property.id);
    const reviews = reviewsByProperty.get(property.id) ?? [];
    const averageRating = calculateAverageRating(
      reviews.map((review) => review.overall_rating),
    );

    return {
      slug: property.slug,
      name: property.name,
      area: property.area,
      city: property.city,
      askingRent: property.asking_rent,
      image: image
        ? {
            src: getPropertyImageUrl(supabase, image.storage_path),
            alt: image.alt_text || property.name,
          }
        : null,
      averageRating,
      reviewCount: reviews.length,
      submittedAs: listing?.submitted_as ?? null,
      isAvailable: listing?.is_available ?? true,
      configuration: listing?.configuration ?? null,
      propertyType: listing?.property_type ?? null,
      furnishing: listing?.furnishing ?? null,
      carpetAreaSqft: listing?.carpet_area_sqft ?? null,
      securityDeposit: listing?.security_deposit ?? null,
      amenities: listing?.amenities ?? [],
      createdAt: property.created_at,
      // An exact pin (see PropertyLocationField) wins whenever both values
      // are present; otherwise the area centroid, same as before this
      // column existed. Never a partial pin — one coordinate without the
      // other isn't a usable point, and the write side (getCoordinates in
      // app/actions/property.ts) already only ever stores both or neither.
      coordinates:
        listing?.latitude != null && listing?.longitude != null
          ? { lat: listing.latitude, lng: listing.longitude }
          : getAreaCoordinates(property.area),
    };
  });
}

export async function getDiscoveryProperties(
  city: string = DEFAULT_CITY,
): Promise<DiscoveryProperty[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return [];
  }

  const supabase = await createClient();
  // properties.city is free text (e.g. "Bangalore"/"BANGALORE" rather than
  // the app's canonical "Bengaluru"), so match against every known alias,
  // case-insensitively, instead of an exact .eq() that would silently drop
  // every real property.
  const cityAliases = CITY_NAME_ALIASES[city] ?? [city];
  const cityFilter = cityAliases.map((alias) => `city.ilike.${alias}`).join(",");

  const { data: propertyRows } = await supabase
    .from("properties")
    .select("id, slug, name, area, city, asking_rent, created_at")
    .eq("status", "published")
    .or(cityFilter)
    .order("name");

  return enrichProperties(supabase, (propertyRows ?? []) as PropertyRow[]);
}

// The signed-in user's saved properties, most recently saved first. Reuses
// enrichProperties rather than a second card-shaping implementation, so a
// wishlisted property renders with exactly the same facts (rating, rent,
// image, badge) as it would in ordinary discovery — see that function's own
// comment for why this matters.
export async function getWishlistedProperties(
  userId: string,
): Promise<DiscoveryProperty[]> {
  const supabase = await createClient();

  const { data: wishlistRows } = await supabase
    .from("wishlists")
    .select("property_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const propertyIds = (wishlistRows ?? []).map((row) => row.property_id);
  if (propertyIds.length === 0) return [];

  // Published only, matching what every other discovery surface shows — a
  // saved property that was later rejected or withdrawn shouldn't render as
  // if it were still a live listing.
  const { data: propertyRows } = await supabase
    .from("properties")
    .select("id, slug, name, area, city, asking_rent, created_at")
    .eq("status", "published")
    .in("id", propertyIds);

  const properties = (propertyRows ?? []) as PropertyRow[];
  const enriched = await enrichProperties(supabase, properties);

  // `.in()` does not preserve input order, so the result is re-sorted back
  // into "most recently saved first" — the one fact this list is actually
  // organised by. DiscoveryProperty only carries a slug, not the underlying
  // id, so the wishlist's id-based order is remapped to a slug-based one via
  // the same `properties` rows enrichProperties was given.
  const orderById = new Map(propertyIds.map((id, index) => [id, index]));
  const orderBySlug = new Map(
    properties.map((property) => [property.slug, orderById.get(property.id) ?? 0]),
  );
  return enriched
    .slice()
    .sort((a, b) => (orderBySlug.get(a.slug) ?? 0) - (orderBySlug.get(b.slug) ?? 0));
}
