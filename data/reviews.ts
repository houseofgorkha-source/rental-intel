export type Review = {
  id: number;
  propertySlug: string;
  reviewer: string;
  rating: number;
  title: string;
  review: string;
  stay: string;
  verified: boolean;
};

export const reviews: Review[] = [
  // ... your existing data
];