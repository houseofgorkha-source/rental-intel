// One-off export: adds the Google Tiles comparison session's 50
// reconstructed panoramas to the existing spotted-boards preview dataset
// (data/spotted-boards-dataset.json), so they can be visually inspected
// on the same dev-only preview page (/spotted-boards-preview) the Ola
// detections already use — purely for human verification of what
// Google's imagery actually shows at each point, not a product feature.
//
// Read-only against the Google session's own archive output and against
// the existing Ola dataset/images (never rewrites an Ola entry). Writes
// only: appends new provider:"google" entries to
// data/spotted-boards-dataset.json, and new resized images into
// public/spotted-boards-preview/google/ (resized down from the ~3-4MB
// full reconstructed panoramas to keep the app's public/ directory
// reasonable — this is a verification aid, not an archival copy; the
// originals stay untouched in .data/imagery/).
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";
import { sessionsDir, sessionDir } from "./archive/paths.js";

const TOOL_ROOT = path.resolve(import.meta.dirname, "..");
const APP_ROOT = path.resolve(TOOL_ROOT, "..", "..");
const OUT_DATA_PATH = path.join(APP_ROOT, "data", "spotted-boards-dataset.json");
const OUT_IMAGE_DIR = path.join(APP_ROOT, "public", "spotted-boards-preview", "google");

const PREVIEW_MAX_WIDTH = 1200;

async function resolveSessionId() {
  const explicit = process.argv[2];
  if (explicit) return explicit;
  const dir = sessionsDir("google");
  const entries = await readdir(dir, { withFileTypes: true });
  const candidates = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const m = JSON.parse(await readFile(path.join(dir, e.name, "manifest.json"), "utf8"));
      candidates.push({ sessionId: e.name, startTime: m.startTime });
    } catch {
      /* skip */
    }
  }
  if (candidates.length === 0) throw new Error("[exportGoogleComparisonForPreview] no Google sessions found");
  candidates.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  return candidates[0].sessionId;
}

function localityLabelForIndex(point) {
  return point.olaBoardKey ? `Google comparison — Ola board ${point.olaBoardKey}` : `Google comparison point`;
}

async function main() {
  const sessionId = await resolveSessionId();
  const dir = sessionDir("google", sessionId);
  const results = JSON.parse(await readFile(path.join(dir, "discovery_results.json"), "utf8"));

  await mkdir(OUT_IMAGE_DIR, { recursive: true });

  const existing = JSON.parse(await readFile(OUT_DATA_PATH, "utf8"));
  // Idempotent: drop any previously-exported entries from this exact
  // session before re-adding, so re-running after a rerun doesn't
  // accumulate duplicate pins.
  existing.boards = existing.boards.filter((b) => !(b.provider === "google" && b.googleSessionId === sessionId));

  let exported = 0;
  for (const point of results.pointResults) {
    if (point.outcome !== "resolved" || !point.panoId) continue;
    const pointIndex = point.index;

    const panoramaPath = path.join(dir, "panoramas", point.panoId, "panorama.jpg");
    let resizedBuffer;
    try {
      const image = await Jimp.read(panoramaPath);
      if (image.bitmap.width > PREVIEW_MAX_WIDTH) image.resize({ w: PREVIEW_MAX_WIDTH });
      resizedBuffer = await image.getBuffer(JimpMime.jpeg);
    } catch (err) {
      console.warn(`[exportGoogleComparisonForPreview] skipping ${point.panoId} — could not read panorama.jpg: ${err.message}`);
      continue;
    }

    const imageFileName = `${point.panoId}.jpg`;
    await writeFile(path.join(OUT_IMAGE_DIR, imageFileName), resizedBuffer);

    const best = [...(point.candidates ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null;

    // Keyed by point index, not just panoId — two different Ola board
    // locations can legitimately resolve to the same Google panorama
    // (coarser capture granularity at that spot), and that's a real
    // finding worth keeping visible, not collapsing into one entry.
    existing.boards.push({
      id: `google-${pointIndex}-${point.panoId}`,
      key: `google:${point.panoId}:${pointIndex}`,
      phone: best?.phone ?? null,
      bhk: best?.bhk != null ? String(best.bhk) : null,
      rent: best?.rent ?? null,
      propertyName: best?.propertyName ?? null,
      latitude: point.resolvedLatitude,
      longitude: point.resolvedLongitude,
      imagePath: `/spotted-boards-preview/google/${imageFileName}`,
      score: best?.score ?? 0,
      ocrConfidence: best?.ocrConfidence ?? (point.tileConfidences?.length ? point.tileConfidences.reduce((a, b) => a + b, 0) / point.tileConfidences.length : 0),
      observationCount: point.candidates?.length ?? 0,
      sources: ["google_tiles_comparison"],
      cluster: "google-comparison",
      locality: localityLabelForIndex(point),
      localityKey: null,
      firstSeenAt: new Date().toISOString(),
      provider: "google",
      googleSessionId: sessionId,
      olaBoardKey: point.olaBoardKey,
      olaPhone: point.olaPhone,
      hasDetection: (point.candidates?.length ?? 0) > 0,
    });
    exported++;
  }

  existing.generatedAt = new Date().toISOString();
  existing.boardCount = existing.boards.length;
  await writeFile(OUT_DATA_PATH, JSON.stringify(existing, null, 2));

  console.log(`[exportGoogleComparisonForPreview] session: ${sessionId}`);
  console.log(`[exportGoogleComparisonForPreview] ${exported} Google panoramas exported (resized to max ${PREVIEW_MAX_WIDTH}px wide)`);
  console.log(`[exportGoogleComparisonForPreview] dataset updated: ${OUT_DATA_PATH} (${existing.boards.length} total entries)`);
  console.log(`[exportGoogleComparisonForPreview] images written: ${OUT_IMAGE_DIR}`);
}

main().catch((err) => {
  console.error("[exportGoogleComparisonForPreview] failed:", err);
  process.exitCode = 1;
});
