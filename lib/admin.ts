import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Is this user an administrator?
//
// This is a convenience for deciding what to render — it is NOT the security
// boundary. The boundary is in the database: every table an administrator can
// read beyond their own rows is opened by a policy gated on public.is_admin(),
// and the only two writes they can make are column-scoped grants on
// properties.status and review_verifications' four decision columns
// (20260809000001_add_admin_moderation.sql). If this check were removed
// entirely, a non-admin would still see nothing and change nothing — they
// would just get empty pages instead of a 404.
//
// The query reads admin_users, whose SELECT policy is `user_id = auth.uid()`.
// A non-admin therefore gets zero rows rather than a permission error, and
// nobody can use this to discover who else is an administrator.
export async function isAdminUser(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

// Shared by every admin Server Action. Returns a message rather than throwing
// or redirecting, matching the { error } shape the other actions in this
// project use.
export async function requireAdmin(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, error: "Please sign in to continue." } as const;
  }

  if (!(await isAdminUser(supabase, user.id))) {
    return { user: null, error: "You don't have access to moderation." } as const;
  }

  return { user, error: null } as const;
}
