type SupabaseServerClient = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createClient>
>;

// Thin wrapper around supabase.auth.getUser() — no redirects, no logging,
// no framework-specific behavior. Callers decide what to do with the result.
export async function requireUser(
  supabase: SupabaseServerClient,
  errorMessage: string,
) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: errorMessage } as const;
  }

  return { user, error: null } as const;
}
