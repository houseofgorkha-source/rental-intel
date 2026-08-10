-- Exact per-property map coordinates, distinct from the area-centroid
-- approximation the map has used until now (see lib/area-coordinates.ts).
--
-- Nullable, deliberately: most properties will never have this filled in,
-- and a null here means exactly what it already means everywhere else in
-- this schema -- "not provided" -- not "at 0,0". The discovery query falls
-- back to the area centroid whenever either value is missing (see
-- lib/property-discovery.ts); nothing here invents a coordinate for a
-- property nobody has pinned.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.

alter table public.properties
  add column latitude numeric(9, 6)
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add column longitude numeric(9, 6)
    check (longitude is null or (longitude >= -180 and longitude <= 180));

-- ---------------------------------------------------------------------------
-- Editable by the same people who can already edit landmark/attributes
-- ---------------------------------------------------------------------------
-- A pin refines WHERE a property already known to exist is shown -- it does
-- not change WHICH property a review is attached to (that's still name,
-- address_*, area, city, slug -- untouched, still unreachable through the
-- Data API per 20260810000001). So this belongs in the same column-scoped
-- UPDATE grant as landmark, not treated as identity.
--
-- The revoke/re-grant pattern is required again here for the same reason it
-- was required in 20260810000001: a table-level grant supersedes a
-- column-level one, so skipping the revoke would make this grant decorative.
-- WARNING for future migrations, repeated from 20260810000001: a blanket
-- `grant update on all tables in schema public` would silently revert this
-- column scoping and re-expose identity columns. Any new grants migration
-- must exclude public.properties from a blanket UPDATE.
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
  contact_method,
  latitude,
  longitude
) on public.properties to authenticated;
