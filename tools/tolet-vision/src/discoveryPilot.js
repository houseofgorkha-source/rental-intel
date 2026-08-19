// Bangalore discovery pilot: crawl a small, bounded area (not the whole
// city), OCR every panorama with the validated GPU PaddleOCR pipeline,
// score/extract with the unchanged rentalScoring.js, and dedupe into
// "unique boards". Hard-stops at a configured API request limit — see
// apiQuota.js, enforced at the HTTP layer in providers/ola/olaClient.js so
// it can't be silently bypassed.
//
// No RentalIntel/Supabase integration — output is local JSON + images
// under .data/pilot/ only.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { configureQuota, getQuotaStatus } from "./apiQuota.js";
import { getProvider } from "./imageryProvider.js";
import { ocrPanorama } from "./ocrPipeline.js";
import { withPaddleOcrWorker } from "./paddleOcrEngine.js";
import { extractAndScore, hasRentalSignal } from "./rentalScoring.js";
import { dedupeBoards } from "./boardDedup.js";

const PROVIDER_NAME = "ola";
const REQUEST_LIMIT = Number(process.env.OLA_API_REQUEST_LIMIT) || 150;
const TARGET_PANORAMA_COUNT = Number(process.env.PILOT_PANORAMA_TARGET) || 60;

// A small bounded area near Ambalipura/Haralur Road (~900m x 900m) —
// confirmed real Street View coverage and at least one genuine TO-LET
// board (see test-fixtures/recall-test-01) already found nearby. Not the
// whole city, per instruction.
const BBOX = { xMin: 77.645, xMax: 77.654, yMin: 12.896, yMax: 12.904 };
const SEED = { seedLat: 12.9005, seedLon: 77.6488 };

const CANDIDATE_SCORE_THRESHOLD = 15;
const OCR_CONFIDENCE_FLOOR = 50;

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data", "pilot");
const CROPS_DIR = path.join(DATA_DIR, "crops");

async function main() {
  const startedAt = Date.now();
  configureQuota(REQUEST_LIMIT);
  console.log(`[pilot] API request limit: ${REQUEST_LIMIT}`);
  console.log(`[pilot] bbox: ${JSON.stringify(BBOX)}`);
  console.log(`[pilot] target panoramas: ${TARGET_PANORAMA_COUNT} (whichever limit hits first wins)`);

  await mkdir(CROPS_DIR, { recursive: true });

  const { crawlPanoramas } = getProvider(PROVIDER_NAME);
  const { panoramas, stats: crawlStats, stoppedReason } = await crawlPanoramas({
    ...SEED,
    targetCount: TARGET_PANORAMA_COUNT,
    bbox: BBOX,
  });
  console.log(
    `[pilot] crawl stopped: ${stoppedReason} — ${panoramas.length} panoramas, ` +
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
        // A phone number alone (score 15) must not qualify — plenty of
        // unrelated signage has a legible phone number. Require an actual
        // rental-specific signal too (see hasRentalSignal).
        if (extracted.score < CANDIDATE_SCORE_THRESHOLD) continue;
        if (!hasRentalSignal(extracted.signals)) continue;

        const cropFileName = `${pano.sourceId}_tile${i}.jpg`;
        await writeFile(path.join(CROPS_DIR, cropFileName), tileResult.cropBuffer);

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
          `[pilot] candidate: ${pano.sourceId} score=${extracted.score} signals=[${extracted.signals.join(",")}] phone=${extracted.phone}`
        );
      }
    }
  });

  const boards = dedupeBoards(candidates);
  const runtimeSeconds = (Date.now() - startedAt) / 1000;
  const finalQuota = getQuotaStatus();

  const result = {
    generatedAt: new Date().toISOString(),
    bbox: BBOX,
    seed: SEED,
    requestLimit: REQUEST_LIMIT,
    stoppedReason,
    apiRequestsUsed: finalQuota.used,
    apiRequestsRemaining: finalQuota.remaining,
    panoramasProcessed: panoramas.length,
    ocrCropsProcessed: cropsProcessed,
    candidateCount: candidates.length,
    uniqueBoardCount: boards.length,
    runtimeSeconds,
    candidates,
    boards,
  };

  const outPath = path.join(DATA_DIR, "discovery_results.json");
  await writeFile(outPath, JSON.stringify(result, null, 2));

  console.log("");
  console.log("=== Bangalore discovery pilot summary ===");
  console.log(`API requests used: ${finalQuota.used}/${REQUEST_LIMIT} (stopped: ${stoppedReason})`);
  console.log(`panoramas processed: ${panoramas.length}`);
  console.log(`OCR crops processed: ${cropsProcessed}`);
  console.log(`candidates found: ${candidates.length}`);
  console.log(`unique boards: ${boards.length}`);
  console.log(`runtime: ${runtimeSeconds.toFixed(1)}s`);
  console.log(`output: ${outPath}`);
  for (const board of boards) {
    console.log(
      `  - [${board.dedupMethod}] phone=${board.phone} bhk=${board.bhk} rent=${board.rent} ` +
        `propertyName=${board.propertyName} observations=${board.observationCount}`
    );
  }
}

main().catch((err) => {
  console.error("[pilot] failed:", err);
  process.exitCode = 1;
});
