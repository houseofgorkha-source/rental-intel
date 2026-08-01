create policy "Property creators can delete failed image uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'property-images'
  and (storage.foldername(name))[1] = 'properties'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Property creators can remove their pending properties"
on public.properties for delete to authenticated
using (created_by = auth.uid() and status = 'pending');

create policy "Review authors can remove incomplete verification requests"
on public.review_verifications for delete to authenticated
using (created_by = auth.uid() and status = 'pending');
