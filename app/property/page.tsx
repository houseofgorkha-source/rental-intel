import PropertyDiscovery from "@/components/property/PropertyDiscovery";
import { getDiscoveryProperties } from "@/lib/property-discovery";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  const properties = await getDiscoveryProperties();

  return <PropertyDiscovery properties={properties} />;
}
