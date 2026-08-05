export type Coordinates = { lat: number; lng: number };

// Approximate center point per city — used as the map's default view when no
// area is selected, and as the fallback for cities with no per-area data yet.
const CITY_COORDINATES: Record<string, Coordinates> = {
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Delhi: { lat: 28.7041, lng: 77.1025 },
  Gurgaon: { lat: 28.4595, lng: 77.0266 },
  Noida: { lat: 28.5355, lng: 77.391 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
};

// Approximate area centroids, not exact addresses — properties are plotted
// at their locality's rough center, not their precise building location.
// Populated for Bengaluru only, the one city with published properties
// today; matches lib/cities.ts's LOCALITIES_BY_CITY.Bengaluru list.
// See area-coordinates decision in Phase (Map integration) for why: there
// are no latitude/longitude columns in the database, and no geocoding
// pipeline to populate them, so this is a deliberate, disclosed
// approximation rather than real per-property geocoding.
const AREA_COORDINATES: Record<string, Coordinates> = {
  Whitefield: { lat: 12.9698, lng: 77.7499 },
  Marathahalli: { lat: 12.9569, lng: 77.7011 },
  Bellandur: { lat: 12.9257, lng: 77.6753 },
  "HSR Layout": { lat: 12.9121, lng: 77.6446 },
  Koramangala: { lat: 12.9352, lng: 77.6245 },
  Indiranagar: { lat: 12.9719, lng: 77.6412 },
  "JP Nagar": { lat: 12.9077, lng: 77.5851 },
  Jayanagar: { lat: 12.9308, lng: 77.5838 },
  "BTM Layout": { lat: 12.9166, lng: 77.6101 },
  "Electronic City": { lat: 12.8452, lng: 77.6602 },
  "Sarjapur Road": { lat: 12.9008, lng: 77.6864 },
  Hebbal: { lat: 13.0358, lng: 77.5971 },
  Yelahanka: { lat: 13.1005, lng: 77.5963 },
  Banashankari: { lat: 12.9255, lng: 77.5468 },
  Rajajinagar: { lat: 12.9915, lng: 77.5527 },
  Malleshwaram: { lat: 13.0035, lng: 77.5709 },
  Basavanagudi: { lat: 12.9422, lng: 77.5731 },
  "RR Nagar": { lat: 12.9236, lng: 77.5185 },
  Kengeri: { lat: 12.9081, lng: 77.4855 },
  Vijayanagar: { lat: 12.9719, lng: 77.5326 },
  "CV Raman Nagar": { lat: 12.9829, lng: 77.6648 },
  Mahadevapura: { lat: 12.9906, lng: 77.6968 },
  Brookefield: { lat: 12.9679, lng: 77.7154 },
  "KR Puram": { lat: 13.0033, lng: 77.6958 },
  Yeshwanthpur: { lat: 13.0284, lng: 77.5511 },
  Hoodi: { lat: 12.9908, lng: 77.7157 },
  Nagawara: { lat: 13.0432, lng: 77.6221 },
  Thanisandra: { lat: 13.0602, lng: 77.6248 },
  Kadubeesanahalli: { lat: 12.9345, lng: 77.6976 },
  Domlur: { lat: 12.9611, lng: 77.6387 },
  "Richmond Town": { lat: 12.9634, lng: 77.6076 },
  Ulsoor: { lat: 12.9814, lng: 77.6224 },
  "RT Nagar": { lat: 13.0189, lng: 77.5945 },
  Hennur: { lat: 13.0357, lng: 77.6402 },
  Kammanahalli: { lat: 13.0166, lng: 77.6367 },
  "Bannerghatta Road": { lat: 12.8933, lng: 77.5972 },
  "Kanakapura Road": { lat: 12.8845, lng: 77.5451 },
  Peenya: { lat: 13.0286, lng: 77.5203 },
  Bommanahalli: { lat: 12.9077, lng: 77.6229 },
  "Silk Board": { lat: 12.9172, lng: 77.6228 },
};

export function getAreaCoordinates(area: string): Coordinates | null {
  return AREA_COORDINATES[area] ?? null;
}

export function getCityCoordinates(city: string): Coordinates {
  return CITY_COORDINATES[city] ?? CITY_COORDINATES.Bengaluru;
}
