import HomeDiscovery from "@/components/property/HomeDiscovery";
import ListYourPropertySection from "@/components/home/ListYourPropertySection";
import BrokerInterestSurvey from "@/components/home/BrokerInterestSurvey";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY } from "@/lib/cities";
import { getBrokerInterestResults } from "@/app/actions/broker-interest";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [properties, brokerInterestResults] = await Promise.all([
    getDiscoveryProperties(DEFAULT_CITY),
    getBrokerInterestResults(),
  ]);

  return (
    <HomeDiscovery properties={properties}>
      <ListYourPropertySection />
      <BrokerInterestSurvey initialResults={brokerInterestResults} />
    </HomeDiscovery>
  );
}
