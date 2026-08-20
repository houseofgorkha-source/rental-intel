// Path constants for the durable imagery/data archive
// (.data/imagery/**). Nothing in this file touches the pre-existing
// .data/pilot/** tree or panoramaRegistry.js's own storage location — the
// archive is deliberately a separate, additive directory, not a
// replacement. See archiveMigrateExisting.js for the one-time migration
// that populates it from the existing data without moving/deleting
// anything.
import path from "node:path";

export const IMAGERY_ROOT = path.resolve(import.meta.dirname, "..", "..", ".data", "imagery");

export function providerRoot(provider) {
  return path.join(IMAGERY_ROOT, provider);
}

export function sessionsDir(provider) {
  return path.join(providerRoot(provider), "sessions");
}

export function sessionDir(provider, sessionId) {
  return path.join(sessionsDir(provider), sessionId);
}

export function sessionManifestPath(provider, sessionId) {
  return path.join(sessionDir(provider, sessionId), "manifest.json");
}

export function sessionRequestsLedgerPath(provider, sessionId) {
  return path.join(sessionDir(provider, sessionId), "requests.jsonl");
}

export function panoramasDir(provider, sessionId) {
  return path.join(sessionDir(provider, sessionId), "panoramas");
}

export function panoramaDir(provider, sessionId, panoId) {
  return path.join(panoramasDir(provider, sessionId), panoId);
}

export function panoramaTilesDir(provider, sessionId, panoId) {
  return path.join(panoramaDir(provider, sessionId, panoId), "tiles");
}

export const REGISTRY_DIR = path.join(IMAGERY_ROOT, "registry");
export const IMAGE_REGISTRY_PATH = path.join(REGISTRY_DIR, "image_registry.json");
export const BOARD_REGISTRY_PATH = path.join(REGISTRY_DIR, "board_registry.json");
export const DEDUP_REGISTRY_PATH = path.join(REGISTRY_DIR, "dedup_registry.json");
export const COST_REGISTRY_PATH = path.join(REGISTRY_DIR, "cost_registry.json");
