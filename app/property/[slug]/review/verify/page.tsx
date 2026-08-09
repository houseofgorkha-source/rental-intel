import { notFound, redirect } from "next/navigation";
import VerifyStayForm from "@/components/review/VerifyStayForm";
import { createClient } from "@/lib/supabase/server";

type VerifyStayPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{ reviewId?: string }>;
};

export default async function VerifyStayPage({
  params,
  searchParams,
}: VerifyStayPageProps) {
  const { slug } = await params;
  const { reviewId } = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/property/${slug}/review/verify?reviewId=${reviewId ?? ""}`)}`);

const { data: property, error } = await supabase
  .from("properties")
  .select("id, name, slug, status, created_by")
  .eq("slug", slug)
  .single();

if (error || !property) {
  notFound();
}

// Same "published, or the property's own creator" rule as the review page —
// verification just additionally requires a review to already exist below.
if (property.status !== "published" && property.created_by !== user.id) {
  notFound();
}

  if (!reviewId) notFound();

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("property_id", property.id)
    .eq("author_id", user.id)
    .single();

  if (reviewError || !review) notFound();

  // The document types actually submitted, not just whether a verification
  // exists. Without this the form can only say "something was submitted",
  // which is what made all four document cards claim to be submitted when at
  // most one usually was. Readable via the existing "Users can read their own
  // verification document metadata" policy — no schema or RLS change.
  const { data: verification } = await supabase
    .from("review_verifications")
    .select("id, status, verification_documents(document_type)")
    .eq("review_id", review.id)
    .maybeSingle();

  const submittedTypes =
    verification?.verification_documents?.map((document) => document.document_type) ?? [];

  return (
    <VerifyStayForm
      propertyName={property.name}
      propertySlug={property.slug}
      reviewId={review.id}
      isSubmitted={Boolean(verification)}
      verificationStatus={verification?.status ?? null}
      submittedTypes={submittedTypes}
    />
  );
}
