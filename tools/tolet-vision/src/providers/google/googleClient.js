// Raw Google Maps Platform Map Tiles API client — Street View Tiles
// product specifically (session -> metadata -> individual image tiles),
// NOT the Street View Static API. This file is Google-specific by
// design; everything else talks to googleProvider.js's
// resolvePanoramaAtPoint(). Endpoints confirmed via Google's own docs
// (developers.google.com/maps/documentation/tile/streetview and
// .../session_tokens) during planning — see the archived plan for the
// exact request/response shapes this was built against.
//
// Billing reality (per Google's published SKU list, confirmed during
// planning): session tokens and Street View Metadata are free/unlimited.
// Only tile requests are billable, with a 100,000/month free allowance —
// this test's ~1,400 tile requests are ~1.4% of that, i.e. $0 expected.
// estimatedUnitCostUsd is still left at 0 below rather than hard-coding a
// $/1000 figure scraped from a third-party source — see the archive
// manifest's own notes for why.
const TILES_BASE_URL = "https://tile.googleapis.com/v1";

function getApiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error(
      "[googleClient] GOOGLE_MAPS_API_KEY is not set. Add it to tools/tolet-vision/.env. " +
        "Never hard-coded, never sent to client code."
    );
  }
  return key;
}

// POST /v1/createSession — must be called once and reused (2-week TTL)
// for every subsequent metadata/tile call in a session. Free.
export async function createSession({ language = "en-US", region = "IN" } = {}) {
  const apiKey = getApiKey();
  const url = new URL(`${TILES_BASE_URL}/createSession`);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapType: "streetview", language, region }),
  });
  const body = await res.json();
  return { status: res.status, ok: res.ok, body };
}

// GET /v1/streetview/metadata — coordinates-based lookup, matching how
// resolvePanoramaAtPoint({lat, lon}) is already shaped for Ola. Free.
export async function getMetadata({ session, lat, lon, radius = 50 }) {
  const apiKey = getApiKey();
  const url = new URL(`${TILES_BASE_URL}/streetview/metadata`);
  url.searchParams.set("session", session);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lon));
  url.searchParams.set("radius", String(radius));
  const res = await fetch(url);
  const body = await res.json();
  return { status: res.status, ok: res.ok, body };
}

// GET /v1/streetview/tiles/{z}/{x}/{y} — billable (counts against the
// 100k/month free allowance, then priced per Google's published SKU).
export async function getTile({ session, panoId, zoom, x, y }) {
  const apiKey = getApiKey();
  const url = new URL(`${TILES_BASE_URL}/streetview/tiles/${zoom}/${x}/${y}`);
  url.searchParams.set("session", session);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("panoId", panoId);
  const res = await fetch(url);
  const arrayBuffer = res.ok ? await res.arrayBuffer() : null;
  return {
    status: res.status,
    ok: res.ok,
    bytes: arrayBuffer ? Buffer.from(arrayBuffer) : null,
  };
}
