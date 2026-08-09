"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type WishlistResult = {
  error?: string;
  saved?: boolean;
};

// Add or remove a property from the signed-in user's wishlist.
//
// No migration was needed: `wishlists` and its three policies (read/add/remove
// your own, all scoped to user_id = auth.uid()) have existed since the initial
// schema and had no UI. This is the UI.
//
// `desired` rather than a blind toggle: the button knows what it is showing,
// and a toggle would flip the wrong way if two tabs disagreed about the
// current state.
export async function setWishlisted(formData: FormData): Promise<WishlistResult> {
  const slug = String(formData.get("slug") ?? "");
  const desired = formData.get("desired") === "true";
  if (!slug) return { error: "Missing property." };

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to save properties.",
  );
  if (!user) return { error: authFailure };

  // Resolved server-side from the slug: the client never gets to name a
  // property id, and RLS on `properties` means an unpublished property that
  // isn't theirs is simply not found.
  const { data: property } = await supabase
    .from("properties")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!property) return { error: "That property could not be found." };

  if (desired) {
    // The table is keyed by (user_id, property_id), so a repeat save is a
    // no-op rather than a duplicate or an error.
    const { error } = await supabase
      .from("wishlists")
      .upsert(
        { user_id: user.id, property_id: property.id },
        { onConflict: "user_id,property_id" },
      );

    if (error) return { error: "Unable to save this property. Please try again." };
  } else {
    const { error } = await supabase
      .from("wishlists")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", property.id);

    if (error) return { error: "Unable to remove this property. Please try again." };
  }

  revalidatePath(`/property/${slug}`);
  return { saved: desired };
}
