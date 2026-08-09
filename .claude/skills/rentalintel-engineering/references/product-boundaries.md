# Product boundaries

Full detail: CLAUDE.md §1–§3, §17–§26. This is the quick-lookup version, plus known contradictions between code and CLAUDE.md as of this skill's creation — **recorded, not resolved**. If you find a new contradiction, add it here rather than picking a side.

## What RentalIntel is

A rental-*intelligence* platform: rental history and tenant experience attach permanently to the property, not the tenant. "Know it before you rent it." Framed as a renter *decision* platform (§17) — every feature should be justifiable as helping someone decide whether to rent a specific place.

## What it will never become (§3, verbatim list)

Never publish fake reviews, never encourage fake engagement, never manipulate ratings, never remove truthful reviews for commercial pressure, never sacrifice trust for growth, never over-engineer before needed, never redesign working architecture without clear justification, never let tech choices dictate product decisions, never optimize for investors over tenants. Not an engagement-maximizing product; not a real-estate marketplace.

## Roles and listing model (§26)

`properties.submitted_as` (owner/tenant/helper, nullable) is provenance, not ownership — no `listings` table, no `owner_id`, no claim flow, and none should be added without this being revisited. Property identity (`name`, `address_*`, `area`, `city`, `slug`, `created_by`, `submitted_as`) is immutable through the Data API for everyone, including the creator — this is what guarantees a property's identity can't drift from the reviews permanently attached to it. `status` (moderation) and `is_available` (commercial) are orthogonal axes that must never merge — `'rented'` is deliberately not a `status` value.

## `/account` — declared thin, then extended (flagged contradiction)

CLAUDE.md §26, verbatim: *"`/account` is intentionally thin... Explicitly excluded and to stay excluded: analytics, charts, activity feeds, **messaging**, enquiries, notifications, ownership claims, admin UI, and **wishlist UI**."*

As of this skill's creation, the codebase has:
- `app/account/messages/page.tsx` — a working inbox, wired to `property_messages` (migration `20260810000000`).
- `components/property/WishlistButton.tsx` — live wishlist UI, wired to `app/actions/wishlist.ts`.

Both are named explicitly in §26's exclusion list. **This is a direct, unresolved conflict** — not a stale-doc situation where the code obviously supersedes an old note, since §26 states the exclusion as a permanent boundary ("to stay excluded"), not a not-yet-built item. Do not treat either implementation as retroactively sanctioning the exclusion list's removal; do not remove the features either. Flag this to the user if a task touches either area, and prefer that CLAUDE.md itself gets updated (per its own "Future Updates" process) once the product owner confirms which side is correct.

## No admin surface — then one was built (flagged contradiction)

CLAUDE.md §7, verbatim: *"There is no admin route, admin Server Action, or moderation UI anywhere in this repo, and none is planned for MVP... This is intentionally not built as in-app tooling for MVP... An in-app admin surface... was scoped and explicitly deferred post-launch."*

As of this skill's creation, `app/admin/` (dashboard + properties/verifications/reviews sub-routes), `app/actions/admin.ts` (`moderateProperty`, `moderateVerification`), `lib/admin.ts`, `components/admin/*`, and migration `20260809000001_add_admin_moderation.sql` (grants a gated `UPDATE (status)` on `properties` and `review_verifications` to `authenticated`, restricted by `is_admin()`) all exist. The manual Supabase-Dashboard moderation workflow §7 describes also still works unmodified — **two moderation paths now coexist** with no documented single source of truth for which is canonical going forward.

The implementation itself is careful (`SECURITY INVOKER`, column-scoped grants, the `current_user = 'authenticated'` exemption preserving Dashboard access — see `database.md`) — the contradiction is that it exists at all against an explicit "none is planned for MVP" statement, not that it's built badly. Same handling as above: flag, don't silently accept or revert.

## Deliberately out of scope / deferred (as of last CLAUDE.md pass)

`listings` table, `owner_id`, ownership-verification claim flow, notifications, analytics/activity feeds, amenities filtering, owner responses to reviews, paid/featured listings, message threading/read-receipts, an `availableOnly` discovery filter, `bedrooms`/`property_type`/`furnishing` were *also* previously deferred in an earlier plan but have since landed (`property-attributes.ts`, migration `20260810000000`) — check the current schema/`lib/property-attributes.ts` rather than assuming an older plan's deferral list is still accurate.

## Discovery flow and page responsibilities (§18–§23)

Homepage → Property Detail → "Continue Exploring" → `/property` (canonical search results) → repeat. Homepage stays the entry point, not the primary browsing surface. `/property` is search/filters/map/results only — no marketing copy. Related-property sections must be backed by real, distinguishable data (`getSimilarProperties()`, `getTopReviewedProperties()` in `RelatedProperties.tsx`) and never render an empty or duplicate section.
