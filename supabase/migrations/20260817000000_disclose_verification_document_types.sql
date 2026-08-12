-- Lets a visitor see WHAT was verified, not just that something was.
--
-- Today a review's "Verified Tenant" badge is opaque: it says verification
-- happened but not against what. `verification_documents.document_type`
-- already records the answer (rental agreement, rent receipt, electricity
-- bill, other proof of stay) but the table's own RLS restricts it to the
-- request's own creator and admins (20260724000000 / 20260809000001) --
-- correctly, since `storage_path` on the same rows points into the private
-- verification-documents bucket and `verification_id` ties back to
-- `review_verifications`, neither of which should become public.
--
-- Rather than widen that table's RLS (which would expose storage_path too),
-- this adds a narrow view that only ever returns document_type, and only for
-- requests already in the 'verified' state -- the same fact the review's own
-- verification_status already discloses, just one level more specific. A
-- plain view (no `security_invoker`) runs with its owner's privileges
-- against the underlying tables, the same idiom this schema already uses for
-- narrow, controlled reads via SECURITY DEFINER functions (see
-- sync_review_verification_status in the initial schema) -- so anon and
-- authenticated can query this view without ever gaining the SELECT the
-- underlying tables still refuse them directly.
create view public.review_verified_document_types as
select
  rv.review_id,
  array_agg(distinct vd.document_type order by vd.document_type) as document_types
from public.review_verifications rv
join public.verification_documents vd on vd.verification_id = rv.id
where rv.status = 'verified'
group by rv.review_id;

grant select on public.review_verified_document_types to anon, authenticated;
