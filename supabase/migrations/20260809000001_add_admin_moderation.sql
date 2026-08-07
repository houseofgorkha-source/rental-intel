-- Administrator moderation.
--
-- Until now RentalIntel had exactly three actors: anon, a signed-in
-- contributor, and a human operator working directly in the Supabase
-- Dashboard (CLAUDE.md §7). Approving a property or a stay verification was
-- possible ONLY through the Dashboard, because `properties` and
-- `review_verifications` have no UPDATE policy at all -- every update through
-- the Data API is denied for every role.
--
-- This migration adds the fourth actor the model was missing: an
-- administrator who can moderate through the product itself. It is written to
-- be the smallest change that makes that safe, and deliberately grants no
-- ability the Dashboard operator did not already have.
--
-- What is NOT done here, on purpose:
--   * No permissions framework, no roles table, no per-resource grants. There
--     is one privilege level -- "may moderate" -- because there is exactly one
--     moderation workflow.
--   * No SECURITY DEFINER anywhere. `is_admin()` below is SECURITY INVOKER; it
--     reads a table the caller is genuinely allowed to read one row of. No
--     function in this migration bypasses RLS on the caller's behalf.
--   * No admin ability to edit or delete a review. §3 ("never remove truthful
--     reviews") is a product promise, and the schema should not quietly hold
--     the power to break it. Admin review access here is read-only.
--   * No admin ability to edit a property's identity. See section 3.
--   * No self-service admin signup. Membership is granted the same way
--     approval already happens: by a project owner in the Dashboard.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.


-- ---------------------------------------------------------------------------
-- 1. Who is an administrator
-- ---------------------------------------------------------------------------
-- A separate table rather than a `profiles.is_admin` column, for one concrete
-- reason: `profiles` already has the policy "Users can update their own
-- profile" (using id = auth.uid()), and migration 20260805000003 granted
-- blanket table-level UPDATE on every public table to `authenticated`. An
-- is-admin flag living on `profiles` would therefore be writable by its own
-- subject -- any signed-in user could promote themselves with a single
-- PATCH. Closing that would mean revoking and re-granting UPDATE on
-- `profiles` column by column; keeping the flag off `profiles` avoids
-- touching that policy at all.
create table public.admin_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text
);

alter table public.admin_users enable row level security;

-- An administrator may confirm their own membership, and nothing else. This
-- is what lets is_admin() below work as SECURITY INVOKER. It deliberately
-- does not expose the roster: a non-admin sees zero rows, and an admin sees
-- only themselves, so the table cannot be used to enumerate who can moderate.
create policy "Administrators can read their own admin record"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

-- There is no INSERT, UPDATE or DELETE policy, by design: membership cannot
-- be changed through the Data API by anyone, including an administrator. It
-- is granted in the Supabase Dashboard, the same trusted-operator step that
-- already approves properties and verifications.
--
-- Note this table is created AFTER 20260805000003's `grant ... on all tables`,
-- so it inherits none of those privileges. The grants below are the complete
-- set of table privileges that exist on it. The revoke is belt-and-braces
-- against a future blanket grant.
grant select on public.admin_users to authenticated;
revoke insert, update, delete on public.admin_users from anon, authenticated;
grant select, insert, update, delete on public.admin_users to service_role;

-- SECURITY INVOKER on purpose. It runs with the caller's own privileges and
-- under the caller's own RLS, so it can only ever answer "are YOU an
-- administrator" -- it cannot be used to read anything the caller could not
-- already read by hand. `stable` so the planner can call it once per query
-- rather than once per row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;


-- ---------------------------------------------------------------------------
-- 2. Reading what needs moderating
-- ---------------------------------------------------------------------------
-- Every policy below is additive. Postgres ORs multiple permissive policies
-- together, so each one only ever widens what an administrator can read and
-- changes nothing for anon or for an ordinary contributor.
--
-- These are required, not conveniences: "Published properties are publicly
-- readable" is scoped to `status = 'published' or created_by = auth.uid()`,
-- so without this an administrator literally cannot see the pending
-- submissions they are meant to approve.
create policy "Administrators can read every property"
on public.properties for select to authenticated
using (public.is_admin());

create policy "Administrators can read every property image"
on public.property_images for select to authenticated
using (public.is_admin());

create policy "Administrators can read every review"
on public.reviews for select to authenticated
using (public.is_admin());

create policy "Administrators can read every category rating"
on public.review_category_ratings for select to authenticated
using (public.is_admin());

create policy "Administrators can read every review issue"
on public.review_issues for select to authenticated
using (public.is_admin());

create policy "Administrators can read every verification request"
on public.review_verifications for select to authenticated
using (public.is_admin());

create policy "Administrators can read every verification document"
on public.verification_documents for select to authenticated
using (public.is_admin());

-- The evidence itself. `verification-documents` is a private bucket whose
-- existing policies are scoped to the uploader's own folder
-- (review-verifications/<auth.uid()>/...), so without this an administrator
-- can read a document's metadata row but not the file it points at -- and
-- verification is precisely the workflow where the file IS the decision.
-- Scoped to this one bucket: `property-images` is public and needs nothing.
create policy "Administrators can read verification files"
on storage.objects for select to authenticated
using (
  bucket_id = 'verification-documents'
  and public.is_admin()
);


-- ---------------------------------------------------------------------------
-- 3. Moderating a property -- the `status` column and nothing else
-- ---------------------------------------------------------------------------
-- RLS cannot express column scope; only a column-level GRANT can. A
-- table-level grant supersedes any column-level grant, so the revoke has to
-- come first or the grant below is decorative.
--
-- The effect is that `name`, `address_*`, `area`, `city`, `slug`,
-- `submitted_as`, `landmark`, `created_by`, `asking_rent`, `security_deposit`
-- and `is_available` are unreachable through the Data API for EVERY role that
-- uses it, administrators included. A property's identity therefore cannot
-- drift away from the reviews permanently attached to it -- not by a
-- contributor, not by a moderator, not by a compromised session. Moderation
-- is a decision about a submission, not a licence to rewrite it.
--
-- This also means an owner still cannot correct their own rent or mark a
-- property as rented. That is a real, known product gap and is left open
-- deliberately: the requested scope has no property amendment flow, and
-- widening this grant is the one change that would quietly re-open identity
-- columns if done carelessly.
--
-- WARNING for future migrations: a blanket `grant update on all tables in
-- schema public` (as 20260805000003 does for the other verbs) would SILENTLY
-- revert this column scoping and re-expose every column above. Any future
-- grants migration must exclude public.properties from a blanket UPDATE.
revoke update on public.properties from anon, authenticated;
grant update (status) on public.properties to authenticated;

create policy "Administrators can set property moderation status"
on public.properties for update to authenticated
using (public.is_admin())
with check (public.is_admin());


-- ---------------------------------------------------------------------------
-- 4. Moderating a stay verification
-- ---------------------------------------------------------------------------
-- Same mechanism, scoped to the four columns that record a decision. The
-- request's own identity -- `review_id`, `created_by`, `submitted_at` -- stays
-- unreachable, so a decision can never be silently moved onto a different
-- review.
--
-- `reviews.verification_status` is updated by the existing
-- `review_verifications_sync_status` trigger (20260724000000), which is
-- already SECURITY DEFINER and predates this migration. That is why no admin
-- UPDATE privilege on `reviews` is needed or granted: the only writes an
-- administrator causes to a review are the ones that trigger makes, along a
-- path that has always existed.
revoke update on public.review_verifications from anon, authenticated;
grant update (status, reviewed_at, reviewed_by, rejection_reason)
  on public.review_verifications to authenticated;

create policy "Administrators can decide verification requests"
on public.review_verifications for update to authenticated
using (public.is_admin())
with check (public.is_admin());
