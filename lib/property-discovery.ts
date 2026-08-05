import { createClient } from "@/lib/supabase/server";
import { CITY_NAME_ALIASES, DEFAULT_CITY } from "@/lib/cities";
import { calculateAverageRating, getPropertyImageUrl } from "@/lib/property-format";
import { getAreaCoordinates, type Coordinates } from "@/lib/area-coordinates";

export type DiscoveryProperty = {
  slug: string;
  name: string;
  area: string;
  city: string;
  askingRent: number | null;
  image: { src: string; alt: string } | null;
  averageRating: number | null;
  reviewCount: number;
  isAvailable: boolean;
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

type AvailabilityRow = {
  id: string;
  is_available: boolean;
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
    .select("id, slug, name, area, city, asking_rent")
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
        // Queried separately from the main properties fetch: is_available may
        // not exist yet on every environment (pending migration). A failure
        // here must never affect the properties list itself — every property
        // just falls back to "available" below.
        supabase
          .from("properties")
          .select("id, is_available")
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

  const availabilityByProperty = new Map<string, boolean>();
  if (!availabilityResult.error) {
    ((availabilityResult.data ?? []) as AvailabilityRow[]).forEach((row) => {
      availabilityByProperty.set(row.id, row.is_available);
    });
  }

  return properties.map((property) => {
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
      isAvailable: availabilityByProperty.get(property.id) ?? true,
      coordinates: getAreaCoordinates(property.area),
    };
  });
}
