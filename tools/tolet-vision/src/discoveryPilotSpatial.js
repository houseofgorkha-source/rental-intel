// Spatial-sampling discovery strategy — an alternative to the BFS
// link-following crawler (discoveryPilot.js / discoveryPilotClusters.js /
// providers/ola/olaProvider.js), which this file does not modify, import
// for its crawl logic, or otherwise touch.
//
// Pipeline: locality bbox -> /coverage -> real street geometry ->
// spatially distributed sampling (spatialSampler.js) -> nearestImageId per
// sample point -> dedupe on the resolved imageId -> the same unchanged
// OCR/score/dedupe pipeline (ocrPipeline.js, paddleOcrEngine.js,
// rentalScoring.js, boardDedup.js).
//
// Rationale (from the conversation this was built in): the BFS crawler's
// panorama-per-locality logs show tight coordinate clustering near each
// seed, because the queue explores nearby link branches before wandering
// far. Sampling the actual street geometry at a fixed step instead spreads
// requests evenly across the whole covered network in a bbox, proportional
// to street length — the tradeoff is that each sample point costs its own
// nearestImageId lookup (no free `links` shortcut), so this strategy is
// deliberately aimed at localities *already known* to be productive
// (Ejipura/Koramangala/ITPL/Hoodi, per the BFS pilot's own results), not a
// blind re-scan of everywhere the BFS run already covered.
//
// Resume/checkpoint: every sample point processed is written to
// .data/pilot/spatial/checkpoint.json immediately — completed localities,
// each locality's full sample-point list (computed once, persisted, never
// recomputed), the resume index into that list, every imageId already
// resolved, and results accumulated so far. A killed process loses at most
// the one in-flight point; rerunning the script picks up exactly where it
// left off rather than re-crawling anything.
//
// Cross-run dedup: before paying for metadata+download (the expensive
// part) for a sample point's resolved imageId, this checks
// panoramaRegistry.js's persistent registry — populated from every prior
// BFS run via inventoryExistingRuns.js, and updated by this script itself
// as it goes. That registry is also the single dedupe mechanism for
// imageIds discovered *within* this run (a later sample point resolving to
// an imageId this run already recorded a moment ago is skipped the same
// way as one the BFS crawl found weeks ago) — one check, one source of
// truth, rather than a separate in-run Set duplicating the same logic.
// Board-level dedup (boardDedup.js's own key, phone or coordinate bucket)
// is intentionally a *different* registry (seenBoards) — a panorama being
// already-known says nothing about whether a board was ever found there.
//
// IMPORTANT — do not run this concurrently with a live BFS crawl. Both
// scripts share apiQuota.js's persisted quota_state.json, which has no
// cross-process locking (read-modify-write per request); running two
// processes against it at once risks a lost-update race. Run this only
// after any other crawl using this tool has finished or been stopped.
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { configureQuota, getQuotaStatus, QuotaExceededError } from "./apiQuota.js";
import { getCoverage, getNearestImageId, getMetadata, fetchImageBytes } from "./providers/ola/olaClient.js";
import { sampleCoverage } from "./spatialSampler.js";
import { ocrPanorama } from "./ocrPipeline.js";
import { createPaddleOcrWorker } from "./paddleOcrEngine.js";
import { extractAndScore, hasRentalSignal } from "./rentalScoring.js";
import { dedupeBoards } from "./boardDedup.js";
import {
  loadRegistry,
  saveRegistry,
  hasImageId,
  getImageRecord,
  recordImageId,
  recordBoardObservation,
  registryStats,
} from "./panoramaRegistry.js";

const PROVIDER_NAME = "ola";
const CANDIDATE_SCORE_THRESHOLD = 15;
const OCR_CONFIDENCE_FLOOR = 50;

const TOTAL_REQUEST_LIMIT = Number(process.env.OLA_API_REQUEST_LIMIT) || 8000;
const STEP_METERS = Number(process.env.SPATIAL_STEP_METERS) || 70;
const MAX_POINTS_PER_LOCALITY = Number(process.env.SPATIAL_MAX_POINTS_PER_LOCALITY) || 220;

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data", "pilot", "spatial");
const CHECKPOINT_PATH = path.join(DATA_DIR, "checkpoint.json");

// Default target set: the four localities the BFS pilot already showed to
// be productive (Ejipura 49.2 boards/1000 panoramas, ITPL 29.0, Koramangala
// 24.0, Hoodi 21.7 — the other 17 localities crawled either found zero
// boards or had near-empty street coverage to begin with). Same bbox
// centers as discoveryPilotClusters.js, for a fair before/after comparison
// on identical ground. Not a hardcoded limitation of the pipeline itself —
// any {id, label, clusterId, clusterLabel, bbox} list works.
const BBOX_HALF_WIDTH_DEG = 0.008;
function bboxAround(centerLat, centerLon) {
  return {
    xMin: centerLon - BBOX_HALF_WIDTH_DEG,
    xMax: centerLon + BBOX_HALF_WIDTH_DEG,
    yMin: centerLat - BBOX_HALF_WIDTH_DEG,
    yMax: centerLat + BBOX_HALF_WIDTH_DEG,
  };
}

const TARGET_LOCALITIES = [
  { id: "ejipura", label: "Ejipura", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9422, 77.6296) },
  { id: "koramangala", label: "Koramangala", clusterId: "koramangala", clusterLabel: "Koramangala", bbox: bboxAround(12.9352, 77.6245) },
  { id: "itpl", label: "ITPL", clusterId: "whitefield", clusterLabel: "Whitefield", bbox: bboxAround(12.986, 77.7378) },
  { id: "hoodi", label: "Hoodi", clusterId: "whitefield", clusterLabel: "Whitefield", bbox: bboxAround(12.9931, 77.7139) },
];

function localityKey(loc) {
  return `${loc.clusterId}/${loc.id}`;
}

// ---- Checkpoint persistence -------------------------------------------

function emptyCheckpoint() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    config: { stepMeters: STEP_METERS, maxPointsPerLocality: MAX_POINTS_PER_LOCALITY, requestLimit: TOTAL_REQUEST_LIMIT },
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
    samplePoints: null, // computed once, then persisted verbatim
    nextSampleIndex: 0,
    duplicatesSkipped: 0, // sample points that resolved to an already-known imageId (registry hit)
    apiRequestsUsed: 0,
    panoramasProcessed: 0,
    ocrCropsProcessed: 0,
    candidates: [],
  };
}

async function loadCheckpoint() {
  try {
    const raw = await readFile(CHECKPOINT_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn(`[spatial] could not read existing checkpoint (${err.message}) — starting fresh.`);
    }
    return emptyCheckpoint();
  }
}

async function saveCheckpoint(checkpoint) {
  checkpoint.updatedAt = new Date().toISOString();
  await mkdir(DATA_DIR, { recursive: true });
  // Write to a temp file then rename — a process killed mid-write must
  // never leave checkpoint.json truncated/corrupt, since every future
  // resume depends on being able to parse it.
  const tmpPath = `${CHECKPOINT_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(checkpoint, null, 2));
  await import("node:fs/promises").then((fs) => fs.rename(tmpPath, CHECKPOINT_PATH));
}

// ---- Panorama resolution (spatial-sampling specific, not BFS) ---------

// Resolves the nearest real panorama to a sampled point. Unlike
// olaProvider.js's crawlPanoramas, this never follows `links` — each call
// is an independent nearestImageId lookup, and the only "graph" here is
// the sample-point list computed up front from /coverage geometry.
//
// registry is consulted (not a local Set) immediately after the
// nearestImageId lookup, before metadata+download: if this imageId is
// already known — from a prior BFS run, an earlier locality in this same
// run, or an earlier point in this same locality — the expensive calls
// and the OCR pass are skipped entirely.
async function resolvePanoramaAtPoint(point, registry) {
  const nearest = await getNearestImageId({ lat: point.lat, lon: point.lon });
  const imageId = nearest.body?.payload;
  if (!nearest.ok || !imageId) return { outcome: "no_image_found" };
  if (hasImageId(registry, imageId)) {
    return { outcome: "duplicate", imageId, existing: getImageRecord(registry, imageId) };
  }

  const meta = await getMetadata({ imageId });
  if (!meta.ok || !meta.body?.payload) return { outcome: "metadata_failed", imageId };
  const payload = meta.body.payload;

  const download = await fetchImageBytes(payload.imageUrl);
  if (!download.ok || !download.bytes) return { outcome: "download_failed", imageId };

  return {
    outcome: "resolved",
    imageId,
    panorama: {
      provider: PROVIDER_NAME,
      sourceId: imageId,
      latitude: payload.lat,
      longitude: payload.lon,
      bearing: payload.bearing,
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
    onTile: () => {
      cropsProcessed++;
    },
  });
  for (const [i, tileResult] of tileResults.entries()) {
    if (tileResult.confidence < OCR_CONFIDENCE_FLOOR) continue;
    const extracted = extractAndScore(tileResult.text);
    if (extracted.score < CANDIDATE_SCORE_THRESHOLD) continue;
    if (!hasRentalSignal(extracted.signals)) continue;

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
      cropImage: `crops/${cropFileName}`,
    });
  }
  return { candidates, cropsProcessed };
}

// ---- Per-locality processing -------------------------------------------

async function ensureSamplePoints(state) {
  if (state.samplePoints !== null) return; // already computed (resume case)

  const coverageRes = await getCoverage(state.bbox);
  state.apiRequestsUsed += 1;
  const wayCount = coverageRes.body?.payload?.ways?.length ?? 0;
  state.wayCount = wayCount;

  const points = sampleCoverage(coverageRes.body, { stepMeters: STEP_METERS, maxPoints: MAX_POINTS_PER_LOCALITY });
  state.samplePoints = points;
  if (points.length === 0) state.status = "no_coverage";
  else state.status = "in_progress";
}

async function processLocality(state, worker, checkpoint, registry, run) {
  const localityDir = path.join(DATA_DIR, state.clusterId, state.localityId);
  const cropsDir = path.join(localityDir, "crops");
  await mkdir(cropsDir, { recursive: true });

  await ensureSamplePoints(state);
  await saveCheckpoint(checkpoint);
  if (state.status === "no_coverage") {
    console.log(`[spatial] ${state.clusterId}/${state.localityId}: no coverage (${state.wayCount} ways) — skipping`);
    return { quotaExceeded: false };
  }

  console.log(
    `[spatial] ${state.clusterId}/${state.localityId}: ${state.wayCount} ways, ${state.samplePoints.length} sample points ` +
      `(step ${STEP_METERS}m), resuming from index ${state.nextSampleIndex}`
  );

  const localityKeyStr = `${state.clusterId}/${state.localityId}`;

  for (let i = state.nextSampleIndex; i < state.samplePoints.length; i++) {
    const point = state.samplePoints[i];
    let resolution;
    try {
      resolution = await resolvePanoramaAtPoint(point, registry);
      state.apiRequestsUsed += resolution.outcome === "duplicate" ? 1 : resolution.outcome === "no_image_found" ? 1 : resolution.outcome === "metadata_failed" ? 2 : 3;
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        state.nextSampleIndex = i;
        await saveCheckpoint(checkpoint);
        await saveRegistry(registry);
        console.warn(`[spatial] quota exceeded mid-locality at point ${i}/${state.samplePoints.length} — checkpointed, stopping.`);
        return { quotaExceeded: true };
      }
      throw err;
    }

    if (resolution.outcome === "resolved") {
      recordImageId(registry, resolution.imageId, {
        latitude: resolution.panorama.latitude,
        longitude: resolution.panorama.longitude,
        source: "spatial",
        locality: localityKeyStr,
        run,
      });
      state.panoramasProcessed += 1;
      const { candidates, cropsProcessed } = await ocrOnePanorama(resolution.panorama, worker, cropsDir);
      state.ocrCropsProcessed += cropsProcessed;
      state.candidates.push(...candidates);
      for (const candidate of candidates) {
        recordBoardObservation(registry, candidate, { source: "spatial", locality: localityKeyStr, run });
      }
      if (candidates.length > 0) {
        console.log(
          `[spatial] ${localityKeyStr}: candidate at point ${i} — ` +
            candidates.map((c) => `score=${c.score} phone=${c.phone}`).join("; ")
        );
      }
    } else if (resolution.outcome === "duplicate") {
      // Same physical panorama the registry already knew about — either
      // from a prior BFS run or an earlier point in this run — already
      // OCR'd, nothing further to do. Counted in apiRequestsUsed above
      // (the nearestImageId lookup still cost a request) but not
      // re-downloaded, re-OCR'd, or re-recorded.
      state.duplicatesSkipped += 1;
    }

    state.nextSampleIndex = i + 1;
    await saveCheckpoint(checkpoint);
    await saveRegistry(registry);

    const quota = getQuotaStatus();
    if (quota.remaining <= 0) {
      console.warn(`[spatial] quota exhausted (${quota.used}/${TOTAL_REQUEST_LIMIT}) after point ${i} — stopping.`);
      return { quotaExceeded: true };
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
    `[spatial] ${state.clusterId}/${state.localityId}: complete — ${state.panoramasProcessed} panoramas ` +
      `(${state.duplicatesSkipped} already-known duplicates skipped), ${state.candidates.length} candidates, ${boards.length} unique boards`
  );
  return { quotaExceeded: false };
}

// ---- Main ----------------------------------------------------------------

async function main() {
  configureQuota(TOTAL_REQUEST_LIMIT);
  const checkpoint = await loadCheckpoint();
  checkpoint.config = { stepMeters: STEP_METERS, maxPointsPerLocality: MAX_POINTS_PER_LOCALITY, requestLimit: TOTAL_REQUEST_LIMIT };
  const registry = await loadRegistry();
  const registryBefore = registryStats(registry);
  const run = `spatial-${new Date().toISOString()}`;

  console.log(`[spatial] request limit: ${TOTAL_REQUEST_LIMIT} (shared, persistent quota — same ledger as the BFS crawler)`);
  console.log(`[spatial] step: ${STEP_METERS}m, max points/locality: ${MAX_POINTS_PER_LOCALITY}`);
  console.log(`[spatial] target localities: ${TARGET_LOCALITIES.map(localityKey).join(", ")}`);
  console.log(`[spatial] quota before this run: ${getQuotaStatus().used}/${TOTAL_REQUEST_LIMIT}`);
  console.log(`[spatial] registry before this run: ${registryBefore.imageIdCount} known imageIds, ${registryBefore.boardCount} known boards`);

  const worker = await createPaddleOcrWorker();
  let stoppedForQuota = false;

  try {
    for (const loc of TARGET_LOCALITIES) {
      const key = localityKey(loc);
      let state = checkpoint.localities[key];
      if (state?.status === "complete" || state?.status === "no_coverage") {
        console.log(`[spatial] ${key}: already ${state.status} (resume) — skipping`);
        continue;
      }
      if (!state) {
        state = emptyLocalityState(loc);
        checkpoint.localities[key] = state;
      }

      if (getQuotaStatus().remaining <= 0) {
        console.warn(`[spatial] quota exhausted before starting ${key} — stopping.`);
        stoppedForQuota = true;
        break;
      }

      const { quotaExceeded } = await processLocality(state, worker, checkpoint, registry, run);
      await saveCheckpoint(checkpoint);
      await saveRegistry(registry);
      if (quotaExceeded) {
        stoppedForQuota = true;
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
    duplicatesSkipped: allStates.reduce((s, l) => s + (l.duplicatesSkipped ?? 0), 0),
    ocrCropsProcessed: allStates.reduce((s, l) => s + l.ocrCropsProcessed, 0),
    candidateCount: allStates.reduce((s, l) => s + l.candidates.length, 0),
    // This run's own unique boards (local view) vs. the registry's
    // all-time count are reported separately on purpose — summing them
    // would double-count anything this run found that a prior BFS run had
    // already found too.
    uniqueBoardCountThisRun: dedupeBoards(allStates.flatMap((l) => l.candidates)).length,
  };

  console.log("");
  console.log("=== Spatial-sampling pilot: summary ===");
  console.log(`stopped for quota: ${stoppedForQuota}`);
  console.log(`quota: ${getQuotaStatus().used}/${TOTAL_REQUEST_LIMIT}`);
  console.log(`panoramas newly captured+OCR'd: ${totals.panoramasProcessed} (${totals.duplicatesSkipped} sample points hit an already-known imageId and were skipped)`);
  console.log(`OCR crops: ${totals.ocrCropsProcessed}`);
  console.log(`candidates (this run): ${totals.candidateCount}, unique boards (this run): ${totals.uniqueBoardCountThisRun}`);
  console.log(`registry, all runs combined: ${registryBefore.imageIdCount} -> ${registryAfter.imageIdCount} imageIds, ${registryBefore.boardCount} -> ${registryAfter.boardCount} boards`);
  console.log(`checkpoint: ${CHECKPOINT_PATH}`);
}

main().catch((err) => {
  console.error("[spatial] failed:", err);
  process.exitCode = 1;
});
