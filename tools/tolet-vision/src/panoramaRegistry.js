// Persistent, cross-run registry of already-seen panoramas and
// already-found boards, shared by every discovery strategy in this tool
// (BFS, spatial sampling, and any future strategy) so that:
//   - a new strategy never re-spends API budget or OCR time re-processing
//     a panorama an earlier run already resolved, and
//   - "how many boards have we found, in total" is answered from one
//     deduped source of truth, instead of naively summing per-run counts
//     that would double-count anything found by more than one strategy in
//     overlapping ground.
//
// Deliberately two separate registries, not one:
//   - seenImageIds: keyed by Ola's own imageId. A panorama either has been
//     captured+OCR'd or hasn't; that fact never changes once recorded, and
//     it says nothing about whether a board was found there.
//   - seenBoards: keyed the same way boardDedup.js already dedupes within
//     a single run (phone, falling back to a rounded-coordinate bucket),
//     but merged *across* runs — accumulating every run's observations of
//     the same real-world board rather than one run's alone.
// Conflating the two would make "have we already captured this spot"
// (needed before paying for metadata+download) imply something about
// whether a board was ever found there, which isn't true — most panoramas
// have zero boards, and a board can be observed from more than one
// panorama.
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

const REGISTRY_DIR = path.resolve(import.meta.dirname, "..", ".data", "pilot", "registry");
const REGISTRY_PATH = path.join(REGISTRY_DIR, "panorama_registry.json");

function emptyRegistry() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    seenImageIds: {}, // imageId -> { latitude, longitude, source, locality, run, firstSeenAt }
    seenBoards: {}, // dedupeKey -> { key, phone, bhk, rent, propertyName, firstSeenAt, observations: [...] }
  };
}

let cached = null;

export async function loadRegistry() {
  if (cached) return cached;
  try {
    const raw = await readFile(REGISTRY_PATH, "utf8");
    cached = JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`[panoramaRegistry] could not read existing registry (${err.message}) — starting fresh.`);
    }
    cached = emptyRegistry();
  }
  return cached;
}

export async function saveRegistry(registry = cached) {
  if (!registry) return;
  registry.updatedAt = new Date().toISOString();
  await mkdir(REGISTRY_DIR, { recursive: true });
  // Write to a temp file then rename — a process killed mid-write must
  // never leave the registry truncated/unparsable, since every future run
  // (and the resume logic built on top of it) depends on reading it.
  const tmpPath = `${REGISTRY_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(registry, null, 2));
  await rename(tmpPath, REGISTRY_PATH);
}

export function hasImageId(registry, imageId) {
  return Object.prototype.hasOwnProperty.call(registry.seenImageIds, imageId);
}

export function getImageRecord(registry, imageId) {
  return registry.seenImageIds[imageId] ?? null;
}

// Insert-if-absent — an imageId's identity (where it is, which run first
// saw it) never changes once recorded, so recording an imageId that's
// already present is a no-op rather than an overwrite. This is what makes
// re-running the inventory scanner, or resuming a killed run, safe: no
// existing record is ever replaced or lost.
export function recordImageId(registry, imageId, { latitude, longitude, source, locality, run }) {
  if (hasImageId(registry, imageId)) return registry.seenImageIds[imageId];
  const record = { latitude, longitude, source, locality, run, firstSeenAt: new Date().toISOString() };
  registry.seenImageIds[imageId] = record;
  return record;
}

// Mirrors boardDedup.js's own key convention (phone if present, else a
// ~11m rounded-coordinate bucket) so a board found by two different
// strategies still merges into one registry entry. Duplicated here rather
// than imported from boardDedup.js — that file is the existing, validated
// pipeline this work is explicitly required to leave untouched.
function roundCoord(v, decimals = 4) {
  return Number(v.toFixed(decimals));
}
export function boardKeyFor(candidate) {
  return candidate.phone
    ? `phone:${candidate.phone}`
    : `loc:${roundCoord(candidate.latitude)},${roundCoord(candidate.longitude)}`;
}

// Merges a newly-found candidate into the board registry: a brand-new key
// becomes a new entry; an existing key gets this observation appended
// (deduped by sourceId, so re-recording the same candidate twice — e.g. a
// repeated inventory scan — is harmless) rather than the entry being
// replaced. No run's earlier observations are ever discarded, and a field
// already filled by an earlier observation is never overwritten by a
// later one, only filled in if it was previously null.
export function recordBoardObservation(registry, candidate, { source, locality, run }) {
  const key = boardKeyFor(candidate);
  const existing = registry.seenBoards[key];
  const observation = {
    sourceId: candidate.sourceId,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    score: candidate.score,
    ocrConfidence: candidate.ocrConfidence,
    cropImage: candidate.cropImage,
    source,
    locality,
    run,
  };

  if (!existing) {
    registry.seenBoards[key] = {
      key,
      phone: candidate.phone ?? null,
      bhk: candidate.bhk ?? null,
      rent: candidate.rent ?? null,
      propertyName: candidate.propertyName ?? null,
      firstSeenAt: new Date().toISOString(),
      observations: [observation],
    };
    return { isNewBoard: true, key };
  }

  const alreadyObserved = existing.observations.some(
    (o) => o.sourceId === observation.sourceId && o.source === observation.source
  );
  if (!alreadyObserved) existing.observations.push(observation);
  existing.bhk = existing.bhk ?? candidate.bhk ?? null;
  existing.rent = existing.rent ?? candidate.rent ?? null;
  existing.propertyName = existing.propertyName ?? candidate.propertyName ?? null;
  return { isNewBoard: false, key };
}

export function registryStats(registry) {
  return {
    imageIdCount: Object.keys(registry.seenImageIds).length,
    boardCount: Object.keys(registry.seenBoards).length,
  };
}
