-- Adds the amenities data model that 20260810000000 deliberately deferred.
--
-- That earlier migration's comment argued against "an untyped text[] nobody
-- validates" — the concern was validation, not the array type itself. This
-- keeps the array (matching the project's existing pattern for a small,
-- fixed, many-valued vocabulary — see reviews.positive_owner_traits /
-- negative_owner_traits) but makes it validated: the CHECK constraint below
-- mirrors lib/property-attributes.ts's AMENITIES list exactly, character for
-- character, the same discipline already applied to configuration/
-- property_type/furnishing. A full lookup table would be the right call if
-- amenities ever needed their own metadata (an icon, a description, per-city
-- availability); a fixed checklist of 8 values does not need one yet.
--
-- One-time-only, not idempotent -- matches this project's migration-history
-- convention.

alter table public.properties
  add column amenities text[] not null default '{}'
    check (
      amenities <@ array[
        'Lift', 'Power backup', 'Parking', 'Gym',
        'Swimming pool', 'Security', 'Park', 'Clubhouse'
      ]
    );

-- Additive: the existing column-scoped UPDATE grant from 20260810000001
-- already lists the other commercial/attribute columns for `authenticated`.
-- Column privileges accumulate per GRANT statement, so this only adds
-- `amenities` to that set — it does not need to repeat (or risk dropping) the
-- columns granted there.
grant update (amenities) on public.properties to authenticated;
