import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getWishlistedProperties } from "@/lib/property-discovery";
import { PropertyList } from "@/components/property/PropertyDiscovery";
import { EmptyState } from "@/components/shared/StatusPrimitives";

export const dynamic = "force-dynamic";

// Reuses PropertyList, the same card §20 requires every property listing in
// the app to share — a saved property looks exactly like it would in
// ordinary discovery, not a second bespoke card. No new RLS: `wishlists`
// has had a "Users can read their own wishlist" policy since the initial
// schema, this is the first UI to use it.
export default async function AccountWishlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/wishlist");

  const properties = await getWishlistedProperties(user.id);

  if (properties.length === 0) {
    return (
      <EmptyState
        title="You haven't saved any properties yet."
        description="Tap the save icon on a property's page to keep track of it here."
        actionHref="/property"
        actionLabel="Browse properties →"
      />
    );
  }

  return <PropertyList properties={properties} heading="Saved properties" />;
}
