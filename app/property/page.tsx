import PropertyDiscovery from "@/components/property/PropertyDiscovery";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY } from "@/lib/cities";
import {
  POSTED_BY_OPTIONS,
  isFurnishing,
  isPropertyConfiguration,
  isPropertyType,
  type Furnishing,
  type PostedBy,
  type PropertyConfiguration,
  type PropertyType,
} from "@/lib/property-attributes";

export const dynamic = "force-dynamic";

type PropertiesPageProps = {
  searchParams: Promise<{
    city?: string;
    areas?: string;
    q?: string;
    rentMin?: string;
    rentMax?: string;
    depositMin?: string;
    depositMax?: string;
    config?: string;
    ptype?: string;
    furnishing?: string;
    minArea?: string;
    listedWithin?: string;
    postedBy?: string;
    reviewsOnly?: string;
    photosOnly?: string;
  }>;
};

function parseNumberParam(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// A URL is user-editable, so every attribute value is re-validated against the
// canonical list rather than cast. An unknown value is dropped, not passed
// through — a filter chip that matches nothing is what this whole change is
// removing, and hand-typing "?config=1RK" must not reintroduce one.
function parseListParam<T extends string>(
  value: string | undefined,
  isValid: (candidate: string) => candidate is T,
): T[] | undefined {
  if (!value) return undefined;
  const parsed = value.split(",").map((item) => item.trim()).filter(isValid);
  return parsed.length > 0 ? parsed : undefined;
}

const isPostedBy = (value: string): value is PostedBy =>
  POSTED_BY_OPTIONS.some((option) => option.value === value);

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
        depositMin: parseNumberParam(params.depositMin),
        depositMax: parseNumberParam(params.depositMax),
        configurations: parseListParam<PropertyConfiguration>(
          params.config,
          isPropertyConfiguration,
        ),
        propertyTypes: parseListParam<PropertyType>(params.ptype, isPropertyType),
        furnishing: parseListParam<Furnishing>(params.furnishing, isFurnishing),
        minAreaSqft: parseNumberParam(params.minArea),
        listedWithinDays: parseNumberParam(params.listedWithin),
        postedBy: parseListParam<PostedBy>(params.postedBy, isPostedBy),
        reviewsOnly: params.reviewsOnly === "1",
        photosOnly: params.photosOnly === "1",
      }}
    />
  );
}
