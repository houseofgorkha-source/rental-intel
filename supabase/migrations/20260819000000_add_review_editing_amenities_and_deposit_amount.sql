-- Three changes bundled together because all three touch create_review's
-- signature, and each one needs the same DROP-then-recreate treatment
-- (appending a parameter via CREATE OR REPLACE registers a second overload
-- rather than replacing the function -- see 20260814000000's own comment for
-- why) -- doing them in one pass avoids three separate drop/recreate cycles.
--
-- 1. Review editing. `reviews` has had a table-level UPDATE grant since
--    20260805000003's blanket grant, but zero UPDATE policies -- so nothing
--    has ever actually been updatable (RLS still blocks with no policy
--    present). Adding a plain `using (author_id = auth.uid())` policy
--    without column-scoping the grant would let an author rewrite their own
--    `property_id` (reassign the review to a different property) or
--    `verification_status` (self-verify) directly via the Data API, since
--    the existing grant covers every column. So the blanket grant is
--    replaced with a column-scoped one first, mirroring the exact pattern
--    `properties` already uses (20260810000001) for the same reason.
--
-- 2. `reviews.amenities` -- the reviewer's own confirmation of which
--    amenities were actually present, independent of (and not overwriting)
--    `properties.amenities`. Same validated-array pattern as that column and
--    as `positive_owner_traits`/`negative_owner_traits`.
--
-- 3. `security_deposit` (a currency column that has existed on `reviews`
--    since the initial schema) finally gets a write path. The form has been
--    collecting deposit as "months of rent" (`deposit_months`) since
--    20260805000001 and displaying that number formatted as a currency
--    amount, which is a unit mismatch, not a display bug alone. Going
--    forward the form collects the actual total deposit paid and it's
--    written to `security_deposit`; `deposit_months` stays in the schema
--    (existing rows keep their data) but is no longer written by the app.

-- ---------------------------------------------------------------------------
-- 1. reviews.amenities -- created first: the column-scoped grant below names
--    it, and a GRANT UPDATE (column) requires the column to already exist.
-- ---------------------------------------------------------------------------
alter table public.reviews
  add column amenities text[] not null default '{}'
    check (
      amenities <@ array[
        'Lift', 'Power backup', 'Parking', 'Gym',
        'Swimming pool', 'Security', 'Park', 'Clubhouse'
      ]
    );

-- ---------------------------------------------------------------------------
-- 2. Column-scoped UPDATE + policy
-- ---------------------------------------------------------------------------
revoke update on public.reviews from anon, authenticated;

grant update (
  title, body, overall_rating, recommendation, would_rent_again,
  positive_owner_traits, negative_owner_traits, deposit_taken,
  deposit_more_than_two_months, deposit_returned, deposit_returned_on_time,
  deposit_additional_deductions, deposit_deduction_reason,
  deposit_deduction_amount, deposit_experience_rating, security_deposit,
  amenities, is_anonymous
) on public.reviews to authenticated;

-- Deliberately NOT granted: id, property_id, author_id, verification_status,
-- created_at, currency, stay_start_date, stay_end_date, deposit_months
-- (deprecated -- see above), paid_monthly_rent (never collected). A review's
-- identity (which property, whose review) and its verification state stay
-- unreachable through the Data API, same guarantee `properties` already
-- gives its own identity columns.
--
-- `updated_at` is likewise not granted -- the existing `reviews_set_updated_at`
-- trigger writes it, and column privileges are checked against the SET
-- clause's named columns, not what a trigger changes afterward.

create policy "Authors can update their own review"
on public.reviews for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "Authors can remove ratings from their own review"
on public.review_category_ratings for delete to authenticated
using (
  exists (
    select 1 from public.reviews
    where reviews.id = review_category_ratings.review_id
      and reviews.author_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 3. create_review: add p_security_deposit, p_amenities
-- ---------------------------------------------------------------------------
drop function if exists public.create_review(
  uuid, smallint, public.recommendation, text, public.rent_again_option,
  text[], text[], boolean, numeric, boolean, boolean, boolean, boolean,
  text, integer, smallint, text[], smallint[], boolean
);

create or replace function public.create_review(
  p_property_id uuid,
  p_overall_rating smallint,
  p_recommendation public.recommendation,
  p_comment text,
  p_would_rent_again public.rent_again_option,
  p_positive_owner_traits text[],
  p_negative_owner_traits text[],
  p_deposit_taken boolean,
  p_deposit_months numeric,
  p_deposit_more_than_two_months boolean,
  p_deposit_returned boolean,
  p_deposit_returned_on_time boolean,
  p_deposit_additional_deductions boolean,
  p_deposit_deduction_reason text,
  p_deposit_deduction_amount integer,
  p_deposit_experience_rating smallint,
  p_category_slugs text[],
  p_category_ratings smallint[],
  p_is_anonymous boolean default false,
  p_security_deposit integer default null,
  p_amenities text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_review_id uuid;
  v_invalid_rating boolean;
  v_unknown_slug text;
begin
  if coalesce(array_length(p_category_slugs, 1), 0)
     <> coalesce(array_length(p_category_ratings, 1), 0) then
    raise exception
      'p_category_slugs and p_category_ratings must have the same length';
  end if;

  select bool_or(rating < 1 or rating > 5)
  into v_invalid_rating
  from unnest(p_category_ratings) as rating;

  if v_invalid_rating then
    raise exception 'category ratings must be between 1 and 5';
  end if;

  select slug into v_unknown_slug
  from unnest(p_category_slugs) as slug
  where not exists (
    select 1 from public.review_categories rc where rc.slug = slug
  )
  limit 1;

  if v_unknown_slug is not null then
    raise exception 'unknown review category slug: %', v_unknown_slug;
  end if;

  insert into public.reviews (
    property_id, author_id, title, body, overall_rating, recommendation,
    would_rent_again, positive_owner_traits, negative_owner_traits,
    deposit_taken, deposit_months, deposit_more_than_two_months,
    deposit_returned, deposit_returned_on_time, deposit_additional_deductions,
    deposit_deduction_reason, deposit_deduction_amount, deposit_experience_rating,
    is_anonymous, security_deposit, amenities
  )
  values (
    p_property_id, auth.uid(), 'Tenant review', p_comment, p_overall_rating,
    p_recommendation, p_would_rent_again, p_positive_owner_traits,
    p_negative_owner_traits, p_deposit_taken, p_deposit_months,
    p_deposit_more_than_two_months, p_deposit_returned,
    p_deposit_returned_on_time, p_deposit_additional_deductions,
    p_deposit_deduction_reason, p_deposit_deduction_amount,
    p_deposit_experience_rating, p_is_anonymous, p_security_deposit, p_amenities
  )
  returning id into v_review_id;

  if coalesce(array_length(p_category_slugs, 1), 0) > 0 then
    insert into public.review_category_ratings (review_id, category_id, rating)
    select v_review_id, rc.id, r.rating
    from unnest(p_category_slugs, p_category_ratings) as r(slug, rating)
    join public.review_categories rc on rc.slug = r.slug;
  end if;

  return v_review_id;
end;
$$;

grant execute on function public.create_review to authenticated;

-- ---------------------------------------------------------------------------
-- 4. update_review -- the same atomic shape as create_review, for an
--    existing review. Ownership is enforced twice, deliberately: the UPDATE
--    statement is subject to the RLS policy above (SECURITY INVOKER, so it
--    runs as the caller), and `if not found` catches the case where RLS
--    silently filtered the row rather than letting the function return
--    successfully having changed nothing.
-- ---------------------------------------------------------------------------
create or replace function public.update_review(
  p_review_id uuid,
  p_overall_rating smallint,
  p_recommendation public.recommendation,
  p_comment text,
  p_would_rent_again public.rent_again_option,
  p_positive_owner_traits text[],
  p_negative_owner_traits text[],
  p_deposit_taken boolean,
  p_deposit_more_than_two_months boolean,
  p_deposit_returned boolean,
  p_deposit_returned_on_time boolean,
  p_deposit_additional_deductions boolean,
  p_deposit_deduction_reason text,
  p_deposit_deduction_amount integer,
  p_deposit_experience_rating smallint,
  p_security_deposit integer,
  p_amenities text[],
  p_category_slugs text[],
  p_category_ratings smallint[],
  p_is_anonymous boolean
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invalid_rating boolean;
  v_unknown_slug text;
begin
  if coalesce(array_length(p_category_slugs, 1), 0)
     <> coalesce(array_length(p_category_ratings, 1), 0) then
    raise exception
      'p_category_slugs and p_category_ratings must have the same length';
  end if;

  select bool_or(rating < 1 or rating > 5)
  into v_invalid_rating
  from unnest(p_category_ratings) as rating;

  if v_invalid_rating then
    raise exception 'category ratings must be between 1 and 5';
  end if;

  select slug into v_unknown_slug
  from unnest(p_category_slugs) as slug
  where not exists (
    select 1 from public.review_categories rc where rc.slug = slug
  )
  limit 1;

  if v_unknown_slug is not null then
    raise exception 'unknown review category slug: %', v_unknown_slug;
  end if;

  update public.reviews set
    body = p_comment,
    overall_rating = p_overall_rating,
    recommendation = p_recommendation,
    would_rent_again = p_would_rent_again,
    positive_owner_traits = p_positive_owner_traits,
    negative_owner_traits = p_negative_owner_traits,
    deposit_taken = p_deposit_taken,
    deposit_more_than_two_months = p_deposit_more_than_two_months,
    deposit_returned = p_deposit_returned,
    deposit_returned_on_time = p_deposit_returned_on_time,
    deposit_additional_deductions = p_deposit_additional_deductions,
    deposit_deduction_reason = p_deposit_deduction_reason,
    deposit_deduction_amount = p_deposit_deduction_amount,
    deposit_experience_rating = p_deposit_experience_rating,
    security_deposit = p_security_deposit,
    amenities = p_amenities,
    is_anonymous = p_is_anonymous
  where id = p_review_id
    and author_id = auth.uid();

  if not found then
    raise exception 'review not found, or not owned by the caller';
  end if;

  delete from public.review_category_ratings where review_id = p_review_id;

  if coalesce(array_length(p_category_slugs, 1), 0) > 0 then
    insert into public.review_category_ratings (review_id, category_id, rating)
    select p_review_id, rc.id, r.rating
    from unnest(p_category_slugs, p_category_ratings) as r(slug, rating)
    join public.review_categories rc on rc.slug = r.slug;
  end if;

  return p_review_id;
end;
$$;

grant execute on function public.update_review to authenticated;
