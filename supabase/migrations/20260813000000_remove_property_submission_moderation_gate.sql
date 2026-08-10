-- Product decision: adding a property no longer requires manual approval
-- before it goes live. A submission publishes immediately and is visible on
-- the homepage/search right away -- the pre-publish moderation gate
-- described in earlier migrations' comments (and CLAUDE.md §7) is removed
-- for PROPERTY submission specifically.
--
-- Deliberately narrow: this does not touch review verification or the
-- review_verifications/moderateVerification path at all, and it does not
-- remove admin capability -- migration 20260809000001's column-scoped
-- UPDATE (status) grant and enforce_property_status_moderation trigger
-- (20260810000001) are untouched, so an administrator can still change a
-- property's status after the fact (e.g. to reject a bad listing) exactly
-- as before. What changes is only the STARTING status a new submission is
-- allowed to have.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.

drop policy "Authenticated users can submit properties" on public.properties;

create policy "Authenticated users can submit properties"
on public.properties for insert to authenticated
with check (
  created_by = auth.uid()
  and status in ('pending', 'published')
);
