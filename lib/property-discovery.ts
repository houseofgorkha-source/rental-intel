import { createClient } from "@/lib/supabase/server";
import { CITY_NAME_ALIASES, DEFAULT_CITY } from "@/lib/cities";
import { calculateAverageRating, getPropertyImageUrl } from "@/lib/property-format";
import { getAreaCoordinates, type Coordinates } from "@/lib/area-coordinates";
import type {
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
};

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

  const properties = (propertyRows ?? []) as PropertyRow[];
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
            "id, is_available, submitted_as, configuration, property_type, furnishing, carpet_area_sqft, security_deposit, latitude, longitude",
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
