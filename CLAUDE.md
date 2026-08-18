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
                                                      actions/         Server Actions: auth.ts, property.ts (createProperty + updateProperty), review.ts (create + update,
                                                                        see §7 migration 21), verification.ts, profile.ts, wishlist.ts, messages.ts (property-thread +
                                                                        support-chat sends/reads, see §26), admin.ts (moderateProperty/moderateVerification, see §7),
                                                                        broker-interest.ts (submitBrokerInterestVote/getBrokerInterestResults, see §7 migration 20),
                                                                        broker.ts (registerBroker/deactivateBroker, see §7 migration 22)
                                                      auth/callback/    OAuth / magic-link callback route handler
                                                      account/          Authenticated account area (see §26): layout.tsx (auth gate + nav),
                                                                        overview, properties/, properties/[slug]/edit, reviews/, wishlist/, brokers/, verifications/, profile/.
                                                                        No messages/ route — see §26, messaging moved to the global chat widget.
                                                      admin/            Moderation interface (see §7): layout.tsx (auth + is_admin gate), properties/, properties/[slug]/,
                                                                        verifications/, verifications/[id]/, reviews/, support/ (the admin side of the chat widget's
                                                                        support channel, see §26 migration 21/23)
                                                      add-property/     Add-property page (role-aware via ?as=owner|tenant|helper)
                                                      add-broker/       Broker self-registration (create-or-edit, see §7 migration 22)
                                                      brokers/          Public broker directory
                                                      login/, signup/   Auth pages
                                                      property/         /property listing, /property/[slug] detail, review + verify sub-routes
                                                      layout.tsx, page.tsx, globals.css

                                                    components/
                                                      property/         PropertyDiscovery.tsx (PropertyList, FiltersButton, filterProperties, default PropertyDiscovery page shell — the canonical search results page, §22), HomeDiscovery.tsx (homepage shared-state owner, see §4), HomeSearch.tsx (city+area+text search bar, reused by the homepage, /property, and DetailPageSearch — see §20), DetailPageSearch.tsx (Property Detail page's search widget, composes HomeSearch + FiltersButton, no logic of its own), RelatedProperties.tsx (Similar/Top Reviewed sections + "Continue Exploring", see §23), ContributionStatusCards.tsx (the Property/Review/Stay Verification status cards on the Property Detail page — always visible, never hidden behind a click, see §25), WishlistButton.tsx (save/unsave, see §26), ContactContributor.tsx (the "Contact owner"/"Contact contributor" action — starts a property conversation; continuing it happens in the chat widget, see §26), PropertyMap.tsx (MapLibre + OSM), DualRangeSlider.tsx, AreaMultiSelect.tsx, PropertyGallery, ReviewSection, ReviewCard, PropertyShareButton. `AreaSelector.tsx` (single-select) is no longer used anywhere — superseded by `AreaMultiSelect.tsx` — kept but inert, not deleted (see §16's "treat existing omissions as intentional"). `VerifyStayPrompt.tsx` (a click-to-reveal modal, an earlier iteration of the verify-before-review guidance) was removed in favor of ContributionStatusCards' always-visible card.
                                                      review/           ReviewForm, VerifyStayForm, StarRating, reviewCategories.ts
                                                      add-property/     PropertyForm, RoleSelector (owner/tenant/helper claim, see §26), PropertyAttributeFields (configuration/
                                                                        property type/furnishing/area/amenities, shared by add and edit), ContactPreferenceFields (phone/email/message/none,
                                                                        shared by add and edit), InfoCard, SectionTitle
                                                      add-broker/       BrokerForm (self-registration, create-or-edit)
                                                      broker/           BrokerCard, BrokerDirectory (public directory, city/area filtering)
                                                      account/          AccountSectionNav (built on shared/SectionNav), AccountPrimitives (StatusPill/EmptyState — now
                                                                        also reused by components/admin/, see below), ProfileForm, PropertyEditForm (the commercial/attribute/
                                                                        contact edit form for a contributor's own property), BrokerListingActions (self-service broker
                                                                        listing management). No MessageReplyForm/MarkMessagesReadOnMount — deleted, see §26.
                                                      admin/            AdminSectionNav (built on shared/SectionNav), PropertyModerationActions, VerificationModerationActions,
                                                                        SupportInbox (the support-chat inbox behind /admin/support, see §26)
                                                      home/             ListYourPropertySection (the homepage's role entry points, §26), BrokerDirectorySection.tsx (homepage
                                                                        broker directory placement, see §7 migration 22), BrokerInterestSurvey.tsx (homepage
                                                                        yes/no poll on whether the directory above is worth keeping — see §7 migration 20),
                                                                        NeedSupportSection.tsx (homepage entry point into the chat widget's support thread, see §26)
                                                      login/            LoginForm, SignupForm
                                                      shared/           Button, InputField, SelectField (the select counterpart to InputField), TextAreaField, AuthCard,
                                                                        AuthHeader, AuthLayout, AccountMenu, ChatWidget.tsx (the floating property-message + support-chat
                                                                        widget, see §26), DeveloperNavigationMenu, TrustBadge, Logo, AuthDivider,
                                                                        UseMyLocationButton, StatusPrimitives (StatusPill/EmptyState), SectionNav (pill nav shared by
                                                                        /account and /admin — written for one, generalised in place for the other, not duplicated)
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
                                                      admin.ts                 isAdminUser()/requireAdmin() — admin_users membership check (see §7)
                                                      property-attributes.ts   canonical configuration/property-type/furnishing/contact-method/amenities vocab, mirroring
                                                                                the Postgres enums (migrations 12 and 18 in §7) character-for-character — the single
                                                                                source of truth "1 RK" (not "1RK") is defined against. Amenities is a checked text[],
                                                                                not an enum, since a property can hold several at once
                                                      verification.ts          VERIFICATION_DOCUMENT_LABELS + formatVerifiedVia() — turns
                                                                                ["rental_agreement","rent_receipt"] into "Rental agreement and Rent receipt" for the
                                                                                "Verified via ..." disclosure line (see §7 migration 19)
                                                      broker-interest.ts       summarizeBrokerInterestVotes() — pure aggregation for the homepage broker poll
                                                      rent-insights.ts         aggregateRentByArea() — pure area-level rent summary for /property, with a minimum
                                                                                sample size before an area's figure is shown (see §7 migration 22)
                                                      broker-community-groups.ts  a small, hand-picked, links-only list of external Facebook rental/flatmate groups —
                                                                                not scraped, no group content or member data pulled in (see §7 migration 22)
                                                      messaging.ts             groupPropertyMessagesIntoThreads()/groupSupportMessagesIntoThreads() — pure functions
                                                                                turning flat property_messages/support_messages rows into per-conversation threads
                                                                                for the chat widget (see §26 migration 21/23)
                                                      property-roles.ts        canonical owner/tenant/helper submitter-role vocab; deliberately not "use client" so a
                                                                                Server Component can import it directly (see §26)
                                                      embedded.ts              one() — normalizes a PostgREST embedded relationship that PostgREST returns as an object
                                                                                for a many-to-one embed and an array for a one-to-many one; reading it as always-array
                                                                                previously made reviewer names and property links silently vanish
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

                                                    **Core tables**: `profiles` (mirrors `auth.users`, auto-created via `handle_new_user` trigger), `properties` (status enum: `pending` / `published` / `rejected`, though see migration 16 — a submission may now insert directly as `published`; `is_available boolean not null default true` as of the 4th migration below), `property_images`, `reviews` (verification_status enum: `unverified` / `pending` / `verified` / `rejected`; recommendation enum: `yes` / `maybe` / `no`; `is_anonymous boolean` — existed since the initial schema but only gained a write path in migration 17), `review_categories` (static, seeded), `review_category_ratings`, `review_issues` (tagged issue types), `wishlists`, `review_verifications`, `verification_documents`, `broker_interest_votes` (migration 20 — a public opinion poll, not a broker feature). One view: `review_verified_document_types` (migration 19), a narrow owner-privileged read exposing only `document_type` for already-`verified` requests, so a "Verified Tenant" badge can disclose what was verified without widening `verification_documents`' own restricted RLS.

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
                                                    10. `20260809000000_add_property_landmark.sql` — adds `properties.landmark`, its own field rather than folded into free-text notes (see §4's Add Property notes on the same topic).
                                                    11. `20260809000001_add_admin_moderation.sql` — adds `admin_users` (membership only, no permission levels) and `public.is_admin()` (`SECURITY INVOKER`, reads `auth.uid()`); grants a column-scoped `UPDATE (status)` on `properties` and `UPDATE (status, reviewed_at, reviewed_by, rejection_reason)` on `review_verifications` to `authenticated`, each gated by an `is_admin()` RLS policy. This is the migration behind `/admin` — see the amended §7 below; membership is granted only via the Supabase Dashboard, never in-app.
                                                    12. `20260810000000_add_property_attributes_and_contact.sql` — adds `configuration`/`property_type`/`furnishing`/`carpet_area_sqft` and the `property_configuration`/`property_type`/`property_furnishing` enums (mirrored exactly in `lib/property-attributes.ts`, including the space in `'1 RK'`); adds `contact_method` plus `property_contacts` (phone/email, deliberately off the publicly-readable `properties` table) and `property_messages` (flat: sender/recipient/body, no threading at the time this migration was written).
                                                    13. `20260810000001_allow_contributor_property_edits.sql` — widens the column-scoped UPDATE grant on `properties` so a contributor can edit their own commercial/attribute fields (rent, deposit, availability, attributes, contact method); adds a `BEFORE UPDATE` trigger (`enforce_property_status_moderation`) blocking `status` changes from any non-admin `authenticated` caller, while leaving `postgres`/`service_role` untouched so Dashboard moderation keeps working.
                                                    14. `20260811000000_add_message_replies_and_read_state.sql` — adds `property_messages.read_at` (column-scoped UPDATE grant, recipient-only) and widens the message INSERT policy so a property's creator may reply to someone who has already messaged them about that property — narrowly: a creator still cannot initiate contact with a stranger, only answer one who reached out first.
                                                    15. `20260812000000_add_property_coordinates.sql` — adds `properties.latitude`/`longitude` (nullable, both-or-neither), an exact per-property pin that wins over the area-centroid approximation whenever present (see §4, §13). Added to the same column-scoped UPDATE grant as `landmark`/attributes — refining where a known property sits is not a change to which property a review is attached to.
                                                    16. `20260813000000_remove_property_submission_moderation_gate.sql` — **product decision, not a bug fix**: a property submission may now be inserted with `status = 'published'` directly, bypassing the pending-approval gate every earlier migration and this file assumed. `createProperty` (`app/actions/property.ts`) does exactly this — every new property is live immediately. Deliberately narrow: review verification (`review_verifications`/`moderateVerification`) is untouched, and an administrator can still change a property's status afterward (e.g. to reject it) via the unchanged `enforce_property_status_moderation` trigger. **This means the "100% manual approval" characterization of property submission elsewhere in this file (§2, §26) is no longer accurate for properties** — it still describes review verification correctly, but not property publication. Flagged here rather than silently corrected throughout, since it changes a trust-model claim the product philosophy section leans on.
                                                    17. `20260814000000_add_review_anonymity_param.sql` — `reviews.is_anonymous` existed since the initial schema and was already read (property page, `/admin/reviews`) but never written; adds the missing `p_is_anonymous` parameter to `create_review` (had to explicitly `DROP FUNCTION` the old 18-param signature first — appending a parameter via `CREATE OR REPLACE` silently creates a second overload rather than replacing the original, which then makes every unqualified call/grant ambiguous). `ReviewForm.tsx` now has a real "Post this review anonymously" checkbox.
                                                    18. `20260815000000_add_property_amenities.sql` — adds `properties.amenities text[]`, checked against the same 8-value list the Filters panel already rendered as a disconnected "coming soon" placeholder (`lib/property-attributes.ts`'s `AMENITIES`). Deliberately a validated array, not a lookup table — mirrors the existing `reviews.positive_owner_traits`/`negative_owner_traits` pattern rather than introducing a new one, per the explicit "no untyped text[]" objection recorded in migration 12's own comment (the objection was to *validation*, not the array type). Column added to the existing contributor UPDATE grant. The Filters panel's amenities group now actually filters (AND semantics: a property must have every selected amenity).
                                                    19. `20260817000000_disclose_verification_document_types.sql` — adds `public.review_verified_document_types`, a narrow view (owner-privileged, not `security_invoker`) exposing only `document_type` for already-`verified` `review_verifications` rows. Lets a "Verified Tenant" badge say *what* was verified (e.g. "Rental agreement and Rent receipt" — `lib/verification.ts`) without widening `verification_documents`' own RLS, which must stay restricted since `storage_path` on those rows points into the private `verification-documents` bucket.
                                                    20. `20260818000000_add_broker_interest_votes.sql` — adds `public.broker_interest_votes` (one boolean + timestamp, no identity captured), open to `anon` and `authenticated` for both read and insert. Backs a homepage yes/no poll ("Should RentalIntel include a broker listings section?") asking whether a broker feature is worth building — not a broker feature itself; there is still no broker role anywhere in the schema (see `POSTED_BY_OPTIONS`'s comment in `lib/property-attributes.ts`).
                                                    21. `20260819000000_add_review_editing_amenities_and_deposit_amount.sql` — adds the columns behind letting a contributor edit a review they already submitted, plus deposit-deduction-amount and amenity fields the review form now collects. Paired with `app/actions/review.ts` gaining an update path and `/property/[slug]/review` becoming create-or-edit depending on whether the signed-in viewer already has a review on that property.
                                                    22. `20260820000000_add_broker_directory.sql` — adds `public.brokers` and `public.broker_contacts`, backing the self-registration broker directory at `/brokers`/`/add-broker`/`/account/brokers` — RentalIntel's own answer to "populate a broker list" once scraping third-party sources (including public Facebook groups) was declined as a path (see the broker directory's own design notes for the reasoning). Contact info is fully public, no sign-in gate, matching the product owner's explicit instruction. `lib/rent-insights.ts`'s area-level rent summary on `/property` is application-layer only (aggregates existing `properties` rows) and needed no schema change.
                                                    23. `20260821000000_add_full_thread_messaging_and_support_chat.sql` — the messaging reversal described in §26: widens `property_messages`' INSERT policy to allow real back-and-forth (any prior message between the same two people on the same property, either direction, unlocks replying — no longer capped at one reply), and adds `public.support_messages`, a one-thread-per-user channel any administrator can read and answer via the existing `is_admin()` gate. `/account/messages` and its two supporting components were deleted outright; the only interface for either channel is now the floating chat widget described in §26.

                                                    **[Verified Fact]** RLS is enabled on every `public` table. Public (anon) reads are generally scoped to `status = 'published'` (properties) or to records whose parent property is published; write access is scoped to `auth.uid()` matching the relevant owner/author column.

                                                    **[Documented Product Decision — amended, stated directly by the product owner in conversation.]** The Phase 4 decision below (originally: no admin route, none planned for MVP) has been superseded. **`/admin` is now the canonical moderation interface.** It exists (`app/admin/**`, `components/admin/**`, `lib/admin.ts`, `app/actions/admin.ts`), is gated by `isAdminUser()`/`requireAdmin()` (membership in `admin_users`, grantable only via the Supabase Dashboard — see migration 11 in §7 above), and every write it makes is a column-scoped, `is_admin()`-gated RLS policy (migrations 11 and 13), not a service-role bypass. This was a real architectural decision, not a silent drift: `/admin` was built ahead of this document being updated to match, which §0's whole premise exists to catch — flagged and resolved in this pass rather than left unreconciled.

                                                    The original Phase 4 process — approving a property or review verification directly via the Supabase Dashboard's Table Editor — **still works and remains a valid fallback** (RLS still permits it for the `postgres`/`service_role` roles the Dashboard uses; migration 13's status-guard trigger explicitly exempts them, see below). It is no longer the *only* path, and `/admin` is the one to reach for day to day:

                                                    1. Sign in as an administrator and open `/admin`.
                                                    2. **To approve a property**: `/admin/properties` lists pending submissions; open one and decide (`components/admin/PropertyModerationActions.tsx` → `moderateProperty()` in `app/actions/admin.ts`, column-scoped `UPDATE (status)`).
                                                    3. **To verify a review**: `/admin/verifications` lists pending requests; open one, inspect the linked `verification_documents`, and decide (`VerificationModerationActions.tsx` → `moderateVerification()`). The `review_verifications_sync_status` trigger (migration 1) still propagates this to `reviews.verification_status` the same as before.
                                                    4. **Fallback**, unchanged from the original process: the Supabase Dashboard's Table Editor, for a Supabase project owner/admin without `admin_users` membership, or if `/admin` itself is ever unavailable.

                                                    Membership in `admin_users` is still Dashboard-only, never in-app — that half of the original decision is unchanged. What changed is that a member now has a real UI instead of raw table editing for day-to-day moderation.

                                                    ## 8. Authentication flow

                                                    **[Verified Fact]**

                                                    - Two sign-in methods: Google OAuth (`signInWithOAuth`) and passwordless email magic link (`signInWithOtp`), both initiated client-side in `LoginForm.tsx` / `SignupForm.tsx` via `lib/supabase/client.ts`.
                                                    - Both redirect through `app/auth/callback/route.ts`, which calls `exchangeCodeForSession(code)` and redirects on to a `next` path (defaulting to `/`), with an open-redirect guard (`next` must start with `/` and not `//`).
                                                    - `proxy.ts` runs on every non-static request, refreshing the Supabase session cookie via `getUser()`.
                                                    - Server Components/Actions check auth via `supabase.auth.getUser()` (e.g. `app/add-property/page.tsx`, `app/actions/property.ts`, `app/actions/review.ts`, `app/actions/verification.ts`) and redirect to `/login?next=...` or return an error when unauthenticated.
                                                    - `app/layout.tsx` reads the current user server-side to decide whether to render `AccountMenu` or Login/Sign Up links.

                                                    **[Verified Fact — resolved]** The redirect chain into `/property/[slug]/review/verify?reviewId=...` previously did not URL-encode the nested query string when building the `next` param for `/login`, which could drop `reviewId` after a login round-trip. Fixed: `app/property/[slug]/review/verify/page.tsx` now wraps the nested path in `encodeURIComponent`, matching the pattern already used by `app/add-property/page.tsx` and `app/account/properties/[slug]/edit/page.tsx`.

                                                    ## 9. Shared component conventions

                                                    **[Verified Fact]** `components/shared/` holds the reusable primitives: `Button`, `InputField`, `TextAreaField`, `AuthCard`, `AuthHeader`, `AuthLayout`, `AccountMenu`, `TrustBadge`. Feature-specific components live under their own folder (`property/`, `review/`, `add-property/`, `login/`).

                                                    **[Current Working Assumption]** `SearchBar.tsx` and `CitySelector.tsx` sit at the top level of `components/` rather than in `shared/`, even though they're reused across the homepage and `/property`. Not yet confirmed whether this should move — see §16 (extend existing structure, don't restructure without approval).

                                                    **[Verified Fact — resolved since first written]** The two-visual-system split described here in earlier sessions no longer exists. `app/globals.css` now defines one token system (`--surface`, `--surface-raised`, `--border-subtle`, `--foreground`, `--muted`, `--accent`, `--accent-hover`, `--accent-warm`, `--success`, `--warning`, `--danger`) applied consistently across every component checked, including the ones previously flagged as outliers (`LoginForm`, `SignupForm`, `ReviewForm`, `ReviewCard`, `AuthHeader`, `InputField`, `AuthCard`, `Button`) as well as the newer slate-structured pages (`PropertyDiscovery`, `PropertyGallery`, the property detail page, the homepage, `/account`, `/admin`). `InputField.tsx`'s focus ring is `focus:ring-accent/25`, not a separate `#1B4332` — that deviation is gone. See §10 for what the unified palette actually is.

                                                    ## 10. UI/UX principles

                                                    **[Documented Product Decision]**, from `docs/Architecture.md`:

                                                    - Pages fetch and compose data; components render UI.
                                                    - One source of truth for data; avoid duplicating business logic.
                                                    - Keep components reusable and focused; business logic should move into `lib/` over time.

                                                    **[Documented Product Decision]**, from `RentalIntel_Transition_v1.md`: fast comprehension, minimal friction, strong readability, clear navigation, short journeys, low cognitive load, progressive disclosure. The property page favors reading over interaction — users primarily consume information.

                                                    **[Verified Fact — supersedes the blue-accent spec below]** The originally documented brand spec (background white #FFFFFF, text black #111827, accent blue #2563EB) is no longer what the app uses. `app/globals.css`'s own header comment records the actual history directly: a v1 dark theme, a v2 coral accent, and the current v3 — "one bold color does the work," moved to a deep forest emerald. The live token values: `--background: #fdfbf7`, `--surface: #ffffff`, `--surface-raised: #eef5f0`, `--border-subtle: #dbe6df`, `--foreground: #1b2b22`, `--muted: #66786d`, **`--accent: #0e8f5e`** (not blue), `--accent-hover: #0b7249`, `--accent-warm: #e08e00` (used once, the unread-message badge, for contrast against the green — not a second brand color), `--success: #0d9488` (deliberately a different, teal-leaning green from `--accent`, so a status badge and an interactive element never collide in hue), `--warning: #b45309`, `--danger: #dc2626`. Normal actions are outlined/secondary buttons that pick up the accent on hover; high-impact actions are solid `bg-accent` buttons — the same normal/high-impact distinction the original spec described, just with the accent hue changed.

                                                    **[Verified Fact]** This is now the single palette across the entire app — the §9 "two coexisting systems" split is resolved (see that section). There is no remaining blue-600 interactive accent anywhere: the one place `blue-600`/`blue-500` still appears is a decorative map-pin marker in `PropertyMap.tsx`, which is not part of the UI chrome and not a competing system.

                                                    **[Documented Product Decision — stated directly by the product owner in conversation]** The homepage hero's current two-column pattern (a `rounded-2xl`, subtly tinted panel — `#f6f6f4` against the page's `#fbfbfa`, no borders, pixel-aligned to the opposite column's text) is intended to be the template for additional homepage sections built below it in the future, mirrored left/right per section (i.e. alternating which side carries the tinted panel vs. the plain-background content). Not yet built — noted here so future sections start from this stated intent rather than inventing a new layout language.

                                                    ## 11. Coding standards

                                                    **[Documented Product Decision]**, from `RentalIntel_Transition_v1.md`, largely consistent with observed code: descriptive/consistent naming, PascalCase components, reusable UI preferred over duplicated markup, no large "god components," strict TypeScript preferred over `any`, single styling approach (Tailwind utilities only, no competing CSS system).

                                                    **[Verified Fact — deviations observed]**:
                                                    - Business logic (data shaping, aggregation, formatting) is written inline in some `page.tsx` files rather than extracted to `lib/`, inconsistent with the "business logic belongs in lib/" principle (see §4).
                                                    - `app/layout.tsx` still carries the default `create-next-app` metadata (`title: "Create Next App"`).

                                                    **[Verified Fact — resolved since first written]** `components/shared/InputField.tsx`'s type import is at the top of the file (`import type { ChangeEventHandler } from "react"`) — the earlier deviation noted here no longer exists.

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
                                                    - `data/` and `.agents/` directories are empty, untracked by git, and appear to be unused fossils.
                                                    - `SearchBar.tsx` / `CitySelector.tsx` live outside `components/shared/` despite being shared, reusable components. Not yet moved.
                                                    - **[Resolved]** The "two coexisting visual design systems" item formerly listed here is gone — see §9/§10: the app now runs one token-based palette everywhere. Dark mode is also no longer declared in `globals.css` at all (no `prefers-color-scheme: dark` block remains) — not "declared but unused" any more, simply absent; light mode is the only theme this app currently defines.
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

                                                    **[Current Working Assumption]** Several "in progress" Version 1 items (User Authentication, Supabase Integration) are actually complete per the current code; "Admin Verification Panel" is also now done, via `/admin` (see the amended §7); "RentalIntel ID" still appears genuinely not started. Roadmap doc not corrected here per instruction to reproduce documented decisions as-is, not re-interpret them.

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

                                                    **Two orthogonal state axes, never merged.** `status` is the *moderation* state (human-gated — via `/admin` or the Supabase Dashboard fallback, see §7); `is_available` is the *commercial* state (creator-controlled, any time). `is_available = false` removes only the "Available for rent" badge — the property page, its reviews and its history stay live and fully searchable, because a property's rental history must outlive any particular tenancy. This is why `'rented'` is deliberately **not** a `property_status` value, and why `getDiscoveryProperties` filters on `status` only.

                                                    **The availability badge is owner-only.** Before this work, `is_available` defaulted to `true` and nothing ever wrote it, so *every* property — including a tenant's contribution about the occupied flat they live in — was badged "Available for rent." That was false. The badge now requires `submitted_as = 'owner' && isAvailable`; legacy rows (NULL) correctly show nothing, and no data was backfilled.

                                                    **`/account` is intentionally thin — amended twice, then had one section removed entirely.** When this was first written, five routes were the deliberate ceiling, with messaging and wishlist UI named explicitly as things to stay excluded. Both were later built as a considered exception rather than scope creep. Messaging has since moved again — see below — so **`/account` now has six routes**: overview (counts only), properties, reviews (reuses `ReviewCard`), wishlist, verifications, profile (`display_name`, the sole editable `profiles` column) — behind the same one `layout.tsx` chrome. **Every one of these queries is permitted by pre-existing RLS or a narrowly-added one — no blanket widening.** Wishlist's full list view reuses `PropertyList` (§20 — no bespoke card), backed by `getWishlistedProperties()` in `lib/property-discovery.ts`, which shares its property-enrichment logic with `getDiscoveryProperties()` via an extracted `enrichProperties()` helper rather than a second implementation. No new RLS was needed for wishlist — `wishlists` has had a "read your own" policy since the initial schema.

                                                    **Messaging — reversed from "deliberately minimal" to full threading, and moved out of `/account` entirely. This is a real, explicit product-owner decision, not scope creep.** The original design (`property_contacts`/`property_messages`, migration 12; one reply per sender, migration 14) is recorded above in the migration list for history, but is no longer what the product does. As of migration 21 (`20260821000000_add_full_thread_messaging_and_support_chat.sql`):

                                                    - `property_messages`' INSERT policy now allows unlimited back-and-forth: any message is permitted once a prior message already exists between the same two people on the same property, in either direction — not just a single creator-replies-once bounce. The table, its columns, and `read_at` tracking are unchanged; only the policy widened.
                                                    - A new `support_messages` table backs a second, separate channel: a user talking to "RentalIntel," not to another contributor. One thread per `user_id`; `sender_id` records who actually wrote each message (the user, or whichever administrator replies) — there is no separate "support agent" role, any administrator passing the existing `is_admin()` check (§7) can read and answer any thread, the same way any admin can moderate any property.
                                                    - **`/account/messages` is gone — deleted, not redirected**, along with `MessageReplyForm.tsx` and `MarkMessagesReadOnMount.tsx`. The only interface for either channel is a floating chat widget (`components/shared/ChatWidget.tsx`), rendered globally from `app/layout.tsx` for every visitor (its bubble is `fixed bottom-4 right-4`; clicking it while signed out redirects through `/login`, the same pattern `WishlistButton`/`ContactContributor` already used). Desktop opens a corner panel; mobile opens a full-screen takeover — confirmed deliberately, not an oversight, since a cramped corner box doesn't work for typing on a phone.
                                                    - No realtime/websocket infrastructure exists anywhere in this codebase. The widget polls (`getMessageThreads`/`getSupportThread` in `app/actions/messages.ts`) on open, after every send, and on a ~20s interval while mounted — matching the product owner's explicit "async, not live" framing of support, and deliberately not a bigger realtime build-out.
                                                    - `ContactContributor.tsx` on the property page is unchanged as the entry point for *starting* a property conversation (`sendPropertyMessage`); *continuing* one (either direction) goes through `sendThreadMessage`, gated by the same "prior message exists" rule the RLS policy enforces.
                                                    - The support side of this lives at `/admin/support` (`components/admin/SupportInbox.tsx`), listed in `AdminSectionNav` and gated by the same `/admin` layout check as every other moderation page (§7) — not a new permission concept.
                                                    - Reachable from the homepage via a "Need support?" link (`components/home/NeedSupportSection.tsx`) after the broker poll, which opens the widget straight to the support thread via a `window` custom event (`OPEN_SUPPORT_CHAT_EVENT`) rather than either component holding shared state.

                                                    Still explicitly excluded and to stay excluded from `/account`: analytics, charts, activity feeds, enquiries, ownership claims. **"Admin UI" is no longer excluded** — see §7's amended admin decision — but it lives at `/admin`, a separate route tree, not inside `/account`.

                                                    ---

                                                    ## 27. Business model and monetization strategy

                                                    [Documented Product Decision — stated directly by the product owner in conversation.] RentalIntel will never charge renters, owners, or brokers for the core product — search, browsing, reviews, property submission, and community knowledge stay free permanently. This is a stated business-model commitment, not a launch promotion to be revisited, and it sharpens "trust over growth" (§2): monetizing basic access would put exactly the kind of commercial pressure on the product that §2/§3 already rule out. The broker directory (§7 migration 22) is the one place this is already true in the shipped product — fully public, no paywall — and is precedent for how the rest of this section should be read.

                                                    [Current Working Assumption — a business-strategy direction produced in a planning conversation, not yet a committed roadmap. Per this file's own rule, no part of it should be treated as decided, prioritized, or scheduled until the product owner confirms it explicitly, section by section.] The direction: RentalIntel should not try to out-compete NoBroker/MagicBricks/99acres on listing volume, paid placement, or broker lead-gen — that is a different, lower-margin business than the one this product is positioned as. Instead it extends §17's existing "renter decision platform" framing outward: the free product is the trust-and-discovery layer, and revenue (if pursued) would come from professional/documentation services layered on top of it, never from gating discovery, reviews, or basic listing. Candidate service categories, none scoped or built:

                                                    - **Document workflows** — rental agreement generation, downloadable rent receipts, lease/tenancy history records.
                                                    - **Verification services** — tenant/owner verification packages, a property history/verification report, a "fair rent" or area-risk style report (would likely build on the rent-insights aggregation already in `lib/rent-insights.ts`, not replace it).
                                                    - **Professional tools** — a landlord/property-manager dashboard (occupancy, rent collection, review management) as a subscription, distinct from the free per-property listing tools already in `/account/properties`.
                                                    - **B2B/partnerships** — relocation, moving, maintenance, legal, insurance, and financing partners referenced around the rental lifecycle, structured as referrals rather than embedded ads (consistent with §3's "never manipulate" and the community-groups pattern in §7 migration 22, which links out rather than embeds).

                                                    Illustrative pricing floated in that conversation — one-time document products roughly ₹99–₹2,000, verification/report products roughly ₹1,000–₹6,000, landlord subscriptions priced annually — is explicitly **not** a decision, just a comparison point for a future discussion.

                                                    [Open Question] Which, if any, of the candidate service categories above the product owner actually wants to pursue, in what order, and whether "never charge" is meant to extend to these professional/B2B services too or only to the renter/owner/broker core product named in the Documented Product Decision above.

                                                    ---

                                                    ## Open Questions

                                                    These require product-owner confirmation before Claude should treat any related assumption as settled:

                                                    1. ~~Is property/review approval currently happening manually (e.g. Supabase dashboard), or is there a planned admin surface not yet built?~~ **Resolved, Phase 4, then amended**: Dashboard-only was the original MVP process; `/admin` was later built and is now documented as the canonical interface, with the Dashboard as a fallback — see §7.
                                                    2. ~~Is the data loss in `ReviewForm` (quick ratings, owner traits, deposit details never submitted) an intentional stub, or a bug to fix?~~ **Resolved**: fixed — `createReview` now submits all collected fields atomically via the `create_review` RPC (migrations 5–6 in §7).
                                                    3. ~~Which visual palette is the intended brand target?~~ **Resolved**: the product owner confirmed the app should stay on the direction the code had already moved to — one unified token-based palette (`app/globals.css`'s "v3" emerald accent, `#0e8f5e`), not the originally documented blue (`#2563EB`) and not the earlier gray/blue/rounded style. See §9/§10.
                                                    4. Is the "current sprint" described in `RentalIntel_Master_Context_v1.md` (Brand migration, UI polish, Shared components) still accurate, or superseded by the Supabase/auth/verification work already shipped?
                                                    5. Should the §12 "changes requiring approval" list be adopted as-is, adjusted, or replaced?
                                                    6. Should `docs/Architecture.md`, `docs/PROJECT_STRUCTURE.md`, `docs/RentalIntel-Blueprint.md`, and `RentalIntel_Transition_v1.md` be updated to match current reality, or kept as historical record with this file as the current source of truth?
                                                    7. Which of §27's candidate paid-service categories, if any, does the product owner actually want to pursue — see §27's own Open Question for the full framing.

                                                    ---

                                                    ## Future Updates

                                                    This document should evolve alongside the project. Whenever a session makes (or the product owner states) an architectural or product decision that future sessions need to remember, Claude should **ask whether it belongs in `CLAUDE.md`** before adding it — never add silently, and never promote a Current Working Assumption to a Documented Product Decision without the product owner confirming it explicitly first.
