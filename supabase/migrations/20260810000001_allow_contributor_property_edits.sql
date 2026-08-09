-- Let a contributor amend their own property.
--
-- Until now `properties` had no UPDATE policy for anyone except an
-- administrator setting `status`, so the only correction mechanism was
-- deleting a still-pending submission and adding it again. Once a property
-- was published its rent, availability and attributes were frozen forever,
-- which made registering a property for rent a one-shot action nobody could
-- maintain.
--
-- What does NOT change: a property's identity. `slug`, `name`, `address_*`,
-- `area`, `city`, `state`, `postal_code`, `created_by` and `submitted_as`
-- remain unreachable through the Data API for every role, so the record a
-- review is permanently attached to still cannot drift away from it. Amending
-- a property means correcting what is being offered, never rewriting what the
-- property is.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.


-- ---------------------------------------------------------------------------
-- 1. The problem this migration has to solve first
-- ---------------------------------------------------------------------------
-- 20260809000001 granted `update (status)` to `authenticated` and restricted
-- it with an is_admin() policy. That worked because `status` was the ONLY
-- updatable column, so the policy was the only gate that mattered.
--
-- Adding a second, creator-scoped UPDATE policy breaks that arrangement in a
-- way worth stating plainly, because it is not obvious:
--
--   * RLS policies cannot express column scope -- a policy is row-level only.
--   * Multiple permissive policies are OR'd, and a row that passes ANY of them
--     may be updated in ALL granted columns.
--
-- So the moment a creator can update their own row at all, the existing
-- `update (status)` grant would let them set their own property to
-- 'published'. That is a privilege escalation straight past manual approval --
-- the single gate the whole trust model rests on.
--
-- Column grants cannot separate the two cases either, because grants are per
-- role, and the creator and the administrator are the same role
-- (`authenticated`).
--
-- The guard therefore has to compare the old and new values of one column,
-- which is precisely what a policy cannot do (a USING clause sees the old row,
-- a WITH CHECK the new one, and neither sees both). A BEFORE UPDATE trigger
-- can, so that is what enforces it below. It is an integrity constraint, not
-- an authorization shortcut: it is SECURITY INVOKER (the default), so
-- is_admin() is evaluated as the caller under the caller's own RLS and cannot
-- be used to grant anyone anything.


-- ---------------------------------------------------------------------------
-- 2. Which columns are updatable at all
-- ---------------------------------------------------------------------------
-- The revoke has to come first: a table-level grant supersedes a column-level
-- one, so without it the grant below would be decorative.
--
-- `status` stays granted because moderation still needs it -- section 3
-- restricts who may actually change it. The rest are the commercial and
-- descriptive facts a contributor is expected to keep current.
revoke update on public.properties from anon, authenticated;

grant update (
  status,
  asking_rent,
  security_deposit,
  currency,
  is_available,
  configuration,
  property_type,
  furnishing,
  carpet_area_sqft,
  landmark,
  contact_method
) on public.properties to authenticated;

-- `updated_at` is deliberately NOT granted. The existing
-- `properties_set_updated_at` BEFORE trigger writes it, and column privileges
-- are checked against the columns named in the statement's SET clause, not
-- against what a trigger subsequently changes -- so the trigger keeps working
-- and no caller can backdate a row by naming the column itself.


-- ---------------------------------------------------------------------------
-- 3. Only an administrator may change the moderation status
-- ---------------------------------------------------------------------------
-- Not SECURITY DEFINER. It runs as the caller, so public.is_admin() answers
-- "is the person making this update an administrator", evaluated under that
-- caller's own RLS -- the same answer they could get by querying admin_users
-- by hand.
--
-- Scoped to `authenticated` deliberately, and this is load-bearing rather than
-- a loosening. `is_admin()` reads auth.uid(), which is NULL whenever there is
-- no JWT -- so an unscoped check would return false for the `postgres` role
-- and lock the trusted operator out of the Supabase Dashboard, which is still
-- how a property is approved (CLAUDE.md §7). Exempting `postgres` and
-- `service_role` grants them nothing new: the first owns this table and can
-- drop this trigger outright, and the second is the secret server key. The
-- only role this needs to constrain is the one a browser session actually
-- arrives as, and `anon` cannot reach here at all because section 2 revoked
-- its UPDATE privilege entirely.
create or replace function public.enforce_property_status_moderation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and current_user = 'authenticated'
     and not public.is_admin() then
    raise exception 'Only administrators can change a property''s moderation status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- BEFORE, so the exception aborts the statement rather than letting a row be
-- written and then reverted.
create trigger properties_guard_moderation_status
before update on public.properties
for each row execute function public.enforce_property_status_moderation();


-- ---------------------------------------------------------------------------
-- 4. Row scope: your own property, and nothing else
-- ---------------------------------------------------------------------------
-- Permissive and additive: this only ever widens what a creator can do to
-- their OWN rows. The administrator policy from 20260809000001 is untouched,
-- and anon still matches no UPDATE policy at all.
--
-- `created_by` appears in both USING and WITH CHECK. USING alone would let a
-- creator hand their property to somebody else; since `created_by` is not in
-- the column grant above that is already impossible, but the pair is what
-- makes the rule true independently of the grant, rather than only as long as
-- nobody widens it.
create policy "Contributors can update their own property"
on public.properties for update to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());


-- ---------------------------------------------------------------------------
-- WARNING for future migrations
-- ---------------------------------------------------------------------------
-- A blanket `grant update on all tables in schema public` (as 20260805000003
-- does for the other verbs) would SILENTLY revert the column scoping in
-- section 2 and re-expose slug, name, address and submitted_as to every
-- signed-in user for their own rows. Any future grants migration must exclude
-- public.properties from a blanket UPDATE.
--
-- Likewise, dropping `properties_guard_moderation_status` would immediately
-- let any contributor publish their own property. It is not a convenience.
