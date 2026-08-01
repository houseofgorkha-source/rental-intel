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
  if (!user) redirect(`/login?next=/property/${slug}/review/verify?reviewId=${reviewId ?? ""}`);

const { data: property, error } = await supabase
  .from("properties")
  .select("id, name, slug")
  .eq("slug", slug)
  .eq("status", "published")
  .single();

if (error || !property) {
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

  const { data: verification } = await supabase
    .from("review_verifications")
    .select("id")
    .eq("review_id", review.id)
    .maybeSingle();

  return <VerifyStayForm propertyName={property.name} propertySlug={property.slug} reviewId={review.id} isSubmitted={Boolean(verification)} />;
}
