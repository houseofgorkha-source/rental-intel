import HomeDiscovery from "@/components/property/HomeDiscovery";
import ListYourPropertySection from "@/components/home/ListYourPropertySection";
import BrokerDirectorySection from "@/components/home/BrokerDirectorySection";
import BrokerInterestSurvey from "@/components/home/BrokerInterestSurvey";
import SpottedBoardsSection from "@/components/home/SpottedBoardsSection";
import SpottedBoardsPreviewLink from "@/components/home/SpottedBoardsPreviewLink";
import { getDiscoveryProperties } from "@/lib/property-discovery";
import { DEFAULT_CITY } from "@/lib/cities";
import { getBrokerInterestResults } from "@/app/actions/broker-interest";
import { getSpottedBoards } from "@/app/actions/spotted-boards";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [properties, brokerInterestResults, spottedBoards] = await Promise.all([
    getDiscoveryProperties(DEFAULT_CITY),
    getBrokerInterestResults(),
    getSpottedBoards(),
  ]);

  return (
    <HomeDiscovery properties={properties}>
      <ListYourPropertySection />
      <BrokerDirectorySection />
      <BrokerInterestSurvey initialResults={brokerInterestResults} />
      <SpottedBoardsSection boards={spottedBoards} />
      {process.env.NEXT_PUBLIC_SHOW_DEV_NAV === "true" && <SpottedBoardsPreviewLink />}
    </HomeDiscovery>
  );
}
