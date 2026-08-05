-- Make review creation atomic: the reviews row and its review_category_ratings
-- rows must succeed or fail together. A Postgres function called via RPC runs
-- its whole body in one implicit transaction — any raised exception rolls
-- back everything the function did, including earlier inserts in the same
-- call. This replaces the app-level two-insert sequence in
-- app/actions/review.ts, and deliberately avoids needing a DELETE policy on
-- `reviews` for rollback (there is none, and none is added here): on failure
-- nothing was ever durably committed in the first place.
--
-- SECURITY INVOKER (not DEFINER): the function runs with the calling user's
-- own permissions, so the existing RLS policies on `reviews` and
-- `review_category_ratings` (author_id = auth.uid(), property must be
-- published, review must belong to the caller) apply exactly as they do
-- today. No new grants or policy changes are required.
--
-- Unlike the previous migration, this one IS safe to re-run: CREATE OR
-- REPLACE FUNCTION cleanly replaces the prior definition, and re-granting an
-- already-granted EXECUTE privilege is a no-op rather than an error.

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
  p_category_ratings smallint[]
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
    deposit_deduction_reason, deposit_deduction_amount, deposit_experience_rating
  )
  values (
    p_property_id, auth.uid(), 'Tenant review', p_comment, p_overall_rating,
    p_recommendation, p_would_rent_again, p_positive_owner_traits,
    p_negative_owner_traits, p_deposit_taken, p_deposit_months,
    p_deposit_more_than_two_months, p_deposit_returned,
    p_deposit_returned_on_time, p_deposit_additional_deductions,
    p_deposit_deduction_reason, p_deposit_deduction_amount,
    p_deposit_experience_rating
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
