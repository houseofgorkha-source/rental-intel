// Deduplication *relationships* (dedup_registry.json) — never a deletion
// mechanism. Every relationship recorded here points at raw records that
// still exist untouched in imageRegistry.js/boardRegistry.js; this file
// only annotates "these are the same physical thing," so a later
// investigation (or a better dedup heuristic) can always walk back to
// every original observation.
//
// Three levels, per the archive spec:
//   intra-session      — same provider + same session (handled by the
//                         provider's own resolver skipping a re-fetch;
//                         rarely needs a relationship record since it's
//                         usually just "we didn't re-download this").
//   cross-session/provider (same provider) — same Ola imageId or Google
//                         panoId requested by two different sessions.
//                         Recorded as "duplicate_of" pointing at whichever
//                         session recorded it first.
//   cross-provider physical dedup — Ola and Google photographing the same
//                         real-world location/board. Recorded as
//                         "same_physical_board" / "same_location" once a
//                         human or a future matching pass (coordinate
//                         proximity + phone match + perceptual image hash)
//                         confirms it — never assumed just because two
//                         providers both have *a* panorama near the same
//                         coordinates.
import { writeFile, mkdir, readFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { REGISTRY_DIR, DEDUP_REGISTRY_PATH } from "./paths.js";

function emptyRegistry() {
  return { version: 1, updatedAt: new Date().toISOString(), relationships: [] };
}

let cached = null;

export async function loadDedupRegistry() {
  if (cached) return cached;
  try {
    cached = JSON.parse(await readFile(DEDUP_REGISTRY_PATH, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`[dedupRegistry] could not read existing registry (${err.message}) — starting fresh.`);
    cached = emptyRegistry();
  }
  return cached;
}

export async function saveDedupRegistry(registry = cached) {
  if (!registry) return;
  registry.updatedAt = new Date().toISOString();
  await mkdir(REGISTRY_DIR, { recursive: true });
  const tmpPath = `${DEDUP_REGISTRY_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(registry, null, 2));
  await rename(tmpPath, DEDUP_REGISTRY_PATH);
}

const VALID_TYPES = new Set(["duplicate_of", "same_physical_board", "same_location", "equivalent_observation"]);

// subject/related: { provider, sourceId } for image-level relationships,
// or { boardKey } for board-level ones. `method`: how this was decided
// (e.g. "imageId_reuse", "phone_match", "coordinate_proximity",
// "perceptual_hash", "manual_review"). Idempotent by (type, subject,
// related) triple — recording the same relationship twice is a no-op.
export function addRelationship(registry, { type, subject, related, method, confidence = null, notes = null }) {
  if (!VALID_TYPES.has(type)) throw new Error(`[dedupRegistry] unknown relationship type "${type}"`);
  const subjectKey = subject.boardKey ?? `${subject.provider}:${subject.sourceId}`;
  const relatedKey = related.boardKey ?? `${related.provider}:${related.sourceId}`;

  const alreadyExists = registry.relationships.some(
    (r) => r.type === type && r.subjectKey === subjectKey && r.relatedKey === relatedKey
  );
  if (alreadyExists) return { isNew: false };

  registry.relationships.push({
    id: randomUUID(),
    type,
    subject,
    subjectKey,
    related,
    relatedKey,
    method,
    confidence,
    notes,
    decidedAt: new Date().toISOString(),
  });
  return { isNew: true };
}

export function relationshipsFor(registry, key) {
  return registry.relationships.filter((r) => r.subjectKey === key || r.relatedKey === key);
}

export function dedupRegistryStats(registry) {
  const byType = registry.relationships.reduce((acc, r) => ((acc[r.type] = (acc[r.type] ?? 0) + 1), acc), {});
  return { total: registry.relationships.length, byType };
}
