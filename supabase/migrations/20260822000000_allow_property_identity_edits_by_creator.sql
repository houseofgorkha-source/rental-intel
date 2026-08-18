-- Widens what a property's own creator may amend to include the property's
-- identity fields, at the product owner's explicit request.
--
-- 20260810000001 deliberately excluded name/address_*/area/city/state/
-- postal_code/slug from the contributor UPDATE grant, reasoning that a
-- property's identity had to stay fixed forever so a review always describes
-- the same physical place it was written about. That reasoning is unchanged
-- in general -- what changes here is narrower: the property's own creator
-- (created_by = auth.uid(), nobody else) may now also correct these fields
-- on their own submission, the same way they could already correct rent,
-- deposit, and attributes. `created_by` and `submitted_as` remain
-- unreachable for everyone, including the creator -- provenance and
-- authorship still cannot be rewritten, only descriptive/location details.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.

-- Column grants accumulate -- this adds to the set 20260810000001 already
-- granted, it does not need to repeat or replace that statement. Row scope
-- is unchanged: the existing "Contributors can update their own property"
-- policy (created_by = auth.uid()) already covers any column reachable
-- through this grant, old or new.
grant update (
  name,
  address_line_1,
  address_line_2,
  area,
  city,
  state,
  postal_code,
  slug
) on public.properties to authenticated;
