import { notFound } from "next/navigation";
import VerifyStayForm from "@/components/review/VerifyStayForm";
import { properties } from "@/data/properties";

type VerifyStayPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function VerifyStayPage({
  params,
}: VerifyStayPageProps) {
  const { slug } = await params;
  const property = properties.find((item) => item.slug === slug);

  if (!property) {
    notFound();
  }

  return <VerifyStayForm propertyName={property.name} propertySlug={property.slug} />;
}
