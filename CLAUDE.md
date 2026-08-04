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

**[Documented Product Decision]** RentalIntel is a rental-intelligence platform, not a listings/marketplace site. It preserves rental history and tenant experience by attaching it permanently to the property rather than the tenant, so that knowledge doesn't disappear when someone moves out. Initial market focus is Bangalore rentals.

**[Documented Product Decision]** Mission: help tenants make informed rental decisions through community knowledge, verified reviews, and trustworthy property intelligence. Tagline: "Know it before you rent it."

**[Verified Fact]** The current implementation supports: searching/browsing published properties, viewing a property's detail page with reviews and images, submitting a new property (pending manual approval), writing a review while signed in, and submitting stay-verification documents against a review.

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

**[Verified Fact — known gap]** `getDiscoveryProperties()` accepts a `city` parameter but does **not** filter the query on it. `properties.city` is free-text in the current data and inconsistently cased (`"Bengaluru"`, `"BENGALURU"` — never `"Bangalore"`, which is what `lib/cities.ts` uses as the canonical name). An `.eq("city", city)` filter was tried and reverted after it silently returned zero properties. Real city filtering needs the `city` column normalized (or constrained) first — see §13.

**[Current Working Assumption]** Business logic embedded directly inside `page.tsx` files (notably `app/property/[slug]/page.tsx`, which does row-shaping, rating aggregation, and date formatting inline) is not yet extracted to `lib/`, unlike `property-discovery.ts`. Whether this should be refactored, or is acceptable as-is for current scale, is unresolved — see §12/§16 (extend, don't refactor, without approval).

## 5. Folder structure

**[Verified Fact]**

```
app/
  actions/         Server Actions: auth.ts, property.ts, review.ts, verification.ts
  auth/callback/    OAuth / magic-link callback route handler
  add-property/     Add-property page
  login/, signup/   Auth pages
  property/         /property listing, /property/[slug] detail, review + verify sub-routes
  layout.tsx, page.tsx, globals.css

components/
  property/         PropertyDiscovery.tsx (PropertyToolbar, PropertyList, filterPropertiesByArea, default PropertyDiscovery page shell), AreaSelector, PropertyGallery, ReviewSection, ReviewCard, PropertyShareButton
  review/           ReviewForm, VerifyStayForm, StarRating, reviewCategories.ts
  add-property/     PropertyForm, InfoCard, SectionTitle
  login/            LoginForm, SignupForm
  shared/           Button, InputField, TextAreaField, AuthCard, AuthHeader, AuthLayout, AccountMenu, TrustBadge, Logo
  SearchBar.tsx, CitySelector.tsx   (top-level; not currently in shared/ — see §13)

lib/
  supabase/client.ts   browser Supabase client
  supabase/server.ts   server Supabase client (cookie-aware)
  property-discovery.ts  aggregation query for property listings
  cities.ts               city/locality single source of truth (see §4)

supabase/migrations/   hand-written, timestamped SQL migrations (schema + RLS)
docs/                  product/architecture documentation (see §0 for accuracy caveats)
data/                  empty — fossil from pre-Supabase mock-data era
public/                static assets
```

**[Current Working Assumption]** `data/` and the top-level `.agents/` directory are both empty and appear to be leftovers. Treated as intentional/inert unless the product owner says otherwise (per §16's "treat existing omissions as intentional").

## 6. Tech stack

**[Verified Fact]**, from `package.json`:

- Next.js 16.2.10 (App Router)
- React 19.2.4 / React DOM 19.2.4
- TypeScript 5.x, strict mode enabled (`tsconfig.json`)
- Tailwind CSS 4.x (via `@tailwindcss/postcss`)
- `@supabase/supabase-js` 2.110.8 and `@supabase/ssr` 0.12.3
- ESLint 9.x with `eslint-config-next`
- No test framework, no test files present anywhere in the repo.
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

**[Verified Fact]** RLS is enabled on every `public` table. Public (anon) reads are generally scoped to `status = 'published'` (properties) or to records whose parent property is published; write access is scoped to `auth.uid()` matching the relevant owner/author column.

**[Current Working Assumption]** There is no visible mechanism anywhere in this repo (no admin route, no admin Server Action, no moderation UI) for transitioning a property from `pending` to `published`, or a review verification from `pending` to `verified`/`rejected`. This strongly suggests that step happens manually today (e.g. directly in the Supabase dashboard), but this is inferred, not confirmed — see Open Questions below.

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
- The authentication flow (`proxy.ts`, `lib/supabase/*`, `app/auth/callback/route.ts`).
- The database schema (table shapes, enums, constraints).
- Which visual/brand palette is canonical (until the Open Question in §9 is resolved).
- Anything that changes what data is publicly readable vs. gated.

This list is a proposal, not a settled rule — see Open Questions.

## 13. Existing technical debt

**[Verified Fact]**

- `ReviewForm.tsx` collects quick-category ratings, owner-trait tags, deposit amount/timeline/deduction details, and a "would rent again" answer via local component state, but `handleSubmit` only forwards `overallRating`, `recommendation`, and `comment` to `createReview`. All other collected fields are discarded on submit, despite the schema already having `review_category_ratings` and `review_issues` tables that appear built to receive exactly this data.
- `app/layout.tsx` retains default Next.js metadata (`title: "Create Next App"`, generic description).
- The `/login?next=...` redirect chain does not encode a nested query string, risking loss of `reviewId` on the verify-stay flow after a login round-trip (see §8).
- Two coexisting visual design systems (see §9).
- Dark mode is declared in `globals.css` (`prefers-color-scheme: dark` CSS variables) but not actually implemented — nearly all components hardcode light-mode Tailwind classes instead of using the CSS variables.
- No automated tests anywhere in the repository.
- `data/` and `.agents/` directories are empty and appear to be unused fossils.
- `SearchBar.tsx` / `CitySelector.tsx` live outside `components/shared/` despite being shared, reusable components.
- `properties.city` is free-text and inconsistently cased (`"Bengaluru"`, `"BENGALURU"`) — never matches `lib/cities.ts`'s canonical `"Bangalore"`. Blocks real city-based query filtering; see §4.
- `/property`'s "Locality explorer" sidebar keeps its own small hardcoded 6-item locality list, separate from the fuller `LOCALITIES_BY_CITY` lookup (`lib/cities.ts`) that now powers the `AreaSelector` dropdown on the same page. Known, disclosed duplication — not reconciled yet.
- The homepage panel's scroll cap (`PropertyList`'s `lg:max-h-[21.75rem]`) and its pixel-for-pixel alignment to the left column's heading top / CTA-underline bottom are hand-calibrated fixed values tied to the current left-column copy length, not dynamically synced. If that copy changes materially, the two columns' alignment will need recalibrating — there's no JS-based height sync in place.

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

## Open Questions

These require product-owner confirmation before Claude should treat any related assumption as settled:

1. Is property/review approval currently happening manually (e.g. Supabase dashboard), or is there a planned admin surface not yet built?
2. Is the data loss in `ReviewForm` (quick ratings, owner traits, deposit details never submitted) an intentional stub, or a bug to fix?
3. Which visual palette is the intended brand target — the slate/minimal system or the documented blue-accent (#2563EB) system — so the in-progress brand migration has a clear destination? (Partial signal since this was last written: the homepage/property pages now use slate as the structural base with `blue-600` as a restrained interactive accent — see §10. Not yet confirmed as the final answer.)
4. Is the "current sprint" described in `RentalIntel_Master_Context_v1.md` (Brand migration, UI polish, Shared components) still accurate, or superseded by the Supabase/auth/verification work already shipped?
5. Should the §12 "changes requiring approval" list be adopted as-is, adjusted, or replaced?
6. Should `docs/Architecture.md`, `docs/PROJECT_STRUCTURE.md`, `docs/RentalIntel-Blueprint.md`, and `RentalIntel_Transition_v1.md` be updated to match current reality, or kept as historical record with this file as the current source of truth?

---

## Future Updates

This document should evolve alongside the project. Whenever a session makes (or the product owner states) an architectural or product decision that future sessions need to remember, Claude should **ask whether it belongs in `CLAUDE.md`** before adding it — never add silently, and never promote a Current Working Assumption to a Documented Product Decision without the product owner confirming it explicitly first.
