export const quickRatingCategories = [
  { id: "property-condition", label: "Property Condition" },
  { id: "maintenance", label: "Maintenance" },
  { id: "cleanliness", label: "Cleanliness" },
  { id: "water-supply", label: "Water Supply" },
  { id: "electricity", label: "Electricity" },
  { id: "internet", label: "Internet" },
  { id: "noise-level", label: "Noise Level" },
  { id: "safety", label: "Safety" },
  { id: "womens-safety", label: "Women's Safety" },
  { id: "value-for-money", label: "Value for Money" },
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

export const depositAmountOptions = [
  "1 Month",
  "2 Months",
  "3 Months",
  "4 Months",
  "Custom",
] as const;