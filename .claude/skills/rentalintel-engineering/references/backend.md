# Backend / Server Actions

Full detail: CLAUDE.md §4, §8. This is the quick-lookup version.

## The pattern every Server Action follows

`app/actions/*.ts` — `auth.ts`, `property.ts`, `review.ts`, `verification.ts`, `profile.ts`, `wishlist.ts`, `messages.ts`, `admin.ts`. Each `"use server"` action:

1. Gets a server Supabase client (`lib/supabase/server.ts`).
2. Calls `requireUser(supabase, errorMessage)` from `lib/auth.ts` and returns `{ error }` early if it fails — this is a thin wrapper around `supabase.auth.getUser()`, no redirects or side effects.
3. Does its own input validation.
4. Performs its own existence/ownership lookup scoped to the acting user (e.g. `.eq("created_by", user.id)`) **even though RLS also enforces this** — the app-layer check exists for a clear error message and defense-in-depth, not as the actual security boundary (see `security.md`).
5. Calls Supabase, and `revalidatePath()`s whatever page depends on the changed data.

`app/actions/admin.ts` follows the same shape but calls `requireAdmin()` (`lib/admin.ts`) instead of `requireUser()` — see `product-boundaries.md` for why this action's *existence* is itself flagged, independent of whether its implementation follows the house pattern (it does).

## Adding a new write path

- Check `app/actions/` first for an action that already does something close to what you need — extend it if the shape fits, rather than adding a parallel action with a different auth pattern.
- New writes need a corresponding RLS policy. If none exists yet, that's a migration, and migrations are approval-gated (CLAUDE.md §12) — flag it rather than assuming app-layer checks alone are sufficient.
- Follow the `revalidatePath()` convention so pages don't serve stale data after a mutation — check what existing actions revalidate for a similar resource (e.g. `wishlist.ts` revalidates `/property/${slug}` after toggling a save).

## City/attribute normalization pattern

Free-text or loosely-structured inputs get normalized at write time rather than rejected: `normalizeCityName()` in `property.ts` resolves known aliases to the canonical form and title-cases anything unrecognized rather than erroring. `getAttributes()`/`getContactPreference()` helpers in the same file read `FormData` against the canonical vocab in `lib/property-attributes.ts` / `lib/property-roles.ts` — never re-declare the allowed values inline in an action; import them.
