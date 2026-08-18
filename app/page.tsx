import HomeDiscovery from "@/components/property/HomeDiscovery";
import ListYourPropertySection from "@/components/home/ListYourPropertySection";
import BrokerDirectorySection from "@/components/home/BrokerDirectorySection";
import BrokerInterestSurvey from "@/components/home/BrokerInterestSurvey";
import NeedSupportSection from "@/components/home/NeedSupportSection";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY } from "@/lib/cities";
import { getBrokerInterestResults } from "@/app/actions/broker-interest";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const [properties, brokerInterestResults, { data: { user } }] = await Promise.all([
    getDiscoveryProperties(DEFAULT_CITY),
    getBrokerInterestResults(),
    supabase.auth.getUser(),
  ]);

  return (
    <HomeDiscovery properties={properties}>
      <ListYourPropertySection />
      <BrokerDirectorySection />
      <BrokerInterestSurvey initialResults={brokerInterestResults} />
      <NeedSupportSection isSignedIn={Boolean(user)} />
    </HomeDiscovery>
  );
}
