// Cross-provider physical-panorama registry (image_registry.json) — the
// archive's record of every panorama ever resolved, by any provider, in
// any session. Distinct from panoramaRegistry.js (Ola-only, "have we
// already spent a request on this imageId") — this registry is the
// richer, durable one described in the archive spec: coordinates, capture
// date, metadata, dimensions, file hash, session, OCR/detection output
// references, and whether the raw image bytes are actually available on
// disk (most historical Ola panoramas were never persisted — see
// archiveMigrateExisting.js's reconciliation report for exactly which).
//
// Keyed by `${provider}:${sourceId}` so Ola's imageId and Google's panoId
// never collide. Insert-if-absent for the identity fields (a panorama's
// provider/sourceId/coordinates never change once recorded), but OCR/
// detection references and rawImageAvailable can be filled in later by a
// second pass without needing to re-fetch anything.
import { writeFile, mkdir, readFile, rename } from "node:fs/promises";
import { REGISTRY_DIR, IMAGE_REGISTRY_PATH } from "./paths.js";

function emptyRegistry() {
  return { version: 1, updatedAt: new Date().toISOString(), entries: {} };
}

let cached = null;

export async function loadImageRegistry() {
  if (cached) return cached;
  try {
    cached = JSON.parse(await readFile(IMAGE_REGISTRY_PATH, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`[imageRegistry] could not read existing registry (${err.message}) — starting fresh.`);
    cached = emptyRegistry();
  }
  return cached;
}

export async function saveImageRegistry(registry = cached) {
  if (!registry) return;
  registry.updatedAt = new Date().toISOString();
  await mkdir(REGISTRY_DIR, { recursive: true });
  const tmpPath = `${IMAGE_REGISTRY_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(registry, null, 2));
  await rename(tmpPath, IMAGE_REGISTRY_PATH);
}

export function imageKey(provider, sourceId) {
  return `${provider}:${sourceId}`;
}

export function hasImage(registry, provider, sourceId) {
  return Object.prototype.hasOwnProperty.call(registry.entries, imageKey(provider, sourceId));
}

// `entry` fields: provider, sourceId, latitude, longitude, captureDate,
// metadataResponse, sourceEndpoint, requestTimestamp, imageWidth,
// imageHeight, fileHash, sessionId, apiRequestId, ocrOutputRef,
// detectionOutputRef, rawImageAvailable, rawImagePath, physicalLocationId.
// Insert-if-absent on the identity fields; always safe to call again with
// updated ocrOutputRef/detectionOutputRef/rawImageAvailable once those
// become known without disturbing what's already recorded.
export function upsertImage(registry, entry) {
  const key = imageKey(entry.provider, entry.sourceId);
  const existing = registry.entries[key];
  if (!existing) {
    registry.entries[key] = { ...entry, firstRecordedAt: new Date().toISOString() };
    return { isNew: true, key };
  }
  // Never clobber identity fields; only fill in previously-null enrichment fields.
  for (const field of ["ocrOutputRef", "detectionOutputRef", "rawImagePath", "physicalLocationId", "fileHash", "apiRequestId"]) {
    if (existing[field] == null && entry[field] != null) existing[field] = entry[field];
  }
  if (entry.rawImageAvailable) existing.rawImageAvailable = true;
  return { isNew: false, key };
}

export function imageRegistryStats(registry) {
  const entries = Object.values(registry.entries);
  return {
    total: entries.length,
    byProvider: entries.reduce((acc, e) => ((acc[e.provider] = (acc[e.provider] ?? 0) + 1), acc), {}),
    withRawImageAvailable: entries.filter((e) => e.rawImageAvailable).length,
  };
}
