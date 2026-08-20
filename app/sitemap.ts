import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rentalintel.vercel.app";

const STATIC_ROUTES = [
  "",
  "/property",
  "/brokers",
  "/review",
  "/add-property",
  "/add-broker",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
  "/contact",
];

// Static routes plus every published property — the only dynamic, publicly
// crawlable content this app has. Deliberately reads status='published'
// directly rather than going through getDiscoveryProperties(), since a
// sitemap only needs slug + last-modified, not the full discovery
// aggregation (image URLs, ratings, filter attributes).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("slug, updated_at")
    .eq("status", "published");

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    changeFrequency: route === "" || route === "/property" ? "daily" : "monthly",
    priority: route === "" ? 1 : 0.6,
  }));

  const propertyEntries: MetadataRoute.Sitemap = (properties ?? []).map((property) => ({
    url: `${SITE_URL}/property/${property.slug}`,
    lastModified: property.updated_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...propertyEntries];
}
