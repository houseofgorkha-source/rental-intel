// ids match `review_categories.slug` in the database exactly, so ratings can
// be inserted directly against the category they belong to.
export const quickRatingCategories = [
  { id: "property_condition", label: "Property Condition" },
  { id: "maintenance", label: "Maintenance" },
  { id: "cleanliness", label: "Cleanliness" },
  { id: "water_supply", label: "Water Supply" },
  { id: "electricity", label: "Electricity" },
  { id: "internet", label: "Internet" },
  { id: "noise_level", label: "Noise Level" },
  { id: "safety", label: "Safety" },
  { id: "womens_safety", label: "Women's Safety" },
  { id: "value_for_money", label: "Value for Money" },
] as const;

export const positiveOwnerTraits = [
  "Friendly",
  "Respectful",
  "Helpful",
  "Responsive",
  "Honest",
  "Professional",
] as const;

export const negativeOwnerTraits = [
  "Rude",
  "Aggressive",
  "Unresponsive",
  "Broke Agreement",
  "Harassed Tenant",
] as const;

export const rentAgainOptions = [
  "Definitely",
  "Probably",
  "Not Sure",
  "Probably Not",
  "Never Again",
] as const;

export type RentAgainOption = (typeof rentAgainOptions)[number];