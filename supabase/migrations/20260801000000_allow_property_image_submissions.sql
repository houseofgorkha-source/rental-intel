-- Allow authenticated users to manage image records and uploads for properties they created.

create policy "Property creators can add their own image records"
on public.property_images for insert to authenticated
with check (
  exists (
    select 1 from public.properties
    where properties.id = property_images.property_id
      and properties.created_by = auth.uid()
  )
);

drop policy "Published property images are publicly readable" on public.property_images;

create policy "Published and owned property images are readable"
on public.property_images for select to anon, authenticated
using (
  exists (
    select 1 from public.properties
    where properties.id = property_images.property_id
      and (
        properties.status = 'published'
        or properties.created_by = auth.uid()
      )
  )
);

create policy "Property creators can upload their own images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = 'properties'
  and (storage.foldername(name))[2] = auth.uid()::text
);
