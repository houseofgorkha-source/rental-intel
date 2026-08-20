// 3-area Bangalore pilot: runs the unchanged discovery pipeline (crawl ->
// GPU PaddleOCR -> score/extract -> dedupe) once per small bounded area, so
// results across a high-rental residential pocket, a dense/commercial
// strip, and a quiet residential lane can be compared side by side.
//
// Reuses every existing module as-is (imageryProvider, ocrPipeline,
// paddleOcrEngine, rentalScoring, boardDedup, apiQuota) — this file only
// adds the "loop over N small areas + report" orchestration that
// discoveryPilot.js doesn't have. discoveryPilot.js itself is untouched.
//
// Quota is the same persistent, source-aware budget as every other script
// in this tool (apiQuota.js) — it is NOT reset per area. All three areas
// draw from one shared monthly crawler limit, and the hard-stop
// (QuotaExceededError -> stoppedReason: "quota_exceeded") applies exactly
// as it does for a single-area run; if area 2 exhausts the budget, area 3
// still runs but will crawl 0 panoramas and report that honestly.
//
// No RentalIntel/Supabase integration — local JSON + images under
// .data/pilot/<areaId>/ only, matching discoveryPilot.js's own scope.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { configureQuota, getQuotaStatus } from "./apiQuota.js";
import { getProvider } from "./imageryProvider.js";
import { ocrPanorama } from "./ocrPipeline.js";
import { withPaddleOcrWorker } from "./paddleOcrEngine.js";
import { extractAndScore, hasRentalSignal } from "./rentalScoring.js";
import { dedupeBoards } from "./boardDedup.js";

const PROVIDER_NAME = "ola";
const CANDIDATE_SCORE_THRESHOLD = 15;
const OCR_CONFIDENCE_FLOOR = 50;

// Deliberately small: ~15 panoramas/area targeted, bboxes ~0.6-0.9km across.
// Not a city scan — three small, bounded pockets chosen to contrast area
// character, per instruction.
const TARGET_PANORAMA_COUNT = Number(process.env.PILOT_PANORAMA_TARGET) || 15;

// Total crawler budget shared across all 3 areas this run (persistent
// across process runs too, per apiQuota.js). Kept deliberately tight —
// enough for ~15 panoramas/area at the ~2.3 requests/panorama ratio
// observed in a smoke test (~35/area, ~105 total), with headroom, not a
// large scan.
const TOTAL_REQUEST_LIMIT = Number(process.env.OLA_API_REQUEST_LIMIT) || 180;

const AREAS = [
  {
    id: "koramangala-5th-block",
    label: "High-rental residential — Koramangala 5th Block",
    seed: { seedLat: 12.9352, seedLon: 77.6245 },
    bbox: { xMin: 77.6205, xMax: 77.6285, yMin: 12.9312, yMax: 12.9392 },
  },
  {
    id: "indiranagar-100ft-road",
    label: "Dense/commercial — Indiranagar 100 Feet Road",
    seed: { seedLat: 12.9784, seedLon: 77.6408 },
    bbox: { xMin: 77.6368, xMax: 77.6448, yMin: 12.9744, yMax: 12.9824 },
  },
  {
    id: "sadashivanagar",
    label: "Quiet residential — Sadashivanagar",
    seed: { seedLat: 13.006, seedLon: 77.582 },
    bbox: { xMin: 77.578, xMax: 77.586, yMin: 13.002, yMax: 13.01 },
  },
];

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data", "pilot");

function bboxAreaKm2(bbox) {
  // Flat-earth approx, fine at this scale (~1km boxes near the equator-ish
  // latitude of Bangalore, ~13N): 1 deg lat ~= 111.0 km, 1 deg lon ~=
  // 111.0 * cos(lat) km.
  const midLat = (bbox.yMin + bbox.yMax) / 2;
  const kmPerDegLat = 111.0;
  const kmPerDegLon = 111.0 * Math.cos((midLat * Math.PI) / 180);
  const heightKm = (bbox.yMax - bbox.yMin) * kmPerDegLat;
  const widthKm = (bbox.xMax - bbox.xMin) * kmPerDegLon;
  return heightKm * widthKm;
}

async function runArea(area) {
  const startedAt = Date.now();
  const areaDir = path.join(DATA_DIR, area.id);
  const cropsDir = path.join(areaDir, "crops");
  await mkdir(cropsDir, { recursive: true });

  console.log("");
  console.log(`=== [${area.id}] ${area.label} ===`);
  console.log(`[${area.id}] bbox: ${JSON.stringify(area.bbox)}`);
  const quotaBefore = getQuotaStatus();
  console.log(`[${area.id}] quota before: ${quotaBefore.used}/${quotaBefore.limit}`);

  const { crawlPanoramas } = getProvider(PROVIDER_NAME);
  const { panoramas, stats: crawlStats, stoppedReason } = await crawlPanoramas({
    ...area.seed,
    targetCount: TARGET_PANORAMA_COUNT,
    bbox: area.bbox,
  });
  console.log(
    `[${area.id}] crawl stopped: ${stoppedReason} — ${panoramas.length} panoramas, ` +
      `${crawlStats.requestsMade} requests, ${crawlStats.skippedOutsideBbox} skipped outside bbox`
  );

  const candidates = [];
  let cropsProcessed = 0;

  await withPaddleOcrWorker(async (worker) => {
    for (const pano of panoramas) {
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
        console.log(
          `[${area.id}] candidate: ${pano.sourceId} score=${extracted.score} ` +
            `signals=[${extracted.signals.join(",")}] phone=${extracted.phone}`
        );
      }
    }
  });

  const boards = dedupeBoards(candidates);
  const runtimeSeconds = (Date.now() - startedAt) / 1000;
  const quotaAfter = getQuotaStatus();
  const requestsUsedThisArea = quotaAfter.used - quotaBefore.used;
  const areaKm2 = bboxAreaKm2(area.bbox);

  const result = {
    areaId: area.id,
    label: area.label,
    generatedAt: new Date().toISOString(),
    bbox: area.bbox,
    seed: area.seed,
    areaKm2,
    stoppedReason,
    apiRequestsUsedThisArea: requestsUsedThisArea,
    apiRequestsUsedCumulative: quotaAfter.used,
    apiRequestLimit: quotaAfter.limit,
    panoramasProcessed: panoramas.length,
    ocrCropsProcessed: cropsProcessed,
    candidateCount: candidates.length,
    uniqueBoardCount: boards.length,
    boardsPerKm2: areaKm2 > 0 ? boards.length / areaKm2 : null,
    runtimeSeconds,
    candidates,
    boards,
  };

  const outPath = path.join(areaDir, "discovery_results.json");
  await writeFile(outPath, JSON.stringify(result, null, 2));

  return result;
}

async function main() {
  const runStartedAt = Date.now();
  configureQuota(TOTAL_REQUEST_LIMIT);
  console.log(`[pilot] shared API request limit (this + prior runs this month): ${TOTAL_REQUEST_LIMIT}`);
  console.log(`[pilot] target panoramas per area: ${TARGET_PANORAMA_COUNT}`);
  console.log(`[pilot] areas: ${AREAS.map((a) => a.id).join(", ")}`);

  await mkdir(DATA_DIR, { recursive: true });

  const results = [];
  for (const area of AREAS) {
    results.push(await runArea(area));
  }

  const totalRuntimeSeconds = (Date.now() - runStartedAt) / 1000;
  const finalQuota = getQuotaStatus();

  const summary = {
    generatedAt: new Date().toISOString(),
    requestLimit: TOTAL_REQUEST_LIMIT,
    apiRequestsUsedFinal: finalQuota.used,
    apiRequestsRemaining: finalQuota.remaining,
    totalRuntimeSeconds,
    areas: results.map((r) => ({
      areaId: r.areaId,
      label: r.label,
      stoppedReason: r.stoppedReason,
      apiRequestsUsedThisArea: r.apiRequestsUsedThisArea,
      panoramasProcessed: r.panoramasProcessed,
      ocrCropsProcessed: r.ocrCropsProcessed,
      candidateCount: r.candidateCount,
      uniqueBoardCount: r.uniqueBoardCount,
      areaKm2: r.areaKm2,
      boardsPerKm2: r.boardsPerKm2,
      runtimeSeconds: r.runtimeSeconds,
    })),
  };

  const summaryPath = path.join(DATA_DIR, "multi_area_summary.json");
  await writeFile(summaryPath, JSON.stringify(summary, null, 2));

  console.log("");
  console.log("=== 3-area Bangalore pilot summary ===");
  console.log(`API requests used (cumulative, persistent quota): ${finalQuota.used}/${TOTAL_REQUEST_LIMIT}`);
  console.log(`total runtime: ${totalRuntimeSeconds.toFixed(1)}s`);
  for (const r of summary.areas) {
    console.log("");
    console.log(`[${r.areaId}] ${r.label}`);
    console.log(`  stopped: ${r.stoppedReason}`);
    console.log(`  API calls: ${r.apiRequestsUsedThisArea}`);
    console.log(`  panoramas: ${r.panoramasProcessed}`);
    console.log(`  OCR crops: ${r.ocrCropsProcessed}`);
    console.log(`  candidates: ${r.candidateCount}`);
    console.log(`  unique boards: ${r.uniqueBoardCount}`);
    console.log(`  area: ${r.areaKm2.toFixed(3)} km2`);
    console.log(`  boards/km2: ${r.boardsPerKm2 === null ? "n/a" : r.boardsPerKm2.toFixed(2)}`);
    console.log(`  runtime: ${r.runtimeSeconds.toFixed(1)}s`);
  }
  console.log("");
  console.log(`output: ${summaryPath}`);
}

main().catch((err) => {
  console.error("[pilot] failed:", err);
  process.exitCode = 1;
});
