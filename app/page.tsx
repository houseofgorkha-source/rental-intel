import HomeDiscovery from "@/components/property/HomeDiscovery";
import ListYourPropertySection from "@/components/home/ListYourPropertySection";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY } from "@/lib/cities";

export const dynamic = "force-dynamic";

export default async function Home() {
  const properties = await getDiscoveryProperties(DEFAULT_CITY);

  return (
    <HomeDiscovery properties={properties}>
      <ListYourPropertySection />
    </HomeDiscovery>
  );
}
