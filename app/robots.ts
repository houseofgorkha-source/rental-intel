import type { MetadataRoute } from "next";

// Admin/account areas are excluded from crawling — not a security boundary
// (RLS already gates what a crawler could even see), just no reason to spend
// crawl budget on pages a search visitor can never usefully land on.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/auth/callback"],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://rentalintel.vercel.app"}/sitemap.xml`,
  };
}
