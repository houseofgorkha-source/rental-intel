import type { MetadataRoute } from "next";

// Next's file-based manifest convention — auto-served at /manifest.webmanifest
// and auto-linked into <head>, matching the same "no manual <link> tags"
// pattern app/favicon.ico and app/apple-icon.png already use.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RentalIntel",
    short_name: "RentalIntel",
    description:
      "Rental-intelligence for Bangalore renters. Real tenant reviews, evidence-backed verification, and rental history that stays with the property.",
    start_url: "/",
    display: "standalone",
    background_color: "#fdfbf7",
    theme_color: "#fdfbf7",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
