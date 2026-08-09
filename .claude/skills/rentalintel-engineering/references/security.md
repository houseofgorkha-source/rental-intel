# Security / auth patterns

Full detail: CLAUDE.md §4, §7, §8, §26. This is the quick-lookup version.

## RLS is the boundary; the app layer is UX

"Authorization is enforced primarily at the database level via Postgres Row Level Security policies, not in application code. The app layer generally trusts RLS to filter what a query can see or write" (CLAUDE.md §4). Every Server Action still does its own `requireUser()` + ownership check (see `backend.md`) — that's for a clear error message and defense-in-depth, not a substitute for a policy. **A write path whose only protection is "the UI doesn't show a button for that" is not secure in this codebase's model.**

## Auth flow

Google OAuth + passwordless magic link, both client-initiated, both routed through `app/auth/callback/route.ts` (`exchangeCodeForSession`), redirecting to a `next` param guarded against open redirects by `lib/safe-next-path.ts` (`next` must start with `/`, not `//`). `proxy.ts` refreshes the session cookie on every non-static request. Server Components/Actions check auth via `supabase.auth.getUser()` (wrapped as `requireUser()`), never by trusting a client-supplied flag.

**Known unresolved bug** (CLAUDE.md §8): the `/login?next=...` redirect chain doesn't URL-encode a nested query string, which can drop `reviewId` on the verify-stay flow after a login round-trip. Not yet fixed — don't assume it's fine if a task touches that path.

## Provenance is not verification

`properties.submitted_as` is self-declared and never checked against reality. The owner-self-review RLS block (an owner can't review the property they listed) is explicitly documented as "a good-faith guard against casual self-review, not fraud prevention" — an owner who claims `tenant` cannot be stopped by schema. Don't build anything on top of `submitted_as` that assumes it's trustworthy identity data; the real defenses remain stay verification (uploaded documents) and 100% manual moderation.

## Upload validation

`lib/uploads.ts` — `validateUploadFiles`, `cleanUpFailedUpload`, `getFileExtension`, `verifyFileSignature` (checks actual file bytes, not just the claimed MIME type/extension). Storage buckets: `property-images` (public, 5MB/file, jpeg/png/webp), `verification-documents` (private, 5MB/file, pdf/jpeg/png, folder-scoped RLS by user id). Reuse these helpers for any new upload surface rather than re-validating ad hoc.

## Admin gating

`lib/admin.ts`'s `isAdminUser()` queries the `admin_users` table (self-row SELECT only via RLS); `requireAdmin()` wraps it as the shared guard for `app/actions/admin.ts`. Membership is granted only via the Supabase Dashboard — there is no in-app way to add an admin, deliberately, matching the same "trusted operator, not in-app credential" posture CLAUDE.md §7 describes for moderation generally. **Note**: whether this admin surface should exist at all is a separate, flagged question — see `product-boundaries.md`. If it exists, this is how it's gated; that doesn't settle whether it should have been built.

## Contact-detail privacy

Phone/email live in `property_contacts`, deliberately **not** on `properties`, because `properties` is publicly readable and a `select *` there must never be able to leak a contact detail. If you add a new property-level field that could be sensitive, ask whether it belongs on `properties` at all, or needs its own gated table the way contact details do.
