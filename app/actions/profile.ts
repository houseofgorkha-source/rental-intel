"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

type UpdateProfileResult = {
  error?: string;
  success?: boolean;
};

// `display_name` is the only editable column on `profiles`, and the
// "Users can update their own profile" RLS policy already permits this —
// no migration is involved.
export async function updateProfile(formData: FormData): Promise<UpdateProfileResult> {
  const value = formData.get("displayName");
  const displayName = typeof value === "string" ? value.trim() : "";

  if (!displayName) {
    return { error: "Please enter a display name." };
  }

  if (displayName.length > 80) {
    return { error: "Display name must be 80 characters or fewer." };
  }

  const supabase = await createClient();
  const { user, error: authFailure } = await requireUser(
    supabase,
    "Please sign in to update your profile.",
  );

  if (!user) return { error: authFailure };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) {
    return { error: "Unable to update your profile. Please try again." };
  }

  revalidatePath("/account/profile");
  return { success: true };
}
