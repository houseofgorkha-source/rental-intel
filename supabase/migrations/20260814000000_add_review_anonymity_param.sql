-- `reviews.is_anonymous` has existed since the initial schema and is already
-- read on the property page and in /admin/reviews ("Anonymous" vs. the
-- author's display name), but nothing has ever written it — create_review
-- never accepted it, so every review has silently defaulted to false. This
-- adds the missing write path: a new trailing parameter with a default,
-- appended (not inserted) so the change is backward compatible with any
-- in-flight caller still on the old signature.
--
-- CREATE OR REPLACE cannot change a function's parameter list — appending a
-- parameter makes Postgres register a second, distinct overload alongside
-- the original 18-param one, which then makes every unqualified reference to
-- `create_review` (including the GRANT below) ambiguous. The old signature
-- must be dropped explicitly first.

drop function if exists public.create_review(
  uuid, smallint, public.recommendation, text, public.rent_again_option,
  text[], text[], boolean, numeric, boolean, boolean, boolean, boolean,
  text, integer, smallint, text[], smallint[]
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
  p_is_anonymous boolean default false
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
    is_anonymous
  )
  values (
    p_property_id, auth.uid(), 'Tenant review', p_comment, p_overall_rating,
    p_recommendation, p_would_rent_again, p_positive_owner_traits,
    p_negative_owner_traits, p_deposit_taken, p_deposit_months,
    p_deposit_more_than_two_months, p_deposit_returned,
    p_deposit_returned_on_time, p_deposit_additional_deductions,
    p_deposit_deduction_reason, p_deposit_deduction_amount,
    p_deposit_experience_rating, p_is_anonymous
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
