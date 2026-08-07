# CLAUDE.md — RentalIntel Engineering Reference

This document is the canonical onboarding reference for any Claude session working on RentalIntel. It is derived only from the current codebase, the repository's own documentation, and explicit product-owner statements made in conversation. It contains no invented requirements.

## How to read this document

Every substantive claim below is tagged with one of four labels:

- **[Verified Fact]** — directly observed in the current codebase (code, schema, config). Will stay accurate as long as the referenced file does.
- **[Documented Product Decision]** — stated in `docs/`, `RentalIntel-Blueprint.md`, `RentalIntel_Master_Context_v1.md`, or `RentalIntel_Transition_v1.md`, or stated directly by the product owner in conversation. Treated as intentional and binding until the product owner changes it.
- **[Current Working Assumption]** — appears true today, inferred by Claude from patterns in the code or docs, but has not been confirmed as a permanent decision. **Must not be treated as a rule.** Exists to be confirmed or corrected, not relied upon.
- **[Open Question]** — something Claude could not resolve from the repo or docs and needs the product owner to answer.

Where the repository's own `docs/` files conflict with the current code, this document follows the code and flags the doc as stale — see §0.

---

## 0. Documentation vs. reality

**[Verified Fact]** `docs/Architecture.md`, `docs/PROJECT_STRUCTURE.md`, `docs/RentalIntel-Blueprint.md`, and `RentalIntel_Transition_v1.md` describe a pre-Supabase, mock-data, no-auth version of the app (local `data/properties.ts` / `data/reviews.ts`, "no backend yet," "no authentication"). The `data/` folder referenced by these docs is currently empty, and the app is fully wired to Supabase with working authentication. **The implementation has moved ahead of the documentation.** These docs remain useful for product philosophy and vision (§2, §3, §15) but are not accurate for architecture, folder structure, or data layer — this file supersedes them for those topics.

---

## 1. Product overview

**[Documented Product Decision]** RentalIntel is a rental-intelligence platform, not a listings/marketplace site. It preserves rental history and tenant experience by attaching it permanently to the property rather than the tenant, so that knowledge doesn't disappear when someone moves out. Initial market focus is Bangalore rentals. (Reproduced as originally documented — the app's canonical city name in code is now `"Bengaluru"`, a later session decision; see §4.)

**[Documented Product Decision]** Mission: help tenants make informed rental decisions through community knowledge, verified reviews, and trustworthy property intelligence. Tagline: "Know it before you rent it."

**[Verified Fact]** The current implementation supports: searching/browsing published properties on an interactive map or list, viewing a property's detail page with reviews and images, submitting a new property (pending manual approval), writing a review while signed in, submitting stay-verification documents against a review, and optionally using device location to suggest a city/area or confirm proximity to a property (see §4).

## 2. Product philosophy

**[Documented Product Decision]**, from `docs/RentalIntel-Blueprint.md` and `RentalIntel_Transition_v1.md`:

- Trust over growth.
- One RentalIntel ID per real property (eventual permanent identity per property — not yet implemented, see §15).
- Users submit properties; RentalIntel verifies them.
- Evidence-backed reviews.
- Verification increases credibility, not the right to be heard — unverified users may still contribute.
- Data quality over quantity.
- Build for tenants first; future landlord/broker functionality must never compromise tenant transparency.
- Every feature must answer: **"Does this help someone make a better rental decision?"** If no, it should not exist.

## 3. Things RentalIntel will never become

**[Documented Product Decision]**, from `RentalIntel_Transition_v1.md` Appendix B ("Things We Will Never Do"):

- Never publish fake reviews.
- Never encourage fake engagement.
- Never manipulate ratings.
- Never remove truthful reviews because of commercial pressure.
- Never sacrifice trust for growth.
- Never over-engineer solutions before they are needed.
- Never redesign working architecture without clear justification.
- Never allow technology choices to dictate product decisions.
- Never optimize for investors at the expense of tenants.
- Never forget that trust is the primary product.

**[Documented Product Decision]** It is explicitly not designed to maximize engagement or time-on-app through addictive mechanics, and is not a real-estate marketplace.

## 4. Current architecture

**[Verified Fact]**

```
Browser
  ↓
Next.js App Router
  ↓ (Server Components read directly; Server Actions handle writes)
Supabase client (@supabase/ssr)
  ↓
Supabase (Postgres + Auth + Storage), authorization enforced via Row Level Security
```

- No custom API layer or data-access abstraction between pages and Supabase. Server Components (`page.tsx` files) query Supabase directly.
- Mutations go through `"use server"` Server Actions in `app/actions/` — each action does its own auth check, input validation, and Supabase call(s).
- Authorization is enforced primarily at the database level via Postgres Row Level Security policies, not in application code. The app layer generally trusts RLS to filter what a query can see or write.
- Session cookies are refreshed on every request by `proxy.ts` (Next.js 16's renamed `middleware.ts` convention), which calls `supabase.auth.getUser()` and re-sets cookies.
- One data-access helper exists outside of a page: `lib/property-discovery.ts`, used by the homepage and `/property` listing.
- A second `lib/` helper, `lib/cities.ts`, is the single source of truth for city/locality data (`DEFAULT_CITY`, `CITIES` with a per-city `available` flag, `LOCALITIES_BY_CITY`) — built to make the UI multi-city-ready without actually implementing other cities yet. `CitySelector`, the homepage, and `/property` all import from it rather than keeping their own copies.

**[Verified Fact — resolved since first written]** `getDiscoveryProperties()` now genuinely filters by city, via a case-insensitive `.or()` match against every known alias for the requested city (`CITY_NAME_ALIASES` in `lib/cities.ts`), not a naive `.eq()` — the earlier version silently returned zero properties for exactly this reason. `lib/cities.ts`'s canonical city name is now **`"Bengaluru"`** (renamed from `"Bangalore"` in a later session; `"Bangalore"` is now the alias). New property submissions are normalized to the canonical name at write time via `normalizeCityName()` in `app/actions/property.ts` — known aliases resolve to their canonical form, anything unrecognized is title-cased and stored as-is rather than rejected. Existing rows written before this normalized are untouched.

**[Verified Fact]** The homepage (`HomeDiscovery.tsx`) is the single owner of homepage search/filter/map state (city, area, search query, rent range, only-show filters, selected property, map center/zoom) — the hero's `SearchBar`, the property panel's toolbar, and `PropertyMap` are all siblings that read/write through it rather than keeping independent copies. `filterProperties()` (exported from `PropertyDiscovery.tsx`) is the single filtering implementation; it's called once per render in `HomeDiscovery` and the resulting array is handed to both the map and the list.

**[Verified Fact]** The homepage includes an interactive map (`components/property/PropertyMap.tsx`) using **MapLibre GL JS with OpenStreetMap raster tiles** — no Mapbox, no Google Maps, no API key. Property markers are positioned by **approximate area centroid**, not real per-property geocoding — there are no latitude/longitude columns anywhere in the schema (`properties` only has a free-text `maps_url` link) and no geocoding pipeline exists. `lib/area-coordinates.ts` holds these approximate coordinates (populated for Bengaluru's real locality list; city-level centers for every city in `lib/cities.ts`) and the nearest-neighbor lookups (`findNearestCity`, `findNearestArea`, `isNearArea`) that also back the "Use My Location" feature below — this was a deliberate, disclosed MVP tradeoff, not an oversight.

**[Verified Fact]** An optional "Use My Location" feature exists on the homepage, Add Property form, and Review form, via one reusable `components/shared/UseMyLocationButton.tsx` and `lib/geolocation.ts` (a thin Promise wrapper around `navigator.geolocation`). Location is only ever requested on click, never automatically, and raw coordinates never reach a Server Action or Supabase call anywhere — only derived city/area strings (homepage, Add Property) or a boolean proximity flag (Review) do. No reverse-geocoding API (Nominatim, Google, or otherwise) is used — the nearest-city/area lookups reuse the same approximate coordinate data already in `lib/area-coordinates.ts`, so coordinates never leave the browser.

**[Current Working Assumption]** Business logic embedded directly inside `page.tsx` files (notably `app/property/[slug]/page.tsx`, which does row-shaping, rating aggregation, and date formatting inline) is not yet extracted to `lib/`, unlike `property-discovery.ts`. Whether this should be refactored, or is acceptable as-is for current scale, is unresolved — see §12/§16 (extend, don't refactor, without approval).

## 5. Folder structure

**[Verified Fact]**

```
app/
  actions/         Server Actions: auth.ts, property.ts (createProperty + updatePropertyListing), review.ts, verification.ts, profile.ts
  auth/callback/    OAuth / magic-link callback route handler
  account/          Authenticated account area (see §26): layout.tsx (auth gate + nav),
                    overview, properties/, properties/[slug]/edit, reviews/, verifications/, profile/
  add-property/     Add-property page (role-aware via ?as=owner|tenant|helper)
  login/, signup/   Auth pages
  property/         /property listing, /property/[slug] detail, review + verify sub-routes
  layout.tsx, page.tsx, globals.css

components/
  property/         PropertyDiscovery.tsx (PropertyList, FiltersButton, filterProperties, default PropertyDiscovery page shell — the canonical search results page, §22), HomeDiscovery.tsx (homepage shared-state owner, see §4), HomeSearch.tsx (city+area+text search bar, reused by the homepage, /property, and DetailPageSearch — see §20), DetailPageSearch.tsx (Property Detail page's search widget, composes HomeSearch + FiltersButton, no logic of its own), RelatedProperties.tsx (Similar/Top Reviewed sections + "Continue Exploring", see §23), ContributionStatusCards.tsx (the Property/Review/Stay Verification status cards on the Property Detail page — always visible, never hidden behind a click, see §25), PropertyMap.tsx (MapLibre + OSM), DualRangeSlider.tsx, AreaMultiSelect.tsx, PropertyGallery, ReviewSection, ReviewCard, PropertyShareButton. `AreaSelector.tsx` (single-select) is no longer used anywhere — superseded by `AreaMultiSelect.tsx` — kept but inert, not deleted (see §16's "treat existing omissions as intentional"). `VerifyStayPrompt.tsx` (a click-to-reveal modal, an earlier iteration of the verify-before-review guidance) was removed in favor of ContributionStatusCards' always-visible card.
  review/           ReviewForm, VerifyStayForm, StarRating, reviewCategories.ts
  add-property/     PropertyForm, RoleSelector (owner/tenant/helper claim, see §26), InfoCard, SectionTitle
  account/          AccountSectionNav, AccountPrimitives (StatusPill/EmptyState shared by the
                    four account sections), ProfileForm, ListingEditForm
  home/             ListYourPropertySection (the homepage's role entry points, §26)
  login/            LoginForm, SignupForm
  shared/           Button, InputField, TextAreaField, AuthCard, AuthHeader, AuthLayout, AccountMenu, TrustBadge, Logo, AuthDivider, UseMyLocationButton
  SearchBar.tsx, CitySelector.tsx   (top-level; not currently in shared/ — see §13)

lib/
  supabase/client.ts   browser Supabase client
  supabase/server.ts   server Supabase client (cookie-aware)
  property-discovery.ts  aggregation query for property listings
  property-format.ts     shared image-URL/rating-average/currency-format helpers
  cities.ts               city/locality single source of truth (see §4)
  area-coordinates.ts     approximate city/area coordinates + nearest-neighbor lookups (see §4)
  geolocation.ts           browser geolocation Promise wrapper
  auth.ts                  requireUser() shared auth-check helper
  uploads.ts               validateUploadFiles/cleanUpFailedUpload/getFileExtension/verifyFileSignature
  safe-next-path.ts        open-redirect guard for `next` params
  auth-client.ts           shared Google OAuth kickoff (client-side)

supabase/migrations/   hand-written, timestamped SQL migrations (schema + RLS + grants)
supabase/config.toml    local Supabase CLI config, committed for reproducible local verification
docs/                  product/architecture documentation (see §0 for accuracy caveats)
data/                  empty — fossil from pre-Supabase mock-data era
public/                static assets (currently empty — default create-next-app SVGs removed, unused)
```

**[Current Working Assumption]** `data/` and the top-level `.agents/` directory are both empty and appear to be leftovers. Treated as intentional/inert unless the product owner says otherwise (per §16's "treat existing omissions as intentional").

## 6. Tech stack

**[Verified Fact]**, from `package.json`:

- Next.js 16.2.10 (App Router)
- React 19.2.4 / React DOM 19.2.4
- TypeScript 5.x, strict mode enabled (`tsconfig.json`)
- Tailwind CSS 4.x (via `@tailwindcss/postcss`)
- `@supabase/supabase-js` 2.110.8 and `@supabase/ssr` 0.12.3 (`@supabase/supabase-js` is a required peer dependency of `@supabase/ssr`, not dead weight — kept even though nothing imports it directly)
- `maplibre-gl` — the homepage's interactive map; OpenStreetMap raster tiles, no Mapbox/Google, no API key
- ESLint 9.x with `eslint-config-next`
- Vitest — unit tests for `lib/` pure functions and the `review` Server Action's RPC mapping (mocked Supabase client); no integration/E2E test runner
- Package manager: npm.

## 7. Database overview

**[Verified Fact]**, from `supabase/migrations/`:

**Core tables**: `profiles` (mirrors `auth.users`, auto-created via `handle_new_user` trigger), `properties` (status enum: `pending` / `published` / `rejected`; `is_available boolean not null default true` as of the 4th migration below), `property_images`, `reviews` (verification_status enum: `unverified` / `pending` / `verified` / `rejected`; recommendation enum: `yes` / `maybe` / `no`), `review_categories` (static, seeded), `review_category_ratings`, `review_issues` (tagged issue types), `wishlists`, `review_verifications`, `verification_documents`.

**Storage buckets**: `property-images` (public, 5MB/file, jpeg/png/webp), `verification-documents` (private, 5MB/file, pdf/jpeg/png, folder-scoped RLS by user id).

**Migrations, in order**:
1. `20260724000000_initial_schema.sql` — full base schema, enums, triggers, RLS policies, storage buckets.
2. `20260801000000_allow_property_image_submissions.sql` — lets property creators insert/upload their own image records; widens image read policy to include the owner's own (not-yet-published) properties.
3. `20260801000001_add_upload_cleanup_policies.sql` — lets creators delete failed image uploads and remove their own still-pending properties/verification requests.
4. `20260805000000_add_property_availability.sql` — adds `properties.is_available boolean not null default true`, powering the "Available for rent" card badge. No RLS change needed (no column-level security in this schema — a new column on an already-visible row is covered by the existing row-level policy). There is still no UI for anyone to actually set this to `false` — every property shows as available until that's built.
5. `20260805000001_expand_review_fields.sql` — adds the deposit/owner-trait/would-rent-again columns `ReviewForm` collects, plus 7 new `review_categories` rows, so the review-submission data-loss bug (formerly listed in §13) has somewhere to land. Intentionally one-time-only, not idempotent (documented in the file itself) — matches this project's migration-history convention.
6. `20260805000002_create_review_rpc.sql` — `public.create_review(...)`, `SECURITY INVOKER`, makes review + category-rating inserts atomic via a single RPC instead of two sequential client-side inserts. Safe to re-run (`CREATE OR REPLACE`).
7. `20260805000003_grant_data_api_privileges.sql` — grants `SELECT/INSERT/UPDATE/DELETE`/sequence `USAGE` to `anon`/`authenticated`/`service_role`. **Partially superseded for `properties` by migration 9** — see §12. **Fixes a real bug found via local verification**: tables created by hand-written migrations only got `TRUNCATE/REFERENCES/TRIGGER` by default (confirmed via `pg_default_acl` on a fresh Supabase CLI instance) — without this grant, a genuinely fresh database applies every migration without SQL error but silently denies all anon/authenticated requests, since Postgres checks table-level privileges before RLS. RLS remains the sole row-level authorization boundary; this only unblocks the table-level check it sits behind.
8. `20260807000000_allow_owner_reviews_on_pending_properties.sql` — widens `reviews` INSERT and SELECT so a property's creator can write and read their own review while the property is still pending. Superseded on the INSERT side by migration 9.
9. `20260808000000_add_listing_fields_and_submitter_role.sql` — adds `properties.submitted_as` (enum `owner`/`tenant`/`helper`, **nullable** = legacy/unknown) and `properties.security_deposit`; replaces blanket table-level UPDATE on `properties` with a **column-level grant** on `(asking_rent, security_deposit, currency, is_available)` plus a `created_by = auth.uid()` UPDATE policy; and narrows the `reviews` INSERT policy so an owner cannot review the property they listed. See §26.

**[Verified Fact]** RLS is enabled on every `public` table. Public (anon) reads are generally scoped to `status = 'published'` (properties) or to records whose parent property is published; write access is scoped to `auth.uid()` matching the relevant owner/author column.

**[Documented Product Decision — stated directly by the product owner in conversation, Phase 4]** There is no admin route, admin Server Action, or moderation UI anywhere in this repo, and none is planned for MVP. Approving a property (`pending` → `published`) or a review verification (`pending` → `verified`/`rejected`) is a deliberately manual process for launch, performed directly by a trusted operator via the Supabase Dashboard:

1. Open the Supabase Dashboard for this project → **Table Editor**.
2. **To approve a property**: open the `properties` table, find the row with `status = 'pending'`, review its details (and any linked `property_images` rows), then edit `status` to `'published'` (or `'rejected'`).
3. **To verify a review**: open the `review_verifications` table, find the row with `status = 'pending'`, open its linked `verification_documents` rows (via `verification_id`) in **Storage** → `verification-documents` bucket to inspect the uploaded evidence, then edit the `review_verifications` row's `status` to `'verified'` or `'rejected'`. The `review_verifications_sync_status` trigger (see migration 1) automatically propagates this to the linked `reviews.verification_status`.
4. This requires Dashboard access (a Supabase project owner/admin), not just the `service_role` API key — no in-app credential is needed or should be used for this.

This is intentionally not built as in-app tooling for MVP — RLS has no UPDATE policy on either table specifically so this can't happen through the app or its API, by design (see §12). An in-app admin surface (using a service-role-backed Server Action gated by an admin allow-list) was scoped and explicitly deferred post-launch, to be revisited once real moderation volume makes the Dashboard workflow impractical.

## 8. Authentication flow

**[Verified Fact]**

- Two sign-in methods: Google OAuth (`signInWithOAuth`) and passwordless email magic link (`signInWithOtp`), both initiated client-side in `LoginForm.tsx` / `SignupForm.tsx` via `lib/supabase/client.ts`.
- Both redirect through `app/auth/callback/route.ts`, which calls `exchangeCodeForSession(code)` and redirects on to a `next` path (defaulting to `/`), with an open-redirect guard (`next` must start with `/` and not `//`).
- `proxy.ts` runs on every non-static request, refreshing the Supabase session cookie via `getUser()`.
- Server Components/Actions check auth via `supabase.auth.getUser()` (e.g. `app/add-property/page.tsx`, `app/actions/property.ts`, `app/actions/review.ts`, `app/actions/verification.ts`) and redirect to `/login?next=...` or return an error when unauthenticated.
- `app/layout.tsx` reads the current user server-side to decide whether to render `AccountMenu` or Login/Sign Up links.

**[Current Working Assumption]** The redirect chain into `/property/[slug]/review/verify?reviewId=...` does not URL-encode the nested query string when building the `next` param for `/login`, which can drop `reviewId` after a login round-trip for unauthenticated users landing on that page. Flagged as a likely bug in the engineering assessment; not yet confirmed or fixed pending approval.

## 9. Shared component conventions

**[Verified Fact]** `components/shared/` holds the reusable primitives: `Button`, `InputField`, `TextAreaField`, `AuthCard`, `AuthHeader`, `AuthLayout`, `AccountMenu`, `TrustBadge`. Feature-specific components live under their own folder (`property/`, `review/`, `add-property/`, `login/`).

**[Current Working Assumption]** `SearchBar.tsx` and `CitySelector.tsx` sit at the top level of `components/` rather than in `shared/`, even though they're reused across the homepage and `/property`. Not yet confirmed whether this should move — see §16 (extend existing structure, don't restructure without approval).

**[Current Working Assumption]** Two visually distinct component styles currently coexist: a "slate" palette (`slate-950`/`slate-200`, sharp/minimal — used in `PropertyDiscovery`, `PropertyGallery`, the property detail page) and an older "gray/blue/rounded" palette with emoji-heavy headers (used in `LoginForm`, `SignupForm`, `ReviewForm`, `ReviewCard`, `AuthHeader`). `InputField.tsx`'s focus ring uses a third, unrelated color (`#1B4332`). This matches the "Brand migration" item listed as the current sprint in `RentalIntel_Master_Context_v1.md`, i.e. it appears to be a migration in progress rather than two permanent systems — but which palette is the intended target is an **Open Question** (see below).

## 10. UI/UX principles

**[Documented Product Decision]**, from `docs/Architecture.md`:

- Pages fetch and compose data; components render UI.
- One source of truth for data; avoid duplicating business logic.
- Keep components reusable and focused; business logic should move into `lib/` over time.

**[Documented Product Decision]**, from `RentalIntel_Transition_v1.md`: fast comprehension, minimal friction, strong readability, clear navigation, short journeys, low cognitive load, progressive disclosure. The property page favors reading over interaction — users primarily consume information.

**[Documented Product Decision]** Brand colors per `RentalIntel_Master_Context_v1.md`: background white (#FFFFFF), text black (#111827), accent blue (#2563EB). Normal actions are white/outlined buttons that go blue on hover; high-impact actions are solid blue buttons.

**[Current Working Assumption]** The slate-based palette used on the newer discovery/property pages does not match the documented blue-accent brand spec above. Whether the documented spec or the newer slate direction is now the intended target is unresolved (same open question as §9) — **though see the note directly below: recent work has started deliberately layering the documented `#2563EB` blue back on top of the slate base as an interactive accent, which may be trending toward an answer without yet being confirmed as final.**

**[Current Working Assumption]** As of this session, the homepage hero and property cards use `blue-600` (`#2563EB`, matching the documented brand spec) as a restrained interactive/status accent on top of the slate base — the headline's last word, the `Filters`/`Area` toolbar chips' active state, the search bar's focus ring, and card link hover states are blue; structural chrome (cards, panels, dividers) stays slate. The "Available for rent" badge deliberately uses emerald instead, so status color doesn't compete with the interactive blue. This is a deliberate design choice made this session, not yet explicitly ratified by the product owner as the final answer to the §9/§10 palette question — flagged here rather than silently promoted to settled.

**[Documented Product Decision — stated directly by the product owner in conversation]** The homepage hero's current two-column pattern (a `rounded-2xl`, subtly tinted panel — `#f6f6f4` against the page's `#fbfbfa`, no borders, pixel-aligned to the opposite column's text) is intended to be the template for additional homepage sections built below it in the future, mirrored left/right per section (i.e. alternating which side carries the tinted panel vs. the plain-background content). Not yet built — noted here so future sections start from this stated intent rather than inventing a new layout language.

## 11. Coding standards

**[Documented Product Decision]**, from `RentalIntel_Transition_v1.md`, largely consistent with observed code: descriptive/consistent naming, PascalCase components, reusable UI preferred over duplicated markup, no large "god components," strict TypeScript preferred over `any`, single styling approach (Tailwind utilities only, no competing CSS system).

**[Verified Fact — deviations observed]**:
- `components/shared/InputField.tsx` has a type import statement placed after the component definition rather than at the top of the file.
- Business logic (data shaping, aggregation, formatting) is written inline in some `page.tsx` files rather than extracted to `lib/`, inconsistent with the "business logic belongs in lib/" principle (see §4).
- `app/layout.tsx` still carries the default `create-next-app` metadata (`title: "Create Next App"`).

## 12. Things not to change without explicit approval

**[Current Working Assumption — recommended by Claude, not yet ratified by product owner.]** Based on blast radius and the trust-sensitive nature of this product, the following are recommended as requiring explicit approval before any change, beyond the general workflow in §16:

- RLS policies and any migration file under `supabase/migrations/`.
- **The column-level UPDATE grant on `properties`** (migration 9). It is what makes a property's identity — name, address, slug, status, `submitted_as` — unreachable through the Data API. A future `grant ... update on all tables in schema public` (as migration 7 does) would **silently revert it** and re-expose those columns. Any new grants migration must exclude `public.properties` from a blanket UPDATE grant.
- The authentication flow (`proxy.ts`, `lib/supabase/*`, `app/auth/callback/route.ts`).
- The database schema (table shapes, enums, constraints).
- Which visual/brand palette is canonical (until the Open Question in §9 is resolved).
- Anything that changes what data is publicly readable vs. gated.

This list is a proposal, not a settled rule — see Open Questions.

## 13. Existing technical debt

**[Verified Fact]**

- `app/layout.tsx` now has real title/description/OG/Twitter metadata (fixed) — the earlier default `create-next-app` metadata item is resolved.
- The `/login?next=...` redirect chain does not encode a nested query string, risking loss of `reviewId` on the verify-stay flow after a login round-trip (see §8). Not yet fixed.
- Two coexisting visual design systems (see §9). Not yet resolved.
- Dark mode is declared in `globals.css` (`prefers-color-scheme: dark` CSS variables) but not actually implemented — nearly all components hardcode light-mode Tailwind classes instead of using the CSS variables.
- `data/` and `.agents/` directories are empty, untracked by git, and appear to be unused fossils.
- `SearchBar.tsx` / `CitySelector.tsx` live outside `components/shared/` despite being shared, reusable components. Not yet moved.
- `/property`'s "Locality explorer" sidebar keeps its own small hardcoded 6-item locality list, separate from the fuller `LOCALITIES_BY_CITY` lookup (`lib/cities.ts`). Known, disclosed duplication — not reconciled yet.
- `CitySelector.tsx` and `AreaSelector.tsx` share near-identical dropdown open/close + keyboard-nav scaffolding, independently implemented in each. Confirmed via audit, not yet extracted into a shared hook.
- **Map markers use approximate area-centroid coordinates, not real per-property geocoding** (see §4) — the honest fix is either manual lat/lng entry on the Add Property form or a geocoding API call against the address, both real scope additions, neither built.
- **OpenStreetMap's public tile server** (`tile.openstreetmap.org`) powers the homepage map — fine for development/low traffic, but has a documented usage policy not meant for sustained high-volume production traffic. Should move to a dedicated tile provider (MapTiler, Stadia Maps, self-hosted) before real launch traffic.
- The homepage panel's scroll cap (`PropertyList`'s `lg:max-h-[21.75rem]`) and its pixel-for-pixel alignment to the left column are hand-calibrated fixed values, not dynamically synced. If that copy changes materially, realignment will be needed — no JS-based height sync exists.

## 14. Current sprint

**[Documented Product Decision — possibly stale, see flag below.]** Per `RentalIntel_Master_Context_v1.md`: current sprint is Brand migration, UI polish, Shared components. Next up (same doc): finish brand migration, Login UI, Profile UI, Shared Card, Shared Modal, Shared Badge.

**[Open Question]** This "current sprint" note is undated relative to the rest of the repo's rapid recent activity (Supabase migration, auth, verification flow all landed since). Whether this is still the actual current sprint, or has been superseded by the Supabase/verification work, needs confirmation.

## 15. Roadmap

**[Documented Product Decision]**, from `docs/Roadmap.md` — included as-is, not modified or re-interpreted:

**Version 1 (current goal)** — Completed: Homepage, Search, Search Autocomplete, Dynamic Property Pages, Property Reviews, Review Submission, Review Success Page, Review Journey, Add Property Entry Point, Blueprint v0.1, Architecture v0.1. In progress: Add Property Form, Property Preview, Duplicate Property Suggestions, User Authentication (Google Login), Admin Verification Panel, RentalIntel ID, Supabase Integration, Website Deployment. Launch checklist: Google Login, Property Submission, Admin Dashboard, Property Verification, Review Verification, Database Integration, Deployment, Privacy Policy, Terms & Conditions, Contact Page.

**Version 2** — Google Maps / Google Places Integration, Alias Detection, Duplicate Detection, Property Fingerprint, Property Merge, Helpful Votes, Review Discussions, Threaded Replies, AI Review Summaries, Trusted Renter Program.

**Version 3** — AI Duplicate Detection, Landlord Profiles, Broker Profiles, Community Reputation, Property Analytics, Rent Trends, Mobile Applications, Public API.

**[Current Working Assumption]** Several "in progress" Version 1 items (User Authentication, Supabase Integration) are actually complete per the current code; "Admin Verification Panel" and "RentalIntel ID" still appear genuinely not started, consistent with the gaps noted in §7 and §6 of the engineering assessment. Roadmap doc not corrected here per instruction to reproduce documented decisions as-is, not re-interpret them.

## 16. Engineering workflow

**[Documented Product Decision — stated directly by the product owner in conversation.]** This workflow governs all future implementation work on RentalIntel, not just documentation:

- Always inspect before coding.
- Explain implementation before writing code.
- List every file to be modified.
- Wait for approval before implementation.
- Never modify unrelated files.
- Never remove existing functionality unless explicitly approved.
- Prefer extending existing components over creating duplicates.
- Preserve architecture consistency.
- Minimize changes — keep them minimal and architectural.
- Challenge unnecessary complexity.
- Treat existing omissions as intentional unless confirmed otherwise.

---

## 17. Product principle — a renter decision platform, not a review site

**[Documented Product Decision — stated directly by the product owner in conversation.]** RentalIntel is no longer simply a property review website. It is a renter decision platform. Every feature should help renters make better decisions before signing a lease. If a proposed feature does not improve renter decision-making, transparency, or trust, challenge whether it belongs in the MVP. This sharpens (does not replace) the mission stated in §1 — "Know it before you rent it" — by naming the *decision*, not just the *knowledge*, as the product's unit of value.

## 18. Homepage philosophy

**[Documented Product Decision — stated directly by the product owner in conversation.]** The homepage is the landing experience. Its responsibilities are to introduce RentalIntel, allow immediate searching, display the live discovery experience (map + list), and encourage community participation. It should **not** become the primary property-browsing experience — that role belongs to the Property Detail page (§19) and the canonical search results page (§21). This is why the homepage was deliberately left unchanged across the sessions that reworked `/property` and `/property/[slug]` — see §16's "never modify unrelated files."

## 19. Property Detail philosophy

**[Documented Product Decision — stated directly by the product owner in conversation.]** The Property Detail page (`app/property/[slug]/page.tsx`) is the heart of RentalIntel. Its purpose is to help a renter decide whether they should rent a specific property. Each page should: present property information, surface tenant experiences (reviews), allow writing a review, encourage stay verification, and naturally keep the user exploring rather than dead-ending the session. The last of these is implemented today as the page's own "Continue Exploring" section (§22) — reused search + related-property sections — rather than forcing the user back to the homepage or `/property` to keep browsing.

## 20. Search architecture — one implementation, one destination

**[Documented Product Decision — stated directly by the product owner in conversation.]** RentalIntel has exactly one search implementation. `HomeSearch`, `FiltersButton`, and `PropertyList` (all in/around `components/property/PropertyDiscovery.tsx` and `components/property/HomeSearch.tsx`) are the only search, filter, and result-card building blocks in the app — the homepage, the Property Detail page's "Continue Exploring" search widget (`components/property/DetailPageSearch.tsx`), and `/property` itself all compose the same three pieces rather than each implementing their own. `PropertyDiscovery.tsx`'s exported `filterProperties()` is likewise the single filtering function shared by every page that filters a property list. **Never introduce a second search, filter, or property-card component** — extend these three instead (§16). Any search performed anywhere in the app that isn't an in-place filter (i.e., the homepage's own map+list, which filters without navigating) should resolve to the canonical search results page, `/property` (§21), via URL query parameters (`city`, `areas`, `q`, `rentMin`, `rentMax`, `reviewsOnly`, `photosOnly`) — see `app/property/page.tsx`'s `searchParams` seeding.

## 21. Discovery flow

**[Documented Product Decision — stated directly by the product owner in conversation.]** The intended user journey:

```
Homepage
   ↓
Property Detail
   ↓
Continue Exploring
   ↓
Search Results (/property)
   ↓
Property Detail
   ↓
Repeat
```

The goal is to keep users discovering properties without repeatedly funneling them back through the homepage. The homepage remains the entry point (§18), but once a user reaches a Property Detail page, further browsing should route through that page's own "Continue Exploring" section (§22) and the canonical search results page (§21 below this one — `/property`), not back to `/`.

## 22. Search Results page (`/property`)

**[Documented Product Decision — stated directly by the product owner in conversation.]** `/property` is the application's canonical search results page. Its responsibility is limited to: search, filters, map, results. Nothing more — no homepage-style marketing copy, no duplicated landing content, no discovery/pitch copy of its own. Users are expected to arrive here through searches and exploration (from the homepage's own search, or from a Property Detail page's "Continue Exploring" widget), not as a first-touch landing page. As of this session, its heading is purely functional (reflects the current search — e.g. "Bengaluru properties" or "Koramangala, Bengaluru" — rather than a marketing headline), matching this constraint directly.

## 23. Related Properties

**[Documented Product Decision — stated directly by the product owner in conversation.]** Related-property sections on the Property Detail page (`components/property/RelatedProperties.tsx`) must always be backed by real, distinguishable data — never render two sections with duplicate content under different headings. The current, MVP-acceptable progression is:

- **Similar Properties** (same area as the current property) — this is the only similarity signal the schema currently supports (no price-band, bedroom-count, or amenity data to score against yet).
- **Top Reviewed in {City}** — ranked by review count (falling back to average rating), excluding whatever "Similar Properties" already showed. Named for exactly what signal it uses, rather than "Popular," which would overclaim (no view/save counts exist yet).

A section that would be empty, or that would exactly duplicate another section's contents, is not rendered at all. Future ranking signals under consideration, once available, include: **Trust Score**, **Verified Reviews**, **Recent Activity**, and **Popularity** (a genuine engagement metric, not review count standing in for it). The filtering logic behind each section is intentionally isolated into small, named functions (`getSimilarProperties()`, `getTopReviewedProperties()`) inside `RelatedProperties.tsx`, so that swapping in real backend queries later (e.g. dedicated `getSimilarProperties()`/`getPopularProperties()` RPCs) only touches that block, not the surrounding UI.

## 24. Developer Navigation

**[Documented Product Decision — stated directly by the product owner in conversation.]** The Developer Navigation section inside the Account menu (`components/shared/DeveloperNavigationMenu.tsx`, gated by `NEXT_PUBLIC_SHOW_DEV_NAV`) intentionally lists every route in the app, including the canonical search results page (`/property`) and pages not part of normal end-user navigation. This exists purely for developer productivity during active development — a single place to confirm every page still exists and works, so nothing is forgotten as the app grows — and is not user-facing product navigation. It must be disabled before public launch via the existing feature flag (already off by default — see `.env.example`). Badge wording should always describe *why* a route can't be clicked right now in accurate terms (e.g. "Context Required" for a page that needs live data such as a `reviewId`, "System Route" for a route that's never meant to be manually navigated, like the OAuth callback) — never "Coming Soon" or "Empty," which wrongly imply the feature itself is unfinished.

## 25. Add Property & the Property Detail contribution dashboard

**[Documented Product Decision — stated directly by the product owner in conversation.]** `app/add-property/page.tsx` / `PropertyForm.tsx` stay focused on property submission only — no inline review or verification capture there, deliberately, even though earlier drafts of this feature considered it. Once submitted, the user is redirected straight to the new property's detail page, which acts as that viewer's permanent, always-visible dashboard for their own contribution to that property via three status cards (`components/property/ContributionStatusCards.tsx`): **Property** (Pending Approval / Published / Not Approved), **Review** (Write Review → / Review Pending Approval / Review Published), and **Stay Verification** (a disabled state explaining verification requires a review first, until one exists → Verify My Stay → / Verification Pending / Verified Tenant). These cards are never hidden behind a click — showing the entire workflow up front was an explicit, deliberate choice over the click-to-reveal modal (`VerifyStayPrompt.tsx`) an earlier iteration used, which this superseded and removed.

**[Documented Product Decision — amended, see §26.]** The Review card above applies to a `tenant`/`helper`/legacy submission. A property submitted **as its owner** shows a Listing card instead and **no** Review or Verification card — an owner cannot review their own property. See §26.

**[Documented Product Decision — stated directly by the product owner in conversation.]** Stay Verification remains, permanently, tied to an existing review — `review_verifications.review_id` is `NOT NULL` and this is intentionally **not** being changed (no nullable `review_id`, no `property_id` column added to that table). The one deliberate schema change is narrower and lives entirely in `reviews`' own RLS: a property's creator can write and read their own review while the property is still pending approval (previously, review creation/reads were gated on the *property* being published, which made it impossible to review your own not-yet-approved property at all). Verification continuing to require a review is treated as a feature, not a limitation — it's explicitly framed as "reviews and verification are processed together to protect the integrity of the platform," not a technical gap to eventually close.

## 26. Roles, listings, and the account area

**[Documented Product Decision — stated directly by the product owner in conversation.]** RentalIntel supports **listing** (an owner advertising an available property) alongside its original knowledge contributions, using the **same `properties` entity**. There is deliberately **no `listings` table**, **no `owner_id`**, and **no property-claim flow**. A separate `listings` table earns its place only when rent *history over time* is needed (roadmap V3); until then it would force a join on every discovery query and either a second detail page or a merge layer.

**Provenance, not ownership.** `properties.submitted_as` (`owner` / `tenant` / `helper`, **nullable** — NULL means a legacy row of unknown provenance) records what the submitter *claims* their relationship to the property is. It is never verified and must never be presented as if it were: the property page labels an owner submission "Listed by owner (unverified)", the same honesty pattern the product already applies to unverified reviews. Because it is self-declared, the owner self-review block is a **good-faith guard against casual self-review, not fraud prevention** — an owner who claims `tenant` cannot be stopped by any schema. The real defenses remain stay verification (documents) and 100% manual approval.

**One submission route.** `/add-property` is the only submission flow; `?as=owner|tenant|helper` seeds the role selector, which is always shown and always re-validated server-side. There is no `/list-property`, and `/add-property` was not renamed. The three roles differ only in which fields appear and what happens afterwards:

| Role | Listing fields | Can review | Can verify |
|---|---|---|---|
| `owner` | rent, deposit, availability | **No** — blocked in RLS *and* at `/property/[slug]/review` | No |
| `tenant` | none (a tenant's paid rent belongs on their review, not the shared property record) | Yes | Yes, after a review |
| `helper` | none | No — blocked in the UI only, deliberately: "owner" is a permanent commercial conflict, "helper" is a temporary state | No |

**Property identity is immutable.** Migration 9 replaces blanket UPDATE on `properties` with a column-level grant, so `name`, `address_*`, `area`, `city`, `slug`, `status`, `created_by` and `submitted_as` are unreachable through the Data API **for everyone, including the creator**. This is what guarantees a property's identity can never drift away from the reviews permanently attached to it. Creating a property record therefore grants *commercial editing rights only* — never power over reviews, identity, or publication. See §12 for the fragility of this mechanism.

**Two orthogonal state axes, never merged.** `status` is the *moderation* state (human-gated, Dashboard-only); `is_available` is the *commercial* state (creator-controlled, any time). `is_available = false` removes only the "Available for rent" badge — the property page, its reviews and its history stay live and fully searchable, because a property's rental history must outlive any particular tenancy. This is why `'rented'` is deliberately **not** a `property_status` value, and why `getDiscoveryProperties` filters on `status` only.

**The availability badge is owner-only.** Before this work, `is_available` defaulted to `true` and nothing ever wrote it, so *every* property — including a tenant's contribution about the occupied flat they live in — was badged "Available for rent." That was false. The badge now requires `submitted_as = 'owner' && isAvailable`; legacy rows (NULL) correctly show nothing, and no data was backfilled.

**`/account` is intentionally thin.** Five routes behind one `layout.tsx` that owns the only chrome (auth gate + section nav): overview (counts only), properties, reviews (reuses `ReviewCard`), verifications, profile (`display_name`, the sole editable `profiles` column). **Every one of these queries is permitted by pre-existing RLS — this area added no policy.** Explicitly excluded and to stay excluded: analytics, charts, activity feeds, messaging, enquiries, notifications, ownership claims, admin UI, and wishlist UI.

---

## Open Questions

These require product-owner confirmation before Claude should treat any related assumption as settled:

1. ~~Is property/review approval currently happening manually (e.g. Supabase dashboard), or is there a planned admin surface not yet built?~~ **Resolved, Phase 4**: manual via Supabase Dashboard is the deliberate MVP process — see §7.
2. ~~Is the data loss in `ReviewForm` (quick ratings, owner traits, deposit details never submitted) an intentional stub, or a bug to fix?~~ **Resolved**: fixed — `createReview` now submits all collected fields atomically via the `create_review` RPC (migrations 5–6 in §7).
3. Which visual palette is the intended brand target — the slate/minimal system or the documented blue-accent (#2563EB) system — so the in-progress brand migration has a clear destination? (Partial signal since this was last written: the homepage/property pages now use slate as the structural base with `blue-600` as a restrained interactive accent — see §10. Not yet confirmed as the final answer.)
4. Is the "current sprint" described in `RentalIntel_Master_Context_v1.md` (Brand migration, UI polish, Shared components) still accurate, or superseded by the Supabase/auth/verification work already shipped?
5. Should the §12 "changes requiring approval" list be adopted as-is, adjusted, or replaced?
6. Should `docs/Architecture.md`, `docs/PROJECT_STRUCTURE.md`, `docs/RentalIntel-Blueprint.md`, and `RentalIntel_Transition_v1.md` be updated to match current reality, or kept as historical record with this file as the current source of truth?

---

## Future Updates

This document should evolve alongside the project. Whenever a session makes (or the product owner states) an architectural or product decision that future sessions need to remember, Claude should **ask whether it belongs in `CLAUDE.md`** before adding it — never add silently, and never promote a Current Working Assumption to a Documented Product Decision without the product owner confirming it explicitly first.
