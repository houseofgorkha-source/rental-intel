// Pure geometry: turns an Ola /coverage response's real street geometry
// into an evenly-spaced list of sample points, for the spatial-sampling
// discovery strategy (see discoveryPilotSpatial.js). No I/O, no API calls —
// deterministic given the same coverage response and step size, so a
// locality's sample points only ever need to be computed once and can be
// persisted verbatim for resume.
//
// Why this exists alongside the BFS crawler (imageryProvider.js /
// providers/ola/olaProvider.js): BFS follows each panorama's `links`
// neighbour graph from a seed, which is cheap (a linked imageId is free —
// no extra lookup) but clusters near the seed, since the queue explores
// nearby branches before wandering far. Sampling the street geometry
// directly instead spreads panorama requests across the *whole* covered
// network in a bbox, proportional to street length, at the cost of one
// nearestImageId lookup per sample point (no free `links` shortcut here).

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// Great-circle distance between two {lat, lon} points, in meters.
export function haversineMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

// Walks one way's coordinate list (as returned by Ola: [[lon, lat], ...])
// and returns points spaced `stepMeters` apart along its actual path
// (linearly interpolated between vertices, not just the vertices
// themselves — a way's own vertices can be far denser or sparser than the
// sampling step). Always includes the way's start point.
export function sampleWayCoordinates(coordinates, stepMeters) {
  const pts = coordinates.map(([lon, lat]) => ({ lat, lon }));
  if (pts.length === 0) return [];
  if (pts.length === 1) return [pts[0]];

  const samples = [pts[0]];
  let traveled = 0;
  let nextTarget = stepMeters;

  for (let i = 0; i < pts.length - 1; i++) {
    const segStart = pts[i];
    const segEnd = pts[i + 1];
    const segLen = haversineMeters(segStart, segEnd);
    if (segLen === 0) continue;

    while (traveled + segLen >= nextTarget) {
      const t = (nextTarget - traveled) / segLen;
      samples.push(interpolate(segStart, segEnd, t));
      nextTarget += stepMeters;
    }
    traveled += segLen;
  }

  return samples;
}

// Flattens every way in a /coverage response into one capped list of
// sample points, tagged with the way they came from (useful for
// debugging/inspection, not used for dedup — dedup happens downstream on
// the *resolved* imageId, since two sample points can legitimately share
// the nearest real panorama).
export function sampleCoverage(coverageBody, { stepMeters, maxPoints }) {
  const ways = coverageBody?.payload?.ways ?? [];
  const allSamples = [];

  for (const way of ways) {
    const coordinates = way.line_geometry?.geometry?.coordinates ?? [];
    const wayId = way.way_id;
    for (const point of sampleWayCoordinates(coordinates, stepMeters)) {
      allSamples.push({ ...point, wayId });
      if (allSamples.length >= maxPoints) return allSamples;
    }
  }

  return allSamples;
}
