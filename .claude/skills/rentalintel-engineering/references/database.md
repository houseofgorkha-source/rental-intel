# Database

Full detail: CLAUDE.md §7. This is the quick-lookup version, updated for migrations landed since CLAUDE.md was last written (through `20260810000001`).

## Core tables

`profiles`, `properties` (`status`: pending/published/rejected; `is_available`; `submitted_as`: owner/tenant/helper, nullable; `security_deposit`, `configuration`, `property_type`, `furnishing`, `carpet_area_sqft`, `landmark`, `contact_method`), `property_images`, `property_contacts` (phone/email, kept off `properties` deliberately since that table is publicly readable), `property_messages` (flat: sender/recipient/body, no threading/read-state), `reviews`, `review_categories`, `review_category_ratings`, `review_issues`, `wishlists`, `review_verifications`, `verification_documents`, `admin_users` (membership only, no permission levels).

## Migration log (chronological, hand-written, never edit an old one)

1. `20260724000000_initial_schema.sql` — base schema, enums, triggers, RLS, storage buckets.
2. `20260801000000` / `20260801000001` — creator upload/cleanup permissions for pending properties.
3. `20260805000000` — `properties.is_available`.
4. `20260805000001` / `002` / `003` — review field expansion, `create_review` RPC, blanket Data API grants (later partially superseded, see below).
5. `20260807000000` — creator can review/read their own pending property.
6. `20260808000000` — `submitted_as`, `security_deposit`; **first column-scoped UPDATE grant** replacing the blanket one on `properties`; narrows review INSERT so an owner can't review their own listing.
7. `20260809000000` — `properties.landmark`.
8. `20260809000001` — `admin_users` table + `is_admin()`; column-scoped `UPDATE (status)` on `properties` and `UPDATE (status, reviewed_at, reviewed_by, rejection_reason)` on `review_verifications`, both gated by an `is_admin()` RLS policy — see `product-boundaries.md`, this is the migration behind the in-app admin surface.
9. `20260810000000` — property attribute enums (`property_configuration`, `property_type`, `property_furnishing`), `property_contacts`, `property_messages`.
10. `20260810000001` — column-scoped UPDATE grant widened so a contributor can edit their own commercial fields (rent, deposit, availability, attributes, contact method); adds a `BEFORE UPDATE` trigger (`enforce_property_status_moderation`) blocking `status` changes from non-admins.

## The column-scoped grant pattern (repeats across migrations 6, 8, 10)

RLS policies are **row-level only** — they cannot restrict which columns a matched row's UPDATE may touch, and multiple permissive policies **OR together**, so any policy granting a creator UPDATE access at all would, combined with a blanket grant, let them touch every granted column including `status`. The fix used consistently:

```sql
revoke update on public.<table> from anon, authenticated;   -- table grant supersedes column grant, so this must come first
grant update (col_a, col_b, ...) on public.<table> to authenticated;  -- only these columns are reachable at all
create policy "..." on public.<table> for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());  -- only these rows
```

`properties`' identity columns (`name`, `address_*`, `area`, `city`, `slug`, `created_by`, `submitted_as`) and moderation column (`status`, guarded separately by the trigger) are **never** in the granted column list for `authenticated`. **Any new migration touching `properties` or `review_verifications` UPDATE grants must preserve this — never `grant update on all tables in schema public`, which would silently revert it** (this exact warning is repeated in the migration files themselves).

## Status-change guard trigger

`enforce_property_status_moderation()` (in `20260810000001`) raises if `new.status is distinct from old.status and current_user = 'authenticated' and not is_admin()`. The `current_user = 'authenticated'` clause is load-bearing: `is_admin()` reads `auth.uid()`, which is `NULL` outside a JWT, so an unscoped check would also block the `postgres`/`service_role` roles the Supabase Dashboard uses for manual moderation. If you ever touch this trigger, preserve that exemption or the Dashboard approval workflow breaks silently.

## Enum canonicalization

Every enum with a TypeScript-facing vocabulary (`property_configuration`, `property_type`, `property_furnishing`, `property_contact_method`, and the `submitted_as` role values) has a matching `lib/` constant list (`property-attributes.ts`, `property-roles.ts`) whose string literals match the Postgres labels **character-for-character**, including spacing (`"1 RK"`, not `"1RK"`). When adding a new enum value, update both the migration and the matching `lib/` file in the same change — this is the mechanism that keeps forms, filters, and the database from drifting apart.
