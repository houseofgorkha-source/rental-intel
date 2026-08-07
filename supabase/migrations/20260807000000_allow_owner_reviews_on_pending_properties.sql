-- Lets a property's own creator write and read their review on that
-- property while it's still pending approval, so the Add Property ->
-- Property Detail flow can offer "Write a Review" immediately instead of
-- waiting for the property to be published. Public visibility of reviews on
-- unpublished properties is unchanged: everyone else still only sees
-- reviews once the property itself is published. review_verifications is
-- untouched by this migration — verification still requires an existing
-- review, unchanged.

drop policy "Authenticated users can create their own reviews" on public.reviews;

create policy "Authenticated users can create their own reviews"
on public.reviews for insert to authenticated
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.properties
    where properties.id = reviews.property_id
      and (properties.status = 'published' or properties.created_by = auth.uid())
  )
);

drop policy "Reviews for published properties are publicly readable" on public.reviews;

create policy "Reviews are readable when published or by their author"
on public.reviews for select to anon, authenticated
using (
  exists (
    select 1 from public.properties
    where properties.id = reviews.property_id
      and properties.status = 'published'
  )
  or author_id = auth.uid()
);
