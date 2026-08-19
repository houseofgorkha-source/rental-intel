// Ola implementation of the provider-neutral imagery interface (see
// ../../imageryProvider.js for the shared contract). Discovers panoramas by
// walking the `links` neighbour-graph returned in each metadata response,
// starting from one seeded coordinate. Uses at most 1 imageId lookup +
// (metadata + image) per discovered panorama.
//
// Ola's `imageId` is exposed here only as `sourceId` — a provider-scoped
// observation identifier, never as a property/candidate identity. See
// imageryProvider.js for why that distinction matters.
import { getNearestImageId, getMetadata, fetchImageBytes } from "./olaClient.js";

export const PROVIDER_NAME = "ola";

export async function crawlPanoramas({ seedLat, seedLon, targetCount }) {
  const stats = { requestsMade: 0 };
  const visited = new Set();
  const panoramas = [];

  const seed = await getNearestImageId({ lat: seedLat, lon: seedLon });
  stats.requestsMade++;
  const seedImageId = seed.body?.payload;
  if (!seed.ok || !seedImageId) {
    throw new Error(`[olaProvider] seed lookup failed: HTTP ${seed.status} ${JSON.stringify(seed.body)}`);
  }

  const queue = [seedImageId];

  while (queue.length > 0 && panoramas.length < targetCount) {
    const imageId = queue.shift();
    if (visited.has(imageId)) continue;
    visited.add(imageId);

    const meta = await getMetadata({ imageId });
    stats.requestsMade++;
    if (!meta.ok || !meta.body?.payload) {
      console.warn(`[olaProvider] metadata failed for ${imageId}: HTTP ${meta.status}`);
      continue;
    }
    const payload = meta.body.payload;

    const download = await fetchImageBytes(payload.imageUrl);
    stats.requestsMade++;
    if (!download.ok || !download.bytes) {
      console.warn(`[olaProvider] image download failed for ${imageId}: HTTP ${download.status}`);
      continue;
    }

    const observedAt = new Date().toISOString();
    panoramas.push({
      provider: PROVIDER_NAME,
      sourceId: imageId,
      latitude: payload.lat,
      longitude: payload.lon,
      bearing: payload.bearing,
      captureDate: null, // not exposed by this provider's metadata
      observedAt,
      imageBytes: download.bytes,
    });
    console.log(
      `[olaProvider] (${panoramas.length}/${targetCount}) panorama ${imageId} @ ${payload.lat}, ${payload.lon}`
    );

    for (const link of payload.links ?? []) {
      if (!visited.has(link)) queue.push(link);
    }
  }

  return { panoramas, stats };
}
