-- Expand review data capture so ReviewForm's Quick Ratings, Owner Behaviour,
-- Security Deposit, and "would rent again" fields have somewhere to persist.
-- Purely additive: new enum, new nullable/defaulted columns, new seed rows.
-- No drops, renames, or changes to existing columns/rows/policies.
--
-- Intentionally one-time-only, consistent with every other migration in this
-- project: the category INSERTs have no ON CONFLICT guard, CREATE TYPE has
-- no IF NOT EXISTS (Postgres doesn't support that for types), and the ADD
-- COLUMN statements aren't IF NOT EXISTS-guarded either. Re-running this file
-- against a database it has already applied to will fail loudly (duplicate
-- slug/type/column) rather than silently no-op — correct and expected under
-- Supabase's migration-history tracking, which applies each file exactly
-- once. Not a defect; do not add conditional guards to "fix" this.

-- Quick Ratings collects 10 categories; only 5 existed. Add the missing 7 so
-- all quick ratings can be saved via the existing review_category_ratings
-- table (no new table needed). "Overall Owner Rating" reuses the existing
-- 'owner_behavior' category, so it needs no new column either.
insert into public.review_categories (slug, label, sort_order)
values
  ('property_condition', 'Property Condition', 6),
  ('electricity', 'Electricity', 7),
  ('internet', 'Internet', 8),
  ('noise_level', 'Noise Level', 9),
  ('safety', 'Safety', 10),
  ('womens_safety', 'Women''s Safety', 11),
  ('value_for_money', 'Value for Money', 12);

-- "Would you rent this property again?" has no existing column or matching
-- enum. review_issue_type/recommendation are the closest existing types but
-- neither fits this 5-point scale, so a new enum is added (consistent with
-- this schema's existing style of typed enums over free text).
create type public.rent_again_option as enum (
  'definitely',
  'probably',
  'not_sure',
  'probably_not',
  'never_again'
);

-- Owner traits are a small fixed vocabulary tied 1:1 to a review, not a
-- reusable taxonomy — review_issues' enum doesn't contain trait values and
-- has no positive-trait concept at all, so it's not a fit. Plain checked
-- array columns are proportionate here (no new join table/RLS needed).
--
-- Deposit fields: reviews.security_deposit is a currency amount; the form
-- asks for deposit as "months of rent" and never collects paid_monthly_rent,
-- so there's no way to derive one from the other — dedicated columns instead
-- of overloading security_deposit.
alter table public.reviews
  add column would_rent_again public.rent_again_option,
  add column positive_owner_traits text[] not null default '{}',
  add column negative_owner_traits text[] not null default '{}',
  add column deposit_taken boolean,
  add column deposit_months numeric(3,1)
    check (deposit_months is null or deposit_months >= 0),
  add column deposit_more_than_two_months boolean,
  add column deposit_returned boolean,
  add column deposit_returned_on_time boolean,
  add column deposit_additional_deductions boolean,
  add column deposit_deduction_reason text,
  add column deposit_deduction_amount integer
    check (deposit_deduction_amount is null or deposit_deduction_amount >= 0),
  add column deposit_experience_rating smallint
    check (deposit_experience_rating is null or deposit_experience_rating between 1 and 5);

alter table public.reviews
  add constraint reviews_positive_owner_traits_check
  check (
    positive_owner_traits <@ array[
      'Friendly', 'Respectful', 'Helpful', 'Responsive', 'Honest', 'Professional'
    ]::text[]
  );

alter table public.reviews
  add constraint reviews_negative_owner_traits_check
  check (
    negative_owner_traits <@ array[
      'Rude', 'Aggressive', 'Unresponsive', 'Broke Agreement', 'Harassed Tenant'
    ]::text[]
  );

-- No RLS changes needed: RLS on `reviews`/`review_category_ratings` is
-- row-level (author_id = auth.uid(), review ownership), not column- or
-- category-scoped, so the existing insert/select policies already cover
-- these new columns and the 7 new category rows.
