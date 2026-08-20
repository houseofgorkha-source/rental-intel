// Cross-provider physical-board registry (board_registry.json). Extends
// panoramaRegistry.js's seenBoards concept (same dedup key convention —
// phone if present, else a rounded-coordinate bucket, matching
// boardDedup.js exactly, duplicated here for the same reason
// panoramaRegistry.js duplicates it: that file is the existing, validated
// pipeline this work must leave untouched) to be provider-aware and to
// preserve every observation forever — deduplication here means "group
// under one physical_board key," never "delete the losing observation."
import { writeFile, mkdir, readFile, rename } from "node:fs/promises";
import { REGISTRY_DIR, BOARD_REGISTRY_PATH } from "./paths.js";

function emptyRegistry() {
  return { version: 1, updatedAt: new Date().toISOString(), boards: {} };
}

let cached = null;

export async function loadBoardRegistry() {
  if (cached) return cached;
  try {
    cached = JSON.parse(await readFile(BOARD_REGISTRY_PATH, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`[boardRegistry] could not read existing registry (${err.message}) — starting fresh.`);
    cached = emptyRegistry();
  }
  return cached;
}

export async function saveBoardRegistry(registry = cached) {
  if (!registry) return;
  registry.updatedAt = new Date().toISOString();
  await mkdir(REGISTRY_DIR, { recursive: true });
  const tmpPath = `${BOARD_REGISTRY_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(registry, null, 2));
  await rename(tmpPath, BOARD_REGISTRY_PATH);
}

function roundCoord(v, decimals = 4) {
  return Number(v.toFixed(decimals));
}

export function physicalBoardKeyFor(candidate) {
  return candidate.phone
    ? `phone:${candidate.phone}`
    : `loc:${roundCoord(candidate.latitude)},${roundCoord(candidate.longitude)}`;
}

// `candidate` needs: provider, sourceId, latitude, longitude, phone?,
// score, ocrConfidence, cropImage (a path, never the pixel data itself).
// `context` needs: sessionId, source, locality, run (run kept for
// backward-compat with migrated pre-archive data). Never overwrites or
// removes a prior observation — only appends (deduped by
// provider+sourceId+session so a re-run of the same session is harmless).
export function upsertBoardObservation(registry, candidate, context) {
  const key = physicalBoardKeyFor(candidate);
  const existing = registry.boards[key];
  const observation = {
    provider: candidate.provider,
    sourceId: candidate.sourceId,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    score: candidate.score,
    ocrConfidence: candidate.ocrConfidence,
    cropImagePath: candidate.cropImage ?? null,
    sessionId: context.sessionId ?? null,
    source: context.source ?? null,
    locality: context.locality ?? null,
    run: context.run ?? null,
  };

  if (!existing) {
    registry.boards[key] = {
      key,
      phone: candidate.phone ?? null,
      bhk: candidate.bhk ?? null,
      rent: candidate.rent ?? null,
      propertyName: candidate.propertyName ?? null,
      firstSeenAt: new Date().toISOString(),
      providers: [candidate.provider],
      observations: [observation],
    };
    return { isNewBoard: true, key };
  }

  const alreadyObserved = existing.observations.some(
    (o) => o.provider === observation.provider && o.sourceId === observation.sourceId && o.sessionId === observation.sessionId
  );
  if (!alreadyObserved) existing.observations.push(observation);
  if (!existing.providers.includes(candidate.provider)) existing.providers.push(candidate.provider);
  existing.bhk = existing.bhk ?? candidate.bhk ?? null;
  existing.rent = existing.rent ?? candidate.rent ?? null;
  existing.propertyName = existing.propertyName ?? candidate.propertyName ?? null;
  return { isNewBoard: false, key };
}

export function boardRegistryStats(registry) {
  const boards = Object.values(registry.boards);
  return {
    total: boards.length,
    crossProvider: boards.filter((b) => b.providers.length > 1).length,
    totalObservations: boards.reduce((s, b) => s + b.observations.length, 0),
  };
}
