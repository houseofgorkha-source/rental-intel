import { notFound } from "next/navigation";
import VerifyStayForm from "@/components/review/VerifyStayForm";
import { createClient } from "@/lib/supabase/server";

type VerifyStayPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function VerifyStayPage({
  params,
}: VerifyStayPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

const { data: property, error } = await supabase
  .from("properties")
  .select("name, slug")
  .eq("slug", slug)
  .eq("status", "published")
  .single();

if (error || !property) {
  notFound();
}

  return <VerifyStayForm propertyName={property.name} propertySlug={property.slug} />;
}
