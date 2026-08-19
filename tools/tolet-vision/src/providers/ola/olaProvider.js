// Ola implementation of the provider-neutral imagery interface (see
// ../../imageryProvider.js for the shared contract). Discovers panoramas by
// walking the `links` neighbour-graph returned in each metadata response,
// starting from one seeded coordinate.
//
// Ola's `imageId` is exposed here only as `sourceId` — a provider-scoped
// observation identifier, never as a property/candidate identity. See
// imageryProvider.js for why that distinction matters.
import { getNearestImageId, getMetadata, fetchImageBytes } from "./olaClient.js";
import { QuotaExceededError, getQuotaStatus } from "../../apiQuota.js";

export const PROVIDER_NAME = "ola";

function insideBbox(lat, lon, bbox) {
  if (!bbox) return true;
  return lat >= bbox.yMin && lat <= bbox.yMax && lon >= bbox.xMin && lon <= bbox.xMax;
}

// `bbox` (optional): { xMin, xMax, yMin, yMax } — when set, keeps the crawl
// inside a bounded area rather than following links wherever they lead.
// A node outside the bbox still costs its metadata request (coordinates
// aren't known until fetched), but its image isn't downloaded and its own
// links aren't followed, so the crawl doesn't wander out of the target
// area. Stops early (before exhausting targetCount) if the shared API
// quota (see apiQuota.js) runs out — this is the actual enforcement point
// for "no more than N requests," not just a best-effort budget.
export async function crawlPanoramas({ seedLat, seedLon, targetCount, bbox = null }) {
  const stats = { requestsMade: 0, skippedOutsideBbox: 0 };
  const visited = new Set();
  const panoramas = [];
  let stoppedReason = "target_reached";

  let seed;
  try {
    seed = await getNearestImageId({ lat: seedLat, lon: seedLon });
    stats.requestsMade++;
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return { panoramas, stats, stoppedReason: "quota_exceeded" };
    }
    throw err;
  }
  const seedImageId = seed.body?.payload;
  if (!seed.ok || !seedImageId) {
    throw new Error(`[olaProvider] seed lookup failed: HTTP ${seed.status} ${JSON.stringify(seed.body)}`);
  }

  const queue = [seedImageId];

  while (queue.length > 0 && panoramas.length < targetCount) {
    const imageId = queue.shift();
    if (visited.has(imageId)) continue;
    visited.add(imageId);

    let meta;
    try {
      meta = await getMetadata({ imageId });
      stats.requestsMade++;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        stoppedReason = "quota_exceeded";
        break;
      }
      throw err;
    }
    if (!meta.ok || !meta.body?.payload) {
      console.warn(`[olaProvider] metadata failed for ${imageId}: HTTP ${meta.status}`);
      continue;
    }
    const payload = meta.body.payload;

    if (!insideBbox(payload.lat, payload.lon, bbox)) {
      stats.skippedOutsideBbox++;
      continue; // don't download, don't follow this node's links further out
    }

    let download;
    try {
      download = await fetchImageBytes(payload.imageUrl);
      stats.requestsMade++;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        stoppedReason = "quota_exceeded";
        break;
      }
      throw err;
    }
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
    const quota = getQuotaStatus();
    console.log(
      `[olaProvider] (${panoramas.length}/${targetCount}) panorama ${imageId} @ ${payload.lat}, ${payload.lon} ` +
        `[quota ${quota.used}/${quota.limit}]`
    );

    for (const link of payload.links ?? []) {
      if (!visited.has(link)) queue.push(link);
    }
  }

  if (queue.length === 0 && panoramas.length < targetCount && stoppedReason === "target_reached") {
    stoppedReason = "queue_exhausted";
  }

  return { panoramas, stats, stoppedReason };
}
