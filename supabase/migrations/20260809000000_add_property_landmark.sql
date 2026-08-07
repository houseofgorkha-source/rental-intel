-- A landmark is a specific, identifying fact about where a property is --
-- "opposite the BDA complex", "behind Empire restaurant" -- and it is how
-- people in Indian cities actually give directions. It was previously being
-- collected through the free-text "Additional Notes" field, which mixed it in
-- with anything else the submitter felt like typing and made it impossible to
-- display, search or verify as a location fact.
--
-- Purely additive. `notes` is deliberately NOT dropped: rows created before
-- this migration hold real submitted text in it, and destroying that to tidy
-- up a column name would lose contributed knowledge. The Add Property form
-- stops collecting `notes` from now on; the property page keeps rendering it
-- when a legacy row has one.
--
-- No RLS change: `properties` has no column-level security, so a new column
-- on an already-visible row is covered by the existing row-level policies --
-- the same reasoning as 20260805000000_add_property_availability.sql.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.

alter table public.properties
  add column landmark text;
