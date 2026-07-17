export type Review = {
  id: number;
  propertySlug: string;
  reviewer: string;
  rating: number;
  title: string;
  review: string;
  stay: string;
  verified: boolean;
  date: string;
  wouldRecommend: boolean;
  
};

export const reviews: Review[] = [
  {
    id: 1,
    propertySlug: "prestige-lakeside-habitat",
    reviewer: "Anonymous",
    rating: 5,
    title: "Excellent place to live",
    review: "Very well maintained society...",
    stay: "Jan 2024 - Present",
    verified: true,
    date: "05 Aug 2025",
    wouldRecommend: true,
    
  },


{
  id: 2,
  propertySlug: "prestige-lakeside-habitat",
  reviewer: "Rahul Sharma",
  rating: 4,
  title: "Great location, but visitor parking is limited",
  review:
    "The society is clean, secure, and well maintained. The clubhouse and walking tracks are excellent. The only issue I faced was limited visitor parking during weekends.",
  stay: "Aug 2023 - Jun 2025",
  verified: true,
  date: "10 Jul 2026",
  wouldRecommend: true,
},

{
  id: 3,
  propertySlug: "prestige-lakeside-habitat",
  reviewer: "Priya Nair",
  rating: 2,
  title: "Deposit refund took too long",
  review:
    "The apartment itself was good, but getting my security deposit back was frustrating. It took almost two months and several follow-ups with the owner.",
  stay: "Jan 2023 - Jan 2025",
  verified: true,
  date: "28 Jun 2026",
  wouldRecommend: false,
},

{
  id: 4,
  propertySlug: "prestige-lakeside-habitat",
  reviewer: "Arjun Mehta",
  rating: 5,
  title: "One of the best societies in Whitefield",
  review:
    "Excellent maintenance, responsive management, reliable power backup, and plenty of green space. I would happily rent here again.",
  stay: "Apr 2024 - Present",
  verified: false,
  date: "02 Jul 2026",
  wouldRecommend: true,
},

{
  id: 5,
  propertySlug: "prestige-lakeside-habitat",
  reviewer: "Neha Kapoor",
  rating: 3,
  title: "Good society but expensive",
  review:
    "Facilities are top-notch and security is excellent, but rent has increased significantly over the past year. Worth it only if it fits your budget.",
  stay: "Sep 2022 - Dec 2024",
  verified: false,
  date: "15 Jun 2026",
  wouldRecommend: true,
},
];