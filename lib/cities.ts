export const DEFAULT_CITY = "Bangalore";

// properties.city is free text and doesn't always match the app's canonical
// city name (e.g. stored as "Bengaluru"/"BENGALURU", never "Bangalore") —
// this maps each canonical city to every name variant it should match when
// filtering, so the query stays tolerant of that without rewriting any data.
export const CITY_NAME_ALIASES: Record<string, string[]> = {
  Bangalore: ["Bangalore", "Bengaluru"],
};

export const CITIES = [
  { name: "Bangalore", available: true },
  { name: "Hyderabad", available: false },
  { name: "Pune", available: false },
  { name: "Chennai", available: false },
] as const;

export const LOCALITIES_BY_CITY: Record<string, string[]> = {
  Bangalore: [
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
