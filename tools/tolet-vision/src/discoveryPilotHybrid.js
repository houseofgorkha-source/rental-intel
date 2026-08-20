// Hybrid discovery strategy: spatial sampling for broad, even census
// coverage, with a local BFS-style expansion burst triggered the moment a
// genuine To-Let board is found — rental-heavy pockets tend to have more
// than one board on the same stretch of road, so a hit is treated as a
// signal to look harder right there, not just recorded and moved past.
//
// Pipeline: locality bbox -> /coverage -> spatial street sampling
// (spatialSampler.js, unchanged) -> nearestImageId per sample point,
// registry-gated -> OCR/score (unchanged pipeline) -> on a genuine
// candidate, expand locally via the same `links` neighbour-graph the BFS
// crawler uses -> every panorama either strategy touches is deduped
// through the one global registry (panoramaRegistry.js, unchanged).
//
// Does not modify or import the crawl logic of discoveryPilot.js,
// discoveryPilotClusters.js, or providers/ola/olaProvider.js. The local
// expansion below is a new, small, purpose-built function — not a call
// into crawlPanoramas() — for a specific reason: crawlPanoramas() has no
// way to skip a registry-known imageId before paying for its
// metadata+download (it wasn't built with a global registry in mind, and
// this work is required to leave it that way), and its seeding step would
// waste a redundant nearestImageId lookup re-discovering a panorama we
// already have in hand. Expansion here reuses the same low-level
// primitives BFS itself uses (providers/ola/olaClient.js's getMetadata /
// fetchImageBytes) and the same `links`-following idea, just registry-
// aware and seeded from an imageId we already resolved.
//
// Checkpoint/resume: locality + sample-point index resume exactly like
// discoveryPilotSpatial.js. Expansion bursts are *not* separately
// checkpointed node-by-node — deliberately: because every panorama
// touched during expansion is recorded in the registry immediately, an
// expansion burst interrupted mid-way is simply safe (not wasteful) to
// restart from its trigger on resume — every already-touched node in the
// registry is skipped instantly, so at most the resolvePanoramaAtPoint-
// equivalent lookups for a handful of already-known nodes are repeated,
// not full metadata+download+OCR. Only whether a trigger's expansion
// fully *completed* is checkpointed, so a finished burst is never redone.
//
// IMPORTANT — do not run concurrently with any other crawl using this
// tool. Shares apiQuota.js's persisted quota_state.json (no cross-process
// locking) and panoramaRegistry.js's registry file.
//
// Archive wiring (added on explicit product-owner request — "go ahead
// with live Ola archive wiring"): every existing decision point above
// (quota enforcement via apiQuota.js, checkpoint schema, OCR thresholds,
// dedup logic via panoramaRegistry.js/boardDedup.js) is unchanged — the
// archive calls below only ever record what already happened, never
// change whether/how it happens. See src/archive/*.js for the durable
// .data/imagery/ store this now writes into, alongside (not instead of)
// panoramaRegistry.js/apiQuota.js, which remain Ola's own dedup/quota
// source of truth exactly as before.
import { writeFile, mkdir, readFile, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { configureQuota, getQuotaStatus, QuotaExceededError } from "./apiQuota.js";
import { getCoverage, getNearestImageId, getMetadata, fetchImageBytes, readImageDimensions } from "./providers/ola/olaClient.js";
import { sampleCoverage } from "./spatialSampler.js";
import { ocrPanorama } from "./ocrPipeline.js";
import { createPaddleOcrWorker } from "./paddleOcrEngine.js";
import { extractAndScore, hasRentalSignal } from "./rentalScoring.js";
import { dedupeBoards } from "./boardDedup.js";
import {
  loadRegistry,
  saveRegistry,
  hasImageId,
  recordImageId,
  recordBoardObservation,
  registryStats,
} from "./panoramaRegistry.js";
import { generateSessionId } from "./archive/sessionId.js";
import { newManifest, saveManifest, finalizeManifest } from "./archive/sessionManifest.js";
import { appendRequest, readLedger } from "./archive/requestLedger.js";
import { loadImageRegistry, saveImageRegistry, upsertImage } from "./archive/imageRegistry.js";
import { loadBoardRegistry, saveBoardRegistry, upsertBoardObservation } from "./archive/boardRegistry.js";
import { loadDedupRegistry, saveDedupRegistry, addRelationship } from "./archive/dedupRegistry.js";
import { recomputeCostRegistry } from "./archive/costRegistry.js";
import { panoramaDir } from "./archive/paths.js";

const PROVIDER_NAME = "ola";
const CANDIDATE_SCORE_THRESHOLD = 15;
const OCR_CONFIDENCE_FLOOR = 50;

const TOTAL_REQUEST_LIMIT = Number(process.env.OLA_API_REQUEST_LIMIT) || 8000;
const STEP_METERS = Number(process.env.SPATIAL_STEP_METERS) || 70;
const MAX_POINTS_PER_LOCALITY = Number(process.env.SPATIAL_MAX_POINTS_PER_LOCALITY) || 220;

// How far an expansion burst is allowed to wander from its trigger panorama
// (degrees — ~180m at this latitude) and how many *newly processed* (not
// already-registry-known) panoramas it may add before stopping. Small and
// local on purpose: this is "check the rest of this block," not a second
// area-wide crawl.
const EXPANSION_RADIUS_DEG = Number(process.env.HYBRID_EXPANSION_RADIUS_DEG) || 0.0016;
const EXPANSION_MAX_NEW_PANORAMAS = Number(process.env.HYBRID_EXPANSION_MAX_NEW) || 12;

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data", "pilot", "hybrid");
const CHECKPOINT_PATH = path.join(DATA_DIR, "checkpoint.json");

// Widened from 0.008 (~1.78km box) to 0.016 (~3.56km box) on explicit
// product-owner request, to let each target locality's sampling reach
// streets that sat just outside the original box. maxPointsPerLocality is
// left unchanged (220) — this run trades sampling density for wider area
// coverage, not denser coverage of the original footprint.
const BBOX_HALF_WIDTH_DEG = 0.016;
function bboxAround(centerLat, centerLon) {
  return {
    xMin: centerLon - BBOX_HALF_WIDTH_DEG,
    xMax: centerLon + BBOX_HALF_WIDTH_DEG,
    yMin: centerLat - BBOX_HALF_WIDTH_DEG,
    yMax: centerLat + BBOX_HALF_WIDTH_DEG,
  };
}

// Priority order exactly as specified: the five standout localities from
// the completed BFS run first, then Koramangala proper, the productive
// Indiranagar sub-localities (Domlur/Jeevan Bima Nagar/CV Raman Nagar —
// the three with candidates>0; HAL 2nd Stage and Ulsoor are deliberately
// excluded, they found zero boards on a full BFS pass), then ITPL and
// Hoodi. HSR Layout (28.3 boards/1000) and BTM Layout (16.0) — flagged
// above as having positive yield but left out pending explicit approval —
// are now appended at the end, on product-owner request, using the same
// coordinates and koramangala clusterId already established for them in
// discoveryPilotClusters.js.
const TARGET_LOCALITIES = [
  { id: "sg-palya", label: "SG Palya", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9327, 77.6113) },
  { id: "madiwala", label: "Madiwala", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9224, 77.6144) },
  { id: "murugeshpalya", label: "Murugeshpalya", clusterId: "indiranagar", clusterLabel: "Indiranagar", bbox: bboxAround(12.956, 77.662) },
  { id: "ejipura", label: "Ejipura", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9422, 77.6296) },
  { id: "jakkasandra", label: "Jakkasandra", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9345, 77.6187) },
  { id: "koramangala", label: "Koramangala", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9352, 77.6245) },
  { id: "domlur", label: "Domlur", clusterId: "indiranagar", clusterLabel: "Indiranagar", bbox: bboxAround(12.961, 77.6387) },
  { id: "jeevan-bima-nagar", label: "Jeevan Bima Nagar", clusterId: "indiranagar", clusterLabel: "Indiranagar", bbox: bboxAround(12.9611, 77.658) },
  { id: "cv-raman-nagar", label: "CV Raman Nagar", clusterId: "indiranagar", clusterLabel: "Indiranagar", bbox: bboxAround(12.9819, 77.666) },
  { id: "itpl", label: "ITPL", clusterId: "whitefield", clusterLabel: "Whitefield", bbox: bboxAround(12.986, 77.7378) },
  { id: "hoodi", label: "Hoodi", clusterId: "whitefield", clusterLabel: "Whitefield", bbox: bboxAround(12.9931, 77.7139) },
  { id: "hsr-layout", label: "HSR Layout", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9121, 77.6446) },
  { id: "btm-layout", label: "BTM Layout", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9166, 77.6101) },

  // --- Geographic diversification (explicit product-owner request: "more
  // diversed areas," don't avoid previously-visited ground but prioritize
  // spreading across greater Bangalore rather than deepening the existing
  // Koramangala/Indiranagar/Whitefield footprint above). Six new clusters
  // covering north, west, central, south, and the outer-ring-road corridor
  // — areas this tool has never sampled. Every one of these is registry-
  // gated exactly like the localities above, so any overlap with prior
  // ground (e.g. Old Airport Road bordering Indiranagar) costs nothing
  // beyond a duplicate-skip.
  { id: "hebbal", label: "Hebbal", clusterId: "north", clusterLabel: "North Bangalore", bbox: bboxAround(13.0358, 77.597) },
  { id: "yelahanka", label: "Yelahanka", clusterId: "north", clusterLabel: "North Bangalore", bbox: bboxAround(13.1007, 77.5963) },
  { id: "rt-nagar", label: "RT Nagar", clusterId: "north", clusterLabel: "North Bangalore", bbox: bboxAround(13.021, 77.595) },
  { id: "sanjaynagar", label: "Sanjaynagar", clusterId: "north", clusterLabel: "North Bangalore", bbox: bboxAround(13.035, 77.573) },
  { id: "jalahalli", label: "Jalahalli", clusterId: "north", clusterLabel: "North Bangalore", bbox: bboxAround(13.045, 77.546) },

  { id: "rajajinagar", label: "Rajajinagar", clusterId: "west", clusterLabel: "West Bangalore", bbox: bboxAround(12.9915, 77.552) },
  { id: "vijayanagar", label: "Vijayanagar", clusterId: "west", clusterLabel: "West Bangalore", bbox: bboxAround(12.9719, 77.533) },
  { id: "basaveshwaranagar", label: "Basaveshwaranagar", clusterId: "west", clusterLabel: "West Bangalore", bbox: bboxAround(12.988, 77.536) },
  { id: "nagarbhavi", label: "Nagarbhavi", clusterId: "west", clusterLabel: "West Bangalore", bbox: bboxAround(12.959, 77.506) },
  { id: "kengeri", label: "Kengeri", clusterId: "west", clusterLabel: "West Bangalore", bbox: bboxAround(12.908, 77.483) },

  { id: "malleshwaram", label: "Malleshwaram", clusterId: "central", clusterLabel: "Central Bangalore", bbox: bboxAround(13.0035, 77.573) },
  { id: "seshadripuram", label: "Seshadripuram", clusterId: "central", clusterLabel: "Central Bangalore", bbox: bboxAround(12.995, 77.578) },
  { id: "shivajinagar", label: "Shivajinagar", clusterId: "central", clusterLabel: "Central Bangalore", bbox: bboxAround(12.986, 77.605) },
  { id: "frazer-town", label: "Frazer Town", clusterId: "central", clusterLabel: "Central Bangalore", bbox: bboxAround(12.999, 77.612) },
  { id: "cox-town", label: "Cox Town", clusterId: "central", clusterLabel: "Central Bangalore", bbox: bboxAround(12.997, 77.617) },

  { id: "jayanagar", label: "Jayanagar", clusterId: "south", clusterLabel: "South Bangalore", bbox: bboxAround(12.9308, 77.5838) },
  { id: "jp-nagar", label: "JP Nagar", clusterId: "south", clusterLabel: "South Bangalore", bbox: bboxAround(12.908, 77.585) },
  { id: "banashankari", label: "Banashankari", clusterId: "south", clusterLabel: "South Bangalore", bbox: bboxAround(12.925, 77.546) },
  { id: "basavanagudi", label: "Basavanagudi", clusterId: "south", clusterLabel: "South Bangalore", bbox: bboxAround(12.942, 77.573) },
  { id: "bannerghatta-road", label: "Bannerghatta Road", clusterId: "south", clusterLabel: "South Bangalore", bbox: bboxAround(12.89, 77.597) },
  { id: "electronic-city", label: "Electronic City", clusterId: "south", clusterLabel: "South Bangalore", bbox: bboxAround(12.845, 77.66) },

  { id: "marathahalli", label: "Marathahalli", clusterId: "outer-ring", clusterLabel: "Outer Ring Road", bbox: bboxAround(12.9569, 77.7011) },
  { id: "bellandur", label: "Bellandur", clusterId: "outer-ring", clusterLabel: "Outer Ring Road", bbox: bboxAround(12.926, 77.677) },
  { id: "sarjapur-road", label: "Sarjapur Road", clusterId: "outer-ring", clusterLabel: "Outer Ring Road", bbox: bboxAround(12.901, 77.687) },
  { id: "kalyan-nagar", label: "Kalyan Nagar", clusterId: "outer-ring", clusterLabel: "Outer Ring Road", bbox: bboxAround(13.023, 77.639) },
  { id: "banaswadi", label: "Banaswadi", clusterId: "outer-ring", clusterLabel: "Outer Ring Road", bbox: bboxAround(13.014, 77.651) },
  { id: "old-airport-road", label: "Old Airport Road", clusterId: "outer-ring", clusterLabel: "Outer Ring Road", bbox: bboxAround(12.96, 77.648) },
];

function localityKey(loc) {
  return `${loc.clusterId}/${loc.id}`;
}

// ---- Archive session state (module-scoped: one hybrid session per process) --
// Set once in main() before the locality loop. Every archive-recording
// helper below reads these rather than threading a session object through
// every function signature in the existing call graph.
let archiveSessionId = null;
let archiveManifest = null;
let archiveImageRegistry = null;
let archiveBoardRegistry = null;
let archiveDedupRegistry = null;

// Soft target for THIS session only (distinct from the hard quota ceiling
// below) — product-owner request: "target 5,000 new panoramas," with the
// request budget itself governed separately by OLA_API_REQUEST_LIMIT. Once
// this session has newly archived this many panoramas, the run stops
// cleanly (checkpointed, resumable) even if quota remains — so a 5,000
// target doesn't silently balloon into "however many the whole locality
// list adds up to."
const NEW_PANORAMA_TARGET = Number(process.env.HYBRID_NEW_PANORAMA_TARGET) || 5000;
let sessionNewPanoramaCount = 0;
function sessionTargetReached() {
  return sessionNewPanoramaCount >= NEW_PANORAMA_TARGET;
}

// Wraps one olaClient call with latency + success/failure logging into the
// new per-session request ledger (archive/requestLedger.js) — never
// apiQuota.js, which keeps enforcing the crawler budget exactly as
// before. `billable: true` reflects a fact already true today (every one
// of these calls already consumes apiQuota.js's crawler quota), not a
// cost guess — Ola's actual per-request $ pricing isn't documented
// anywhere in this project, so estimatedCostUsd is left at 0 rather than
// invented. A QuotaExceededError thrown by the wrapped call is logged as
// a failed attempt, then rethrown unchanged — existing quota-stop
// handling upstream is untouched.
async function loggedCall(fn, { purpose, panoramaId = null }) {
  const start = Date.now();
  try {
    const result = await fn();
    await appendRequest("ola", archiveSessionId, {
      endpoint: purpose,
      purpose,
      panoramaId,
      success: !!result?.ok,
      httpStatus: result?.status ?? null,
      latencyMs: Date.now() - start,
      billable: true,
      quotaCategory: "ola_crawler",
    });
    return result;
  } catch (err) {
    await appendRequest("ola", archiveSessionId, {
      endpoint: purpose,
      purpose,
      panoramaId,
      success: false,
      httpStatus: null,
      latencyMs: Date.now() - start,
      billable: true,
      quotaCategory: "ola_crawler",
    });
    throw err;
  }
}

// Persists one resolved panorama into the durable archive: raw image
// bytes, metadata, full OCR output (every tile, not just qualifying
// ones — the gap the migration report flagged as the biggest loss in the
// pre-archive data), and whatever candidates/board matches it produced.
// Registries are updated in-memory here and flushed to disk by the
// caller's existing saveRegistry()-adjacent save points, matching the
// cadence panoramaRegistry.js already uses.
async function archivePanorama(pano, { tileResults, candidates, sourceTag, locality, requestTimestamp }) {
  const dir = panoramaDir("ola", archiveSessionId, pano.sourceId);
  await mkdir(dir, { recursive: true });

  const fileHash = createHash("sha256").update(pano.imageBytes).digest("hex");
  const dims = readImageDimensions(pano.imageBytes);

  await writeFile(path.join(dir, "panorama.jpg"), pano.imageBytes);
  await writeFile(
    path.join(dir, "metadata.json"),
    JSON.stringify({ latitude: pano.latitude, longitude: pano.longitude, bearing: pano.bearing, links: pano.links }, null, 2)
  );
  await writeFile(
    path.join(dir, "source.json"),
    JSON.stringify({ provider: "ola", sourceId: pano.sourceId, sessionId: archiveSessionId, sourceTag, locality, requestTimestamp, sourceEndpoint: "/sli/v1/streetview/metadata" }, null, 2)
  );
  await writeFile(path.join(dir, "ocr.json"), JSON.stringify(tileResults, null, 2));
  await writeFile(path.join(dir, "detections.json"), JSON.stringify(candidates, null, 2));

  upsertImage(archiveImageRegistry, {
    provider: "ola",
    sourceId: pano.sourceId,
    latitude: pano.latitude,
    longitude: pano.longitude,
    captureDate: null,
    metadataResponse: null,
    sourceEndpoint: "/sli/v1/streetview/metadata",
    requestTimestamp,
    imageWidth: dims?.width ?? null,
    imageHeight: dims?.height ?? null,
    fileHash,
    sessionId: archiveSessionId,
    apiRequestId: null,
    ocrOutputRef: path.join(dir, "ocr.json"),
    detectionOutputRef: candidates.length ? path.join(dir, "detections.json") : null,
    rawImageAvailable: true,
    rawImagePath: path.join(dir, "panorama.jpg"),
    physicalLocationId: null,
  });

  for (const candidate of candidates) {
    const context = { sessionId: archiveSessionId, source: sourceTag, locality, run: archiveSessionId };
    const { isNewBoard, key } = upsertBoardObservation(archiveBoardRegistry, candidate, context);
    if (!isNewBoard) {
      const firstObs = archiveBoardRegistry.boards[key].observations[0];
      if (firstObs.sourceId !== candidate.sourceId) {
        addRelationship(archiveDedupRegistry, {
          type: "same_physical_board",
          subject: { provider: "ola", sourceId: candidate.sourceId },
          related: { provider: firstObs.provider, sourceId: firstObs.sourceId },
          method: "existing_boardDedup_key_reuse",
          confidence: candidate.phone ? "high" : "medium",
          notes: candidate.phone ? "matched on phone number" : "matched on rounded-coordinate bucket (~11m)",
        });
      }
    }
  }

  archiveManifest.panoramaCount += 1;
  archiveManifest.tileCount += tileResults.length;
  archiveManifest.ocrCount += tileResults.length;
  archiveManifest.candidateCount += candidates.length;
  sessionNewPanoramaCount += 1;
}

async function saveArchiveState() {
  await saveManifest(archiveManifest);
  await saveImageRegistry(archiveImageRegistry);
  await saveBoardRegistry(archiveBoardRegistry);
  await saveDedupRegistry(archiveDedupRegistry);
}

// ---- Checkpoint persistence -------------------------------------------

function emptyCheckpoint() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: {
      stepMeters: STEP_METERS,
      maxPointsPerLocality: MAX_POINTS_PER_LOCALITY,
      expansionRadiusDeg: EXPANSION_RADIUS_DEG,
      expansionMaxNew: EXPANSION_MAX_NEW_PANORAMAS,
      requestLimit: TOTAL_REQUEST_LIMIT,
    },
    localities: {},
  };
}

function emptyLocalityState(loc) {
  return {
    clusterId: loc.clusterId,
    clusterLabel: loc.clusterLabel,
    localityId: loc.id,
    label: loc.label,
    bbox: loc.bbox,
    status: "pending", // pending -> in_progress -> complete | no_coverage
    wayCount: 0,
    samplePoints: null,
    nextSampleIndex: 0,
    duplicatesSkipped: 0,
    expansionsTriggered: 0,
    expansionsCompleted: [], // imageIds whose expansion burst fully finished — never redone
    apiRequestsUsed: 0,
    panoramasProcessed: 0,
    ocrCropsProcessed: 0,
    candidates: [], // includes both spatial-pass and expansion-pass candidates
  };
}

async function loadCheckpoint() {
  try {
    return JSON.parse(await readFile(CHECKPOINT_PATH, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") console.warn(`[hybrid] could not read checkpoint (${err.message}) — starting fresh.`);
    return emptyCheckpoint();
  }
}

async function saveCheckpoint(checkpoint) {
  checkpoint.updatedAt = new Date().toISOString();
  await mkdir(DATA_DIR, { recursive: true });
  const tmpPath = `${CHECKPOINT_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(checkpoint, null, 2));
  await rename(tmpPath, CHECKPOINT_PATH);
}

// ---- Panorama resolution + OCR (shared by spatial pass and expansion) --

async function resolveByPoint(point, registry) {
  const nearest = await loggedCall(() => getNearestImageId({ lat: point.lat, lon: point.lon }), { purpose: "nearestImageId" });
  const imageId = nearest.body?.payload;
  if (!nearest.ok || !imageId) return { outcome: "no_image_found", requestsSpent: 1 };
  if (hasImageId(registry, imageId)) return { outcome: "duplicate", imageId, requestsSpent: 1 };
  return resolveById(imageId, 1);
}

async function resolveById(imageId, requestsSoFar) {
  const meta = await loggedCall(() => getMetadata({ imageId }), { purpose: "metadata", panoramaId: imageId });
  if (!meta.ok || !meta.body?.payload) return { outcome: "metadata_failed", imageId, requestsSpent: requestsSoFar + 1 };
  const payload = meta.body.payload;

  const download = await loggedCall(() => fetchImageBytes(payload.imageUrl), { purpose: "imageDownload", panoramaId: imageId });
  if (!download.ok || !download.bytes) return { outcome: "download_failed", imageId, requestsSpent: requestsSoFar + 2 };

  return {
    outcome: "resolved",
    imageId,
    requestsSpent: requestsSoFar + 2,
    panorama: {
      provider: PROVIDER_NAME,
      sourceId: imageId,
      latitude: payload.lat,
      longitude: payload.lon,
      bearing: payload.bearing,
      links: payload.links ?? [],
      imageBytes: download.bytes,
    },
  };
}

async function ocrOnePanorama(pano, worker, cropsDir) {
  const candidates = [];
  let cropsProcessed = 0;
  const tileResults = await ocrPanorama({
    imageBytes: pano.imageBytes,
    worker,
    onTile: () => cropsProcessed++,
  });
  // Archive record of every OCR'd tile (text/confidence/bounds), not just
  // qualifying ones — deliberately no cropBuffer here (that's only ever
  // saved to disk for accepted candidates, as before); this is the gap
  // the migration report flagged ("per-tile OCR text for panoramas that
  // produced zero candidates" was never persisted pre-archive).
  const archiveTileResults = tileResults.map((t, i) => ({ tileIndex: i, tile: t.tile, text: t.text, confidence: t.confidence }));
  for (const [i, tileResult] of tileResults.entries()) {
    const extracted = extractAndScore(tileResult.text);
    if (extracted.score < CANDIDATE_SCORE_THRESHOLD) continue;
    if (!hasRentalSignal(extracted.signals)) continue;
    // Low-confidence fallback (offline-validated against every archived
    // tile available — see .data/low_confidence_fallback_test.json): a
    // tile below the confidence floor is still admitted, but only when its
    // OWN text carries an explicit TO_LET or FOR_RENT signal, not just a
    // generic RENT/BHK/phone match. This is what kept the one false
    // positive found in offline testing (a beauty-parlour/"Real Estate
    // Lease & Rent" shop sign) out while recovering 5 genuine boards a
    // hard floor=50 cutoff was dropping. Existing scoring/dedup below is
    // otherwise unchanged.
    if (tileResult.confidence < OCR_CONFIDENCE_FLOOR && !extracted.signals.some((s) => s === "TO_LET" || s === "FOR_RENT")) {
      continue;
    }

    const cropFileName = `${pano.sourceId}_tile${i}.jpg`;
    await writeFile(path.join(cropsDir, cropFileName), tileResult.cropBuffer);
    candidates.push({
      provider: pano.provider,
      sourceId: pano.sourceId,
      latitude: pano.latitude,
      longitude: pano.longitude,
      tile: tileResult.tile,
      ocrText: extracted.rawText,
      ocrConfidence: tileResult.confidence,
      ...extracted,
      belowFloorFallback: tileResult.confidence < OCR_CONFIDENCE_FLOOR,
      cropImage: `crops/${cropFileName}`,
    });
  }
  return { candidates, cropsProcessed, archiveTileResults };
}

// ---- Local BFS-style expansion (new, registry-aware, not crawlPanoramas) -

function withinExpansionRadius(origin, point) {
  return Math.abs(point.lat - origin.lat) <= EXPANSION_RADIUS_DEG && Math.abs(point.lon - origin.lon) <= EXPANSION_RADIUS_DEG;
}

// Starting from a panorama that just produced a genuine candidate, follows
// its `links` neighbour graph outward — the same idea as
// providers/ola/olaProvider.js's crawlPanoramas — but gated on the global
// registry at every step, and bounded to a small radius/panorama count
// instead of a whole locality's bbox/target.
async function expandLocally(triggerPanorama, registry, run, worker, cropsDir, state, localityKeyStr) {
  const origin = { lat: triggerPanorama.latitude, lon: triggerPanorama.longitude };
  const visited = new Set([triggerPanorama.sourceId]);
  const queue = [...(triggerPanorama.links ?? [])];
  let newPanoramas = 0;
  const foundCandidates = [];

  while (queue.length > 0 && newPanoramas < EXPANSION_MAX_NEW_PANORAMAS) {
    if (sessionTargetReached()) return { foundCandidates, quotaExceeded: false, targetReached: true };
    const imageId = queue.shift();
    if (visited.has(imageId)) continue;
    visited.add(imageId);

    if (hasImageId(registry, imageId)) {
      state.apiRequestsUsed += 0; // no request spent — registry hit, nothing looked up
      state.duplicatesSkipped += 1;
      continue;
    }

    const resolution = await resolveById(imageId, 0);
    state.apiRequestsUsed += resolution.requestsSpent;

    const quota = getQuotaStatus();
    if (quota.remaining <= 0) return { foundCandidates, quotaExceeded: true };

    if (resolution.outcome !== "resolved") continue;
    if (!withinExpansionRadius(origin, { lat: resolution.panorama.latitude, lon: resolution.panorama.longitude })) continue;

    recordImageId(registry, imageId, {
      latitude: resolution.panorama.latitude,
      longitude: resolution.panorama.longitude,
      source: "hybrid_expansion",
      locality: localityKeyStr,
      run,
    });
    newPanoramas += 1;
    state.panoramasProcessed += 1;

    const { candidates, cropsProcessed, archiveTileResults } = await ocrOnePanorama(resolution.panorama, worker, cropsDir);
    state.ocrCropsProcessed += cropsProcessed;
    for (const candidate of candidates) {
      recordBoardObservation(registry, candidate, { source: "hybrid_expansion", locality: localityKeyStr, run });
    }
    await archivePanorama(resolution.panorama, {
      tileResults: archiveTileResults,
      candidates,
      sourceTag: "hybrid_expansion",
      locality: localityKeyStr,
      requestTimestamp: new Date().toISOString(),
    });
    foundCandidates.push(...candidates);

    for (const link of resolution.panorama.links) if (!visited.has(link)) queue.push(link);
  }

  return { foundCandidates, quotaExceeded: false, targetReached: false };
}

// ---- Per-locality processing --------------------------------------------

async function ensureSamplePoints(state) {
  if (state.samplePoints !== null) return;
  const coverageRes = await loggedCall(() => getCoverage(state.bbox), { purpose: "coverage" });
  state.apiRequestsUsed += 1;
  state.wayCount = coverageRes.body?.payload?.ways?.length ?? 0;
  const points = sampleCoverage(coverageRes.body, { stepMeters: STEP_METERS, maxPoints: MAX_POINTS_PER_LOCALITY });
  state.samplePoints = points;
  state.status = points.length === 0 ? "no_coverage" : "in_progress";
}

async function processLocality(state, worker, checkpoint, registry, run) {
  const localityDir = path.join(DATA_DIR, state.clusterId, state.localityId);
  const cropsDir = path.join(localityDir, "crops");
  await mkdir(cropsDir, { recursive: true });

  await ensureSamplePoints(state);
  await saveCheckpoint(checkpoint);
  if (state.status === "no_coverage") {
    console.log(`[hybrid] ${state.clusterId}/${state.localityId}: no coverage (${state.wayCount} ways) — skipping`);
    return { quotaExceeded: false, targetReached: false };
  }

  const localityKeyStr = `${state.clusterId}/${state.localityId}`;
  console.log(
    `[hybrid] ${localityKeyStr}: ${state.wayCount} ways, ${state.samplePoints.length} sample points (step ${STEP_METERS}m), ` +
      `resuming from index ${state.nextSampleIndex}`
  );

  for (let i = state.nextSampleIndex; i < state.samplePoints.length; i++) {
    const point = state.samplePoints[i];
    let resolution;
    try {
      resolution = await resolveByPoint(point, registry);
      state.apiRequestsUsed += resolution.requestsSpent;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        state.nextSampleIndex = i;
        await saveCheckpoint(checkpoint);
        await saveRegistry(registry);
        await saveArchiveState();
        console.warn(`[hybrid] quota exceeded at point ${i}/${state.samplePoints.length} — checkpointed, stopping.`);
        return { quotaExceeded: true };
      }
      throw err;
    }

    if (resolution.outcome === "resolved") {
      recordImageId(registry, resolution.imageId, {
        latitude: resolution.panorama.latitude,
        longitude: resolution.panorama.longitude,
        source: "hybrid_spatial",
        locality: localityKeyStr,
        run,
      });
      state.panoramasProcessed += 1;
      const { candidates, cropsProcessed, archiveTileResults } = await ocrOnePanorama(resolution.panorama, worker, cropsDir);
      state.ocrCropsProcessed += cropsProcessed;
      state.candidates.push(...candidates);
      for (const candidate of candidates) {
        recordBoardObservation(registry, candidate, { source: "hybrid_spatial", locality: localityKeyStr, run });
      }
      await archivePanorama(resolution.panorama, {
        tileResults: archiveTileResults,
        candidates,
        sourceTag: "hybrid_spatial",
        locality: localityKeyStr,
        requestTimestamp: new Date().toISOString(),
      });

      const genuineHit = candidates.length > 0;
      const alreadyExpanded = state.expansionsCompleted.includes(resolution.imageId);
      if (genuineHit && !alreadyExpanded) {
        console.log(
          `[hybrid] ${localityKeyStr}: genuine candidate at point ${i} (${candidates.map((c) => c.phone).join(",")}) ` +
            `— expanding locally from ${resolution.imageId}`
        );
        state.expansionsTriggered += 1;
        const { foundCandidates, quotaExceeded, targetReached } = await expandLocally(
          resolution.panorama,
          registry,
          run,
          worker,
          cropsDir,
          state,
          localityKeyStr
        );
        state.candidates.push(...foundCandidates);
        if (foundCandidates.length > 0) {
          console.log(`[hybrid] ${localityKeyStr}: expansion around ${resolution.imageId} found ${foundCandidates.length} more candidate(s)`);
        }
        state.expansionsCompleted.push(resolution.imageId);
        if (quotaExceeded) {
          state.nextSampleIndex = i + 1;
          await saveCheckpoint(checkpoint);
          await saveRegistry(registry);
          await saveArchiveState();
          console.warn(`[hybrid] quota exceeded during expansion at point ${i} — checkpointed, stopping.`);
          return { quotaExceeded: true };
        }
        if (targetReached) {
          state.nextSampleIndex = i + 1;
          await saveCheckpoint(checkpoint);
          await saveRegistry(registry);
          await saveArchiveState();
          console.log(`[hybrid] session target of ${NEW_PANORAMA_TARGET} new panoramas reached during expansion at point ${i} — checkpointed, stopping.`);
          return { quotaExceeded: false, targetReached: true };
        }
      }
    } else if (resolution.outcome === "duplicate") {
      state.duplicatesSkipped += 1;
    }

    state.nextSampleIndex = i + 1;
    await saveCheckpoint(checkpoint);
    await saveRegistry(registry);
    await saveArchiveState();

    if (getQuotaStatus().remaining <= 0) {
      console.warn(`[hybrid] quota exhausted after point ${i} — stopping.`);
      return { quotaExceeded: true };
    }
    if (sessionTargetReached()) {
      console.log(`[hybrid] session target of ${NEW_PANORAMA_TARGET} new panoramas reached after point ${i} — stopping.`);
      return { quotaExceeded: false, targetReached: true };
    }
  }

  state.status = "complete";
  const boards = dedupeBoards(state.candidates);
  await writeFile(
    path.join(localityDir, "discovery_results.json"),
    JSON.stringify(
      {
        clusterId: state.clusterId,
        clusterLabel: state.clusterLabel,
        localityId: state.localityId,
        label: state.label,
        bbox: state.bbox,
        wayCount: state.wayCount,
        stepMeters: STEP_METERS,
        samplePointCount: state.samplePoints.length,
        expansionsTriggered: state.expansionsTriggered,
        apiRequestsUsed: state.apiRequestsUsed,
        panoramasProcessed: state.panoramasProcessed,
        duplicatesSkipped: state.duplicatesSkipped,
        ocrCropsProcessed: state.ocrCropsProcessed,
        candidateCount: state.candidates.length,
        uniqueBoardCount: boards.length,
        candidates: state.candidates,
        boards,
      },
      null,
      2
    )
  );
  console.log(
    `[hybrid] ${localityKeyStr}: complete — ${state.panoramasProcessed} panoramas, ${state.expansionsTriggered} expansions triggered, ` +
      `${state.candidates.length} candidates, ${boards.length} unique boards`
  );
  return { quotaExceeded: false, targetReached: false };
}

// ---- Main ----------------------------------------------------------------

async function main() {
  configureQuota(TOTAL_REQUEST_LIMIT);
  const checkpoint = await loadCheckpoint();
  checkpoint.config = {
    stepMeters: STEP_METERS,
    maxPointsPerLocality: MAX_POINTS_PER_LOCALITY,
    expansionRadiusDeg: EXPANSION_RADIUS_DEG,
    expansionMaxNew: EXPANSION_MAX_NEW_PANORAMAS,
    requestLimit: TOTAL_REQUEST_LIMIT,
  };
  const registry = await loadRegistry();
  const registryBefore = registryStats(registry);
  const run = `hybrid-${new Date().toISOString()}`;

  // Archive session setup — a fresh, real (non-migrated) session every
  // process run, per the "every crawl/test gets a unique immutable
  // session ID" requirement. Independent of `run` above (panoramaRegistry.js's
  // own dedup tag, unchanged) and of checkpoint.json's own resume state —
  // a resumed process still starts a new archive session, since it's
  // observably a new process execution with its own request ledger, even
  // though it resumes the same locality/point progress.
  archiveSessionId = generateSessionId("ola", "hybrid");
  archiveManifest = newManifest({
    provider: "ola",
    sessionId: archiveSessionId,
    strategy: "hybrid",
    geographicScope: TARGET_LOCALITIES.map(localityKey),
    configuration: { stepMeters: STEP_METERS, maxPointsPerLocality: MAX_POINTS_PER_LOCALITY, expansionRadiusDeg: EXPANSION_RADIUS_DEG, expansionMaxNew: EXPANSION_MAX_NEW_PANORAMAS, bboxHalfWidthDeg: BBOX_HALF_WIDTH_DEG },
    apiLimits: { crawlerRequestLimit: TOTAL_REQUEST_LIMIT },
  });
  archiveManifest.notes.push("estimatedCostUsd is always 0 — Ola's per-request $ pricing is not documented anywhere in this project and is not guessed.");
  archiveImageRegistry = await loadImageRegistry();
  archiveBoardRegistry = await loadBoardRegistry();
  archiveDedupRegistry = await loadDedupRegistry();
  await saveArchiveState();
  console.log(`[hybrid] archive session: ${archiveSessionId}`);

  console.log(`[hybrid] request limit: ${TOTAL_REQUEST_LIMIT} (shared, persistent quota)`);
  console.log(`[hybrid] step: ${STEP_METERS}m, max points/locality: ${MAX_POINTS_PER_LOCALITY}, expansion radius: ${EXPANSION_RADIUS_DEG}deg, expansion cap: ${EXPANSION_MAX_NEW_PANORAMAS}`);
  console.log(`[hybrid] OCR confidence floor: ${OCR_CONFIDENCE_FLOOR} (fallback: below-floor tiles admitted only with explicit TO_LET/FOR_RENT)`);
  console.log(`[hybrid] priority order: ${TARGET_LOCALITIES.map(localityKey).join(", ")}`);
  console.log(`[hybrid] quota before this run: ${getQuotaStatus().used}/${TOTAL_REQUEST_LIMIT}`);
  console.log(`[hybrid] registry before this run: ${registryBefore.imageIdCount} imageIds, ${registryBefore.boardCount} boards`);

  const worker = await createPaddleOcrWorker();
  let stoppedForQuota = false;
  let stoppedForTarget = false;

  try {
    for (const loc of TARGET_LOCALITIES) {
      const key = localityKey(loc);
      let state = checkpoint.localities[key];
      if (state?.status === "complete" || state?.status === "no_coverage") {
        console.log(`[hybrid] ${key}: already ${state.status} (resume) — skipping`);
        continue;
      }
      if (!state) {
        state = emptyLocalityState(loc);
        checkpoint.localities[key] = state;
      }
      if (getQuotaStatus().remaining <= 0) {
        console.warn(`[hybrid] quota exhausted before starting ${key} — stopping.`);
        stoppedForQuota = true;
        break;
      }
      if (sessionTargetReached()) {
        console.log(`[hybrid] session target of ${NEW_PANORAMA_TARGET} new panoramas reached before starting ${key} — stopping.`);
        stoppedForTarget = true;
        break;
      }

      const { quotaExceeded, targetReached } = await processLocality(state, worker, checkpoint, registry, run);
      await saveCheckpoint(checkpoint);
      await saveRegistry(registry);
      if (quotaExceeded) {
        stoppedForQuota = true;
        break;
      }
      if (targetReached) {
        stoppedForTarget = true;
        break;
      }
    }
  } finally {
    await worker.terminate();
  }

  const allStates = Object.values(checkpoint.localities);
  const registryAfter = registryStats(registry);
  const totals = {
    apiRequestsUsed: allStates.reduce((s, l) => s + l.apiRequestsUsed, 0),
    panoramasProcessed: allStates.reduce((s, l) => s + l.panoramasProcessed, 0),
    duplicatesSkipped: allStates.reduce((s, l) => s + l.duplicatesSkipped, 0),
    expansionsTriggered: allStates.reduce((s, l) => s + l.expansionsTriggered, 0),
    candidateCount: allStates.reduce((s, l) => s + l.candidates.length, 0),
    uniqueBoardCountThisRun: dedupeBoards(allStates.flatMap((l) => l.candidates)).length,
  };

  console.log("");
  console.log("=== Hybrid discovery pilot: summary ===");
  console.log(`stopped for quota: ${stoppedForQuota}`);
  console.log(`stopped for session target (${NEW_PANORAMA_TARGET} new panoramas): ${stoppedForTarget}`);
  console.log(`quota: ${getQuotaStatus().used}/${TOTAL_REQUEST_LIMIT}`);
  console.log(`session new panoramas this run: ${sessionNewPanoramaCount}`);
  console.log(`panoramas newly captured+OCR'd: ${totals.panoramasProcessed} (${totals.duplicatesSkipped} skipped as already-known)`);
  console.log(`expansions triggered: ${totals.expansionsTriggered}`);
  console.log(`candidates (this run): ${totals.candidateCount}, unique boards (this run): ${totals.uniqueBoardCountThisRun}`);
  console.log(`registry, all runs combined: ${registryBefore.imageIdCount} -> ${registryAfter.imageIdCount} imageIds, ${registryBefore.boardCount} -> ${registryAfter.boardCount} boards`);
  console.log(`checkpoint: ${CHECKPOINT_PATH}`);

  archiveManifest.uniqueBoardCount = totals.uniqueBoardCountThisRun;
  const sessionLedger = await readLedger("ola", archiveSessionId);
  archiveManifest.apiUsage.billableRequests = sessionLedger.filter((r) => r.billable).length;
  archiveManifest.apiUsage.nonBillableRequests = sessionLedger.filter((r) => !r.billable).length;
  for (const r of sessionLedger) archiveManifest.apiUsage.requestsBySource[r.purpose] = (archiveManifest.apiUsage.requestsBySource[r.purpose] ?? 0) + 1;
  finalizeManifest(archiveManifest, {
    stopReason: stoppedForQuota ? "quota_exceeded" : stoppedForTarget ? "session_target_reached" : "localities_exhausted",
  });
  await saveArchiveState();
  const costRegistry = await recomputeCostRegistry();
  console.log(`[hybrid] archive session finalized: ${archiveSessionId} (${archiveManifest.panoramaCount} panoramas archived, ${archiveManifest.candidateCount} candidates, ${archiveManifest.uniqueBoardCount} unique boards this session)`);
  console.log(`[hybrid] cost registry recomputed: ${costRegistry.sessionsIncluded} sessions tracked, $${costRegistry.total.estimatedCostUsd} total (Ola pricing unknown, always 0 — see manifest notes)`);
}

main().catch((err) => {
  console.error("[hybrid] failed:", err);
  process.exitCode = 1;
});
