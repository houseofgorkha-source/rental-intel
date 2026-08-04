import type { DiscoveryProperty } from "@/components/property/PropertyDiscovery";
import { createClient } from "@/lib/supabase/server";

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

export async function getDiscoveryProperties(): Promise<DiscoveryProperty[]> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return [];
  }

  const supabase = await createClient();
  const { data: propertyRows } = await supabase
    .from("properties")
    .select("id, slug, name, area, city, asking_rent")
    .eq("status", "published")
    .order("name");

  const properties = (propertyRows ?? []) as PropertyRow[];
  const propertyIds = properties.map((property) => property.id);
  const [imagesResult, reviewsResult] = propertyIds.length
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
      ])
    : [{ data: [] }, { data: [] }];

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

  return properties.map((property) => {
    const image = firstImageByProperty.get(property.id);
    const reviews = reviewsByProperty.get(property.id) ?? [];
    const averageRating = reviews.length
      ? reviews.reduce((total, review) => total + review.overall_rating, 0) /
        reviews.length
      : null;

    return {
      slug: property.slug,
      name: property.name,
      area: property.area,
      city: property.city,
      askingRent: property.asking_rent,
      image: image
        ? {
            src: supabase.storage
              .from("property-images")
              .getPublicUrl(image.storage_path).data.publicUrl,
            alt: image.alt_text || property.name,
          }
        : null,
      averageRating,
      reviewCount: reviews.length,
    };
  });
}
