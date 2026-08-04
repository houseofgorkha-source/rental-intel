-- Add a real availability flag so listings can show a genuine "Available for rent" badge.
-- Existing rows default to available; no backfill needed.

alter table public.properties
  add column is_available boolean not null default true;
