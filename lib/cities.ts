export const DEFAULT_CITY = "Bengaluru";

// properties.city is free text and doesn't always match the app's canonical
// city name (e.g. stored as "Bangalore"/"BANGALORE", never "Bengaluru") —
// this maps each canonical city to every name variant it should match when
// filtering, so the query stays tolerant of that without rewriting any data.
export const CITY_NAME_ALIASES: Record<string, string[]> = {
  Bengaluru: ["Bengaluru", "Bangalore"],
};

export const CITIES = [
  { name: "Bengaluru", available: true },
  { name: "Hyderabad", available: false },
  { name: "Mumbai", available: false },
  { name: "Delhi", available: false },
  { name: "Gurgaon", available: false },
  { name: "Pune", available: false },
  { name: "Chennai", available: false },
] as const;

// Reverse lookup built from CITY_NAME_ALIASES + CITIES: every known alias or
// canonical name (lowercased) maps to its canonical form.
const CANONICAL_CITY_BY_ALIAS: Record<string, string> = {};
for (const city of CITIES) {
  CANONICAL_CITY_BY_ALIAS[city.name.toLowerCase()] = city.name;
}
for (const [canonical, aliases] of Object.entries(CITY_NAME_ALIASES)) {
  for (const alias of aliases) {
    CANONICAL_CITY_BY_ALIAS[alias.toLowerCase()] = canonical;
  }
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

// Normalizes a user-submitted city name for storage: known aliases resolve
// to their canonical name (e.g. "Bangalore" -> "Bengaluru"); anything else is
// title-cased and stored as-is rather than rejected, since the supported
// city list is still Bengaluru-only and stricter validation isn't needed
// until that expands. Returns null only for empty/whitespace input.
export function normalizeCityName(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const canonical = CANONICAL_CITY_BY_ALIAS[trimmed.toLowerCase()];
  return canonical ?? toTitleCase(trimmed);
}

// Every known alias/canonical name (lowercased) for a given canonical city —
// used to match a property's free-text city against the currently selected
// city, client-side, the same way the server-side discovery query does.
export function cityMatches(propertyCity: string, selectedCity: string): boolean {
  const aliases = CITY_NAME_ALIASES[selectedCity] ?? [selectedCity];
  return aliases.some((alias) => alias.toLowerCase() === propertyCity.toLowerCase());
}

export const LOCALITIES_BY_CITY: Record<string, string[]> = {
  Bengaluru: [
    "Whitefield", "Marathahalli", "Bellandur", "HSR Layout", "Koramangala",
    "Indiranagar", "JP Nagar", "Jayanagar", "BTM Layout", "Electronic City",
    "Sarjapur Road", "Hebbal", "Yelahanka", "Banashankari", "Rajajinagar",
    "Malleshwaram", "Basavanagudi", "RR Nagar", "Kengeri", "Vijayanagar",
    "CV Raman Nagar", "Mahadevapura", "Brookefield", "KR Puram", "Yeshwanthpur",
    "Hoodi", "Nagawara", "Thanisandra", "Kadubeesanahalli", "Domlur",
    "Richmond Town", "Ulsoor", "RT Nagar", "Hennur", "Kammanahalli",
    "Bannerghatta Road", "Kanakapura Road", "Peenya", "Bommanahalli", "Silk Board",
  ],
};
