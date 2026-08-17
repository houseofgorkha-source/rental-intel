// A small, hand-picked list of external Facebook rental/flatmate groups —
// not scraped, not RentalIntel's own data. Just links out, the same way any
// page can link to a public URL; nothing about a group's members or posts is
// pulled in. Kept as a static list (re-check periodically) rather than a
// database table, since it's editorial curation, not user-submitted content.
export type BrokerCommunityGroup = {
  name: string;
  url: string;
};

export const BROKER_COMMUNITY_GROUPS: BrokerCommunityGroup[] = [
  {
    name: "Flat and Flatmates Bangalore (Decent Homes)",
    url: "https://www.facebook.com/groups/findmyroombangalore/",
  },
  {
    name: "Flats and Flatmates Bangalore — Indiranagar, Domlur, HAL",
    url: "https://www.facebook.com/groups/flatandflatmatesindiranagar/",
  },
  {
    name: "Flats and Flatmates Bangalore Without Brokers",
    url: "https://www.facebook.com/groups/flatsandflatmatesbangalorefacebook/",
  },
  {
    name: "Flat and Flatmates (Bangalore Chapter) without Brokerage",
    url: "https://www.facebook.com/groups/2020505841540002/",
  },
  {
    name: "Flat and Flatmates — Koramangala / HSR / BTM",
    url: "https://www.facebook.com/groups/1655874734720148/",
  },
  {
    name: "Flat & Flatmates HSR Layout Bangalore",
    url: "https://www.facebook.com/groups/1432388906839056/",
  },
];
