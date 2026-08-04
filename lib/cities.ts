export const DEFAULT_CITY = "Bangalore";

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
