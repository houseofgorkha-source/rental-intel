import ReviewPropertyFinder from "@/components/property/ReviewPropertyFinder";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY } from "@/lib/cities";

export const dynamic = "force-dynamic";

// "Review Your Current Rental Property" (homepage) lands here: find the
// property first, then go straight to its review form -- not the general
// browse-and-view journey /property serves. Reuses the same discovery data
// and search bar as everywhere else (§20), just with its own narrow result
// list and destination, since "pick a property to review" isn't the same
// action as "view a property".
export default async function ReviewPropertyPage() {
  const properties = await getDiscoveryProperties(DEFAULT_CITY);

  return (
    <main className="min-h-screen bg-background pb-16 pt-28">
      <ReviewPropertyFinder properties={properties} />
    </main>
  );
}
