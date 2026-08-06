import PropertyDiscovery from "@/components/property/PropertyDiscovery";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY } from "@/lib/cities";

export const dynamic = "force-dynamic";

type PropertiesPageProps = {
  searchParams: Promise<{
    city?: string;
    areas?: string;
    q?: string;
    rentMin?: string;
    rentMax?: string;
    reviewsOnly?: string;
    photosOnly?: string;
  }>;
};

function parseNumberParam(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const params = await searchParams;
  const properties = await getDiscoveryProperties(DEFAULT_CITY);

  return (
    <PropertyDiscovery
      properties={properties}
      initialSearch={{
        city: params.city,
        areas: params.areas ? params.areas.split(",").filter(Boolean) : undefined,
        query: params.q,
        rentMin: parseNumberParam(params.rentMin),
        rentMax: parseNumberParam(params.rentMax),
        reviewsOnly: params.reviewsOnly === "1",
        photosOnly: params.photosOnly === "1",
      }}
    />
  );
}
