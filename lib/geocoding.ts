import type { Coordinates } from "./area-coordinates";

export type AddressParts = {
  addressLine1?: string;
  addressLine2?: string;
  area: string;
  city: string;
};

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  county?: string;
  state_district?: string;
};

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

// A result is only usable if it actually mentions the area or city we asked
// for -- "some result came back" is not the same as "the right result came
// back". A confident-looking pin in the wrong locality is worse than no pin,
// which is why the first Nominatim result is never accepted blindly. City
// alone is enough for the broader queries in the ladder below (dropping the
// area on purpose), so this checks address components AND the free-text
// display_name (Nominatim doesn't always break every field out).
function matchesLocation(result: NominatimResult, area: string, city: string): boolean {
  const haystack = [
    result.address?.city,
    result.address?.town,
    result.address?.village,
    result.address?.suburb,
    result.address?.neighbourhood,
    result.address?.quarter,
    result.address?.county,
    result.address?.state_district,
    result.display_name,
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalize)
    .join(" | ");

  const normalizedCity = normalize(city);
  const normalizedArea = normalize(area);

  return (
    (normalizedCity.length > 0 && haystack.includes(normalizedCity)) ||
    (normalizedArea.length > 0 && haystack.includes(normalizedArea))
  );
}

async function searchOnce(query: string): Promise<NominatimResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return [];

  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?format=json&addressdetails=1&limit=3&countrycodes=in&q=${encodeURIComponent(trimmed)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return [];
    return (await response.json()) as NominatimResult[];
  } catch {
    // Network failure, timeout, or a malformed response -- treated as "no
    // results at this level", so the caller moves on to the next, broader
    // query rather than failing the whole lookup over one bad request.
    return [];
  }
}

// Forward-geocodes an address via OpenStreetMap's Nominatim -- the one
// deliberate exception to this project's "location data never leaves the
// browser" rule (see area-coordinates.ts, geolocation.ts). There is no
// offline dataset here that can resolve an arbitrary street address, only
// the small known-locality dictionary, which real addresses like "19th
// Cross, Rama Temple Road" are more specific than.
//
// Tries progressively broader combinations -- full address, then without
// line 2, then area+city, then city alone -- stopping at the first candidate
// (at any level) whose own address actually names the area or city asked
// for. A combination like "19th Cross" that OSM has no record of simply
// produces no match at that level, and the ladder falls through to the next
// one rather than returning something plausible-looking but wrong.
// Returns null -- never a guess -- if nothing at any level matches; the
// caller (PropertyLocationField) already falls back to the area/city
// centroid for that case.
export async function geocodeAddress(parts: AddressParts): Promise<Coordinates | null> {
  const { addressLine1, addressLine2, area, city } = parts;
  if (!area.trim() && !city.trim()) return null;

  const candidateQueries = [
    [addressLine1, addressLine2, area, city],
    [addressLine1, area, city],
    [area, city],
    [city],
  ]
    .map((segments) =>
      segments.filter((part): part is string => Boolean(part && part.trim())).join(", "),
    )
    .filter((query, index, all) => query.length > 0 && all.indexOf(query) === index);

  for (const query of candidateQueries) {
    const results = await searchOnce(`${query}, India`);
    const match = results.find((result) => matchesLocation(result, area, city));
    if (!match) continue;

    const lat = Number(match.lat);
    const lng = Number(match.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    return { lat, lng };
  }

  return null;
}
