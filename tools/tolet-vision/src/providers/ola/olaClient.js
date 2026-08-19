// Raw Ola Maps Street View HTTP client for the tolet-vision prototype.
// Endpoints confirmed from https://maps.olakrutrim.com/docs/street-view.
// This file is Ola-specific by design — nothing outside providers/ola/
// should import it directly. Everything else talks to the provider-neutral
// interface in ../../imageryProvider.js.

const OLA_STREET_VIEW_BASE_URL = "https://api.olamaps.io";

const ENDPOINTS = {
  coverage: "/sli/v1/streetview/coverage", // params: xMax, xMin, yMax, yMin
  nearestImageId: "/sli/v1/streetview/imageId", // params: lat, lon
  metadata: "/sli/v1/streetview/metadata", // params: imageId
};

function getApiKey() {
  const key = process.env.OLA_MAPS_API_KEY;
  if (!key) {
    throw new Error(
      "[olaClient] OLA_MAPS_API_KEY is not set. Copy .env.example to .env and set it, " +
        "or export it in your shell. The key is never hard-coded and never sent to client code."
    );
  }
  return key;
}

async function request(path, { query = {} } = {}) {
  const apiKey = getApiKey();

  const url = new URL(OLA_STREET_VIEW_BASE_URL + path);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url, { method: "GET" });

  let body;
  const text = await res.text();
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: res.status, ok: res.ok, body, url: url.toString() };
}

export async function getCoverage({ xMax, xMin, yMax, yMin }) {
  return request(ENDPOINTS.coverage, { query: { xMax, xMin, yMax, yMin } });
}

export async function getNearestImageId({ lat, lon }) {
  return request(ENDPOINTS.nearestImageId, { query: { lat, lon } });
}

export async function getMetadata({ imageId }) {
  return request(ENDPOINTS.metadata, { query: { imageId } });
}

export async function fetchImageBytes(imageUrl) {
  const res = await fetch(imageUrl);
  const arrayBuffer = res.ok ? await res.arrayBuffer() : null;
  return {
    status: res.status,
    ok: res.ok,
    bytes: arrayBuffer ? Buffer.from(arrayBuffer) : null,
  };
}

// Minimal JPEG/PNG dimension reader — no image library dependency for this
// prototype step. Returns null if the format isn't recognized.
export function readImageDimensions(buffer) {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    // PNG: width/height are big-endian uint32 at fixed offsets in the IHDR chunk.
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    // JPEG: scan markers for the first SOF (start of frame) segment.
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const isSOF =
        (marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (isSOF) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      offset += 2 + segmentLength;
    }
  }
  return null;
}
