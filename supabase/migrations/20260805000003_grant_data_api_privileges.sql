-- Grant the baseline table/sequence privileges the Data API roles need to
-- reach public schema objects created by this project's migrations.
--
-- Root cause: tables/sequences created by hand-written migrations are owned
-- by the `postgres` role, whose default ACL for schema `public` only grants
-- anon/authenticated/service_role TRUNCATE/REFERENCES/TRIGGER — not
-- SELECT/INSERT/UPDATE/DELETE (confirmed via pg_default_acl on a fresh local
-- instance, and matches supabase/config.toml's own note that "new entities
-- are NOT auto-exposed" by default). Postgres checks table-level privileges
-- before RLS policies are ever evaluated, so without this grant every anon/
-- authenticated request is denied at the privilege check, regardless of RLS.
--
-- This does NOT change authorization: RLS policies remain the sole access
-- boundary for which specific rows a role can see or modify. This migration
-- only unblocks the table-level check RLS sits behind, matching what the
-- existing RLS policies already assume is in place.
--
-- Safe to re-run: GRANT is idempotent (re-granting an already-granted
-- privilege is a no-op, not an error).

grant select, insert, update, delete
  on all tables in schema public
  to anon, authenticated, service_role;

grant usage
  on all sequences in schema public
  to anon, authenticated, service_role;
