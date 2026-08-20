// Isolated 50-panorama Google Street View Tiles vs. Ola comparison test.
// Session -> metadata -> tile fetch -> panorama reconstruction -> the
// *unmodified* OCR/scoring pipeline (ocrPipeline.js/rentalScoring.js/
// boardDedup.js — same functions, same thresholds, imported directly,
// not reimplemented), per the approved plan.
//
// Isolation, unchanged from the original spec: reads Ola's registry
// (panoramaRegistry.js) READ-ONLY for coordinate selection — never calls
// its save/record functions. Writes only into the new durable archive
// (.data/imagery/google/**, .data/imagery/registry/*.json) — never
// touches Ola's own pipeline, apiQuota.js, or Supabase.
//
// No checkpoint/resume: deliberately, this is a small, bounded, one-shot
// test (hard-capped at 50 points below), not an open-ended crawl — if it
// dies partway, rerunning starts a fresh session (a new immutable session
// ID) rather than resuming; the previous session's partial data is never
// overwritten, just left as its own honest record of what that attempt
// captured.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { loadRegistry, registryStats } from "./panoramaRegistry.js";
import { resolvePanoramaAtPoint, DEFAULT_ZOOM } from "./providers/google/googleProvider.js";
import { readImageDimensions } from "./providers/ola/olaClient.js";
import { ocrPanorama } from "./ocrPipeline.js";
import { createPaddleOcrWorker } from "./paddleOcrEngine.js";
import { extractAndScore, hasRentalSignal } from "./rentalScoring.js";
import { dedupeBoards } from "./boardDedup.js";
import { generateSessionId } from "./archive/sessionId.js";
import { newManifest, saveManifest, finalizeManifest } from "./archive/sessionManifest.js";
import { readLedger } from "./archive/requestLedger.js";
import { loadImageRegistry, saveImageRegistry, upsertImage } from "./archive/imageRegistry.js";
import { loadBoardRegistry, saveBoardRegistry, upsertBoardObservation } from "./archive/boardRegistry.js";
import { loadDedupRegistry, saveDedupRegistry, addRelationship } from "./archive/dedupRegistry.js";
import { recomputeCostRegistry } from "./archive/costRegistry.js";
import { panoramaDir, sessionDir } from "./archive/paths.js";

const MAX_COMPARISON_POINTS = 50;
const CANDIDATE_SCORE_THRESHOLD = 15; // matches discoveryPilotHybrid.js exactly
const OCR_CONFIDENCE_FLOOR = 50; // matches discoveryPilotHybrid.js exactly

// ---- Coordinate selection (reads Ola's registry; never writes it) ------

function boardRepresentativeObservation(board) {
  return [...board.observations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}

function selectComparisonPoints(registry) {
  const boards = Object.values(registry.seenBoards)
    .filter((b) => boardRepresentativeObservation(b))
    .sort((a, b) => new Date(a.firstSeenAt) - new Date(b.firstSeenAt));

  const points = [];
  const usedSourceIds = new Set();

  for (const board of boards) {
    if (points.length >= MAX_COMPARISON_POINTS) break;
    const obs = boardRepresentativeObservation(board);
    points.push({ type: "board_hit", olaBoardKey: board.key, olaSourceId: obs.sourceId, olaPhone: board.phone, latitude: obs.latitude, longitude: obs.longitude });
    usedSourceIds.add(obs.sourceId);
  }

  if (points.length < MAX_COMPARISON_POINTS) {
    const coverageEntries = Object.entries(registry.seenImageIds)
      .filter(([imageId]) => !usedSourceIds.has(imageId))
      .sort(([, a], [, b]) => new Date(a.firstSeenAt) - new Date(b.firstSeenAt));
    for (const [imageId, rec] of coverageEntries) {
      if (points.length >= MAX_COMPARISON_POINTS) break;
      points.push({ type: "coverage_only", olaBoardKey: null, olaSourceId: imageId, olaPhone: null, latitude: rec.latitude, longitude: rec.longitude });
    }
  }

  if (points.length > MAX_COMPARISON_POINTS) {
    throw new Error(`[googleComparisonTest] selected ${points.length} points, exceeds hard cap of ${MAX_COMPARISON_POINTS}`);
  }
  return points;
}

// ---- OCR (unmodified pipeline functions, default tiling) ---------------

async function ocrOnePanorama(pano, worker, cropsDir) {
  const candidates = [];
  const tileResults = await ocrPanorama({ imageBytes: pano.imageBytes, worker }); // default tileSize/overlap — same as Ola
  const archiveTileResults = tileResults.map((t, i) => ({ tileIndex: i, tile: t.tile, text: t.text, confidence: t.confidence }));

  for (const [i, tileResult] of tileResults.entries()) {
    if (tileResult.confidence < OCR_CONFIDENCE_FLOOR) continue;
    const extracted = extractAndScore(tileResult.text);
    if (extracted.score < CANDIDATE_SCORE_THRESHOLD) continue;
    if (!hasRentalSignal(extracted.signals)) continue;

    const cropFileName = `tile${i}.jpg`;
    await writeFile(path.join(cropsDir, cropFileName), tileResult.cropBuffer);
    candidates.push({
      provider: "google",
      sourceId: pano.panoId,
      latitude: pano.latitude,
      longitude: pano.longitude,
      tile: tileResult.tile,
      ocrText: extracted.rawText,
      ocrConfidence: tileResult.confidence,
      ...extracted,
      cropImage: `crops/${cropFileName}`,
    });
  }
  return { candidates, archiveTileResults };
}

// ---- Main ----------------------------------------------------------------

async function main() {
  const registry = await loadRegistry(); // read-only reference
  const registryStatsSnapshot = registryStats(registry);
  const points = selectComparisonPoints(registry);

  if (points.length === 0) {
    console.error("[googleComparisonTest] no comparison points available (empty Ola registry) — nothing to do.");
    return;
  }
  if (points.length > MAX_COMPARISON_POINTS) {
    throw new Error(`[googleComparisonTest] refusing to run: ${points.length} points exceeds hard cap of ${MAX_COMPARISON_POINTS}`);
  }

  const sessionId = generateSessionId("google", "tiles");
  const manifest = newManifest({
    provider: "google",
    sessionId,
    strategy: "tiles_comparison",
    geographicScope: [...new Set(points.map((p) => `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`))].slice(0, 5).concat(["..."]),
    configuration: { zoom: DEFAULT_ZOOM, fullPanorama: true, maxPoints: MAX_COMPARISON_POINTS, boardHitPoints: points.filter((p) => p.type === "board_hit").length, coverageOnlyPoints: points.filter((p) => p.type === "coverage_only").length },
    apiLimits: { maxPoints: MAX_COMPARISON_POINTS },
  });
  manifest.notes.push(
    "Coordinates reused from Ola's existing registry (read-only) — board-hit locations first, padded with coverage-only points. See comparison_coordinates.json in this session directory.",
    "estimatedCostUsd is always 0 — session/metadata calls are free; tile calls are within Google's published 100,000/month free allowance for this SKU (external-source pricing, not Google's own pricing table — see the archived plan)."
  );
  await saveManifest(manifest);
  await writeFile(path.join(sessionDir("google", sessionId), "comparison_coordinates.json"), JSON.stringify({ selectedAt: new Date().toISOString(), points }, null, 2));

  const imageRegistry = await loadImageRegistry();
  const boardRegistry = await loadBoardRegistry();
  const dedupRegistry = await loadDedupRegistry();

  console.log(`[googleComparisonTest] session: ${sessionId}`);
  console.log(`[googleComparisonTest] ${points.length} points (${manifest.configuration.boardHitPoints} board_hit, ${manifest.configuration.coverageOnlyPoints} coverage_only), zoom ${DEFAULT_ZOOM}, full panorama`);
  console.log(`[googleComparisonTest] Ola registry (read-only reference): ${registryStatsSnapshot.imageIdCount} imageIds, ${registryStatsSnapshot.boardCount} boards`);

  const worker = await createPaddleOcrWorker();
  const pointResults = [];
  const allCandidates = [];

  try {
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      console.log(`[googleComparisonTest] (${i + 1}/${points.length}) [${point.type}] resolving ${point.latitude}, ${point.longitude}`);

      let resolution;
      try {
        resolution = await resolvePanoramaAtPoint({ lat: point.latitude, lon: point.longitude }, { archiveSessionId: sessionId });
      } catch (err) {
        console.warn(`[googleComparisonTest] point ${i} failed: ${err.message}`);
        manifest.errors.push({ pointIndex: i, message: err.message, at: new Date().toISOString() });
        pointResults.push({ index: i, type: point.type, olaBoardKey: point.olaBoardKey, olaSourceId: point.olaSourceId, olaPhone: point.olaPhone, requestedLatitude: point.latitude, requestedLongitude: point.longitude, outcome: "error", error: err.message, candidates: [] });
        continue;
      }

      const pointResult = {
        index: i,
        type: point.type,
        olaBoardKey: point.olaBoardKey,
        olaSourceId: point.olaSourceId,
        olaPhone: point.olaPhone,
        requestedLatitude: point.latitude,
        requestedLongitude: point.longitude,
        outcome: resolution.outcome,
        candidates: [],
      };

      if (resolution.outcome === "resolved") {
        pointResult.panoId = resolution.panoId;
        pointResult.resolvedLatitude = resolution.latitude;
        pointResult.resolvedLongitude = resolution.longitude;
        pointResult.captureDate = resolution.captureDate;
        pointResult.reconstruction = resolution.reconstruction;

        const dir = panoramaDir("google", sessionId, resolution.panoId);
        const cropsDir = path.join(dir, "crops");
        await mkdir(cropsDir, { recursive: true });

        const { candidates, archiveTileResults } = await ocrOnePanorama(resolution, worker, cropsDir);
        pointResult.tileConfidences = archiveTileResults.map((t) => t.confidence);
        pointResult.candidates = candidates;
        allCandidates.push(...candidates);

        const fileHash = createHash("sha256").update(resolution.imageBytes).digest("hex");
        const dims = readImageDimensions(resolution.imageBytes);
        await writeFile(path.join(dir, "panorama.jpg"), resolution.imageBytes);
        await writeFile(path.join(dir, "metadata.json"), JSON.stringify({ latitude: resolution.latitude, longitude: resolution.longitude, captureDate: resolution.captureDate, panoId: resolution.panoId, reconstruction: resolution.reconstruction }, null, 2));
        await writeFile(path.join(dir, "source.json"), JSON.stringify({ provider: "google", sourceId: resolution.panoId, sessionId, pointType: point.type, requestTimestamp: new Date().toISOString(), sourceEndpoint: "/v1/streetview/metadata" }, null, 2));
        await writeFile(path.join(dir, "ocr.json"), JSON.stringify(archiveTileResults, null, 2));
        await writeFile(path.join(dir, "detections.json"), JSON.stringify(candidates, null, 2));

        upsertImage(imageRegistry, {
          provider: "google",
          sourceId: resolution.panoId,
          latitude: resolution.latitude,
          longitude: resolution.longitude,
          captureDate: resolution.captureDate,
          metadataResponse: null,
          sourceEndpoint: "/v1/streetview/metadata",
          requestTimestamp: new Date().toISOString(),
          imageWidth: dims?.width ?? resolution.reconstruction.cols * 512,
          imageHeight: dims?.height ?? resolution.reconstruction.rows * 512,
          fileHash,
          sessionId,
          apiRequestId: null,
          ocrOutputRef: path.join(dir, "ocr.json"),
          detectionOutputRef: candidates.length ? path.join(dir, "detections.json") : null,
          rawImageAvailable: true,
          rawImagePath: path.join(dir, "panorama.jpg"),
          physicalLocationId: null,
        });

        for (const candidate of candidates) {
          const context = { sessionId, source: "google_tiles_comparison", locality: null, run: sessionId };
          const { isNewBoard, key } = upsertBoardObservation(boardRegistry, candidate, context);
          if (!isNewBoard) {
            const firstObs = boardRegistry.boards[key].observations[0];
            if (firstObs.sourceId !== candidate.sourceId || firstObs.provider !== candidate.provider) {
              addRelationship(dedupRegistry, {
                type: "same_physical_board",
                subject: { provider: candidate.provider, sourceId: candidate.sourceId },
                related: { provider: firstObs.provider, sourceId: firstObs.sourceId },
                method: candidate.phone ? "phone_match" : "coordinate_proximity",
                confidence: candidate.phone ? "high" : "medium",
                notes: firstObs.provider !== candidate.provider ? "cross-provider match" : "same-provider re-observation",
              });
            }
          }
        }

        manifest.panoramaCount += 1;
        manifest.tileCount += resolution.reconstruction.tilesSucceeded;
        manifest.ocrCount += archiveTileResults.length;
        manifest.candidateCount += candidates.length;
      }

      pointResults.push(pointResult);
      await saveManifest(manifest);
      await saveImageRegistry(imageRegistry);
      await saveBoardRegistry(boardRegistry);
      await saveDedupRegistry(dedupRegistry);
    }
  } finally {
    await worker.terminate();
  }

  const boards = dedupeBoards(allCandidates);
  manifest.uniqueBoardCount = boards.length;
  const ledger = await readLedger("google", sessionId);
  manifest.apiUsage.billableRequests = ledger.filter((r) => r.billable).length;
  manifest.apiUsage.nonBillableRequests = ledger.filter((r) => !r.billable).length;
  for (const r of ledger) manifest.apiUsage.requestsBySource[r.purpose] = (manifest.apiUsage.requestsBySource[r.purpose] ?? 0) + 1;
  finalizeManifest(manifest, { stopReason: "points_exhausted" });
  await saveManifest(manifest);
  const costRegistry = await recomputeCostRegistry();

  await writeFile(
    path.join(sessionDir("google", sessionId), "discovery_results.json"),
    JSON.stringify({ summary: { totalPoints: points.length, resolvedPoints: pointResults.filter((r) => r.outcome === "resolved").length, noCoveragePoints: pointResults.filter((r) => r.outcome === "no_coverage").length, metadataFailedPoints: pointResults.filter((r) => r.outcome === "metadata_failed").length, errorPoints: pointResults.filter((r) => r.outcome === "error").length, candidateCount: allCandidates.length, uniqueBoardCount: boards.length, apiUsage: manifest.apiUsage }, pointResults, candidates: allCandidates, boards }, null, 2)
  );

  console.log("");
  console.log("=== Google Tiles comparison test: summary ===");
  console.log(`points: ${points.length} resolved: ${pointResults.filter((r) => r.outcome === "resolved").length}`);
  console.log(`panoramas archived: ${manifest.panoramaCount}, tiles fetched: ${manifest.tileCount}, OCR tiles: ${manifest.ocrCount}`);
  console.log(`candidates: ${allCandidates.length}, unique boards: ${boards.length}`);
  console.log(`api calls (billable/non-billable): ${manifest.apiUsage.billableRequests}/${manifest.apiUsage.nonBillableRequests}, $${costRegistry.total.estimatedCostUsd}`);
  console.log(`session: ${sessionDir("google", sessionId)}`);
  console.log("Run src/compareProviders.js next to generate the Google-vs-Ola comparison report.");
}

main().catch((err) => {
  console.error("[googleComparisonTest] failed:", err);
  process.exitCode = 1;
});
