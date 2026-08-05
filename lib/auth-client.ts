import { createClient } from "@/lib/supabase/client";
import { getSafeNextPath } from "@/lib/safe-next-path";

// Identical Google OAuth kickoff used by both LoginForm and SignupForm.
export async function signInWithGoogle(nextPath?: string): Promise<{ error: string | null }> {
  const { error } = await createClient().auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(getSafeNextPath(nextPath))}`,
    },
  });

  return { error: error ? error.message : null };
}
