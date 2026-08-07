-- Adds owner listing support to the existing `properties` entity.
--
-- Deliberately NOT done here (see CLAUDE.md §25 and the listing architecture
-- plan): no `listings` table, no `owner_id`, no property-claim flow, and no
-- change whatsoever to `review_verifications` (its `review_id` stays NOT NULL
-- and verification still requires an existing review).
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.

-- 1. Provenance: what the submitter CLAIMS their relationship to the property
-- is. This is not verified ownership and must never be presented as such --
-- it is displayed as an unverified claim, the same way an unverified review
-- is. Nullable on purpose: rows created before this migration have genuinely
-- unknown provenance, and defaulting them to 'tenant' would assert a fact we
-- do not know. NULL means "legacy/unknown", and every policy below is written
-- to be NULL-safe.
create type public.property_submitter as enum ('owner', 'tenant', 'helper');

alter table public.properties
  add column submitted_as public.property_submitter,
  add column security_deposit integer
    check (security_deposit is null or security_deposit >= 0);

-- `asking_rent`, `currency` and `is_available` already exist and are reused
-- as-is -- they were added earlier but no code ever wrote to them.

-- 2. DEFERRED -- column-scoped UPDATE is deliberately NOT in this migration.
--
-- Listing management (an owner correcting rent, or marking a property as
-- rented) needs `revoke update ... / grant update (cols) ... / create policy`
-- on public.properties. That is a privilege change whose correctness depends
-- on behaviour this project has not yet verified against a real Postgres --
-- specifically, whether the `properties_set_updated_at` BEFORE trigger still
-- fires when the caller holds only a column-level UPDATE grant.
--
-- It is split out so that everything below can be applied safely and
-- immediately: this migration is purely additive (two new columns and one
-- narrowed INSERT policy) and grants no new write access to anyone.
--
-- Until that separate migration lands, `properties` continues to have NO
-- UPDATE policy, so every update through the Data API is denied for every
-- role -- exactly as it is today. `updatePropertyListing` in
-- app/actions/property.ts will therefore return "That listing could not be
-- found in your account" until then; the account listing-edit route is not
-- reachable from normal navigation yet.

-- 3. A property's owner cannot review their own listing.
--
-- 20260807000000 widened this policy so a creator could review their own
-- still-pending property. That is correct for a tenant adding the place they
-- live, and wrong for an owner advertising a vacancy. This narrows it for
-- exactly that case and leaves every other case untouched.
--
-- `submitted_as` is self-declared, so this is a good-faith guard against
-- casual self-review, not fraud prevention -- an owner who claims 'tenant'
-- cannot be stopped by any schema. The real defences remain stay
-- verification (documents) and manual approval.
--
-- `is distinct from` is mandatory, not stylistic. Plain `= 'owner'` yields
-- NULL on legacy rows, and a WITH CHECK that evaluates to NULL FAILS --
-- which would silently block every pre-existing user from reviewing.
--   legacy (NULL):        NULL is distinct from 'owner' -> true  -> allowed
--   owner, own listing:   false or false                        -> blocked
--   tenant, owner's flat: false or true                         -> allowed
--   tenant, own pending:  true                                  -> allowed
--
-- 'helper' is intentionally NOT blocked here. "Owner" is a permanent
-- commercial conflict; "helper" is a temporary state (a helper may genuinely
-- become a tenant later), so it is gated in the UI instead of stranding them
-- at the database level.
drop policy "Authenticated users can create their own reviews" on public.reviews;

create policy "Authenticated users can create their own reviews"
on public.reviews for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.properties
    where properties.id = reviews.property_id
      and (
        properties.status = 'published'
        or properties.created_by = auth.uid()
      )
      and (
        properties.submitted_as is distinct from 'owner'
        or properties.created_by is distinct from auth.uid()
      )
  )
);
