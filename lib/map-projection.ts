// Standard Web Mercator pixel projection, used to place a click target over
// a fixed-center/fixed-zoom static map image at a real lat/lng — the same
// formula (and the same 256px-tile assumption, empirically confirmed
// against Ola's own rendered marker pins) used for the earlier To-Let
// board preview artifact in this project's history.
export type Coordinates = { lat: number; lng: number };

export type StaticMapConfig = {
  centerLat: number;
  centerLon: number;
  zoom: number;
  width: number;
  height: number;
};

function projectToWorldPixel(lat: number, lon: number, zoom: number): Coordinates {
  const worldSize = 256 * 2 ** zoom;
  const x = worldSize * (0.5 + lon / 360);
  const sinY = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const y = worldSize * (0.5 - Math.log((1 + sinY) / (1 - sinY)) / (4 * Math.PI));
  return { lat: y, lng: x }; // reusing the Coordinates shape for {x,y} pixel space
}

// Returns the point's position on the static image as a 0-100 percentage
// of width/height, so callers can position an absolutely-positioned
// overlay with plain CSS `left`/`top` percentages regardless of how the
// image itself is scaled responsively.
export function projectToImagePercent(point: { lat: number; lon: number }, map: StaticMapConfig): { leftPct: number; topPct: number } {
  const center = projectToWorldPixel(map.centerLat, map.centerLon, map.zoom);
  const target = projectToWorldPixel(point.lat, point.lon, map.zoom);
  const px = map.width / 2 + (target.lng - center.lng);
  const py = map.height / 2 + (target.lat - center.lat);
  return { leftPct: (px / map.width) * 100, topPct: (py / map.height) * 100 };
}
