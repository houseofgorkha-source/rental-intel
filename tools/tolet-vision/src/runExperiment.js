// Experiment 2: panorama -> overlapping OCR crops -> rental scoring ->
// candidate JSON, over a small set of panoramas from one covered Bengaluru
// area. Does not touch RentalIntel/Supabase. No DB integration.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getProvider } from "./imageryProvider.js";
import { withOcrWorker, ocrPanorama } from "./ocrPipeline.js";
import { extractAndScore } from "./rentalScoring.js";

// Haralur Road / Ambalipura, near SJR Eastwood Layout — the area a real
// user-submitted RentalIntel board sighting ("For Rent, 4BHK, Harlur Main
// Road") came from, and confirmed to have dense Street View coverage
// (184 way segments in a /coverage query) before crawling. The previous
// two seeds (arbitrary coverage-bbox picks) turned out to be quiet
// residential lanes with no signage in frame.
const PROVIDER_NAME = "ola";
const SEED = { seedLat: 12.9017192, seedLon: 77.6505572 };
const TARGET_PANORAMAS = 25;
const CANDIDATE_SCORE_THRESHOLD = 15;
const OCR_CONFIDENCE_FLOOR = 50;
const { crawlPanoramas } = getProvider(PROVIDER_NAME);

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data");
const CROPS_DIR = path.join(DATA_DIR, "crops");

async function main() {
  console.log(`[experiment] crawling up to ${TARGET_PANORAMAS} panoramas from seed ${SEED.seedLat}, ${SEED.seedLon}`);
  const { panoramas, stats: crawlStats } = await crawlPanoramas({
    seedLat: SEED.seedLat,
    seedLon: SEED.seedLon,
    targetCount: TARGET_PANORAMAS,
  });
  console.log(`[experiment] crawled ${panoramas.length} panoramas using ${crawlStats.requestsMade} API requests`);

  await mkdir(CROPS_DIR, { recursive: true });

  const candidates = [];
  let cropsProcessed = 0;

  await withOcrWorker(async (worker) => {
    for (const pano of panoramas) {
      console.log(`[experiment] OCR: panorama ${pano.provider}/${pano.sourceId}`);
      const tileResults = await ocrPanorama({
        imageBytes: pano.imageBytes,
        worker,
        onTile: (r) => {
          cropsProcessed++;
          if (r.text) {
            process.stdout.write(".");
          } else {
            process.stdout.write(" ");
          }
        },
      });
      console.log("");

      for (const [i, tileResult] of tileResults.entries()) {
        if (tileResult.confidence < OCR_CONFIDENCE_FLOOR) continue;
        const { score, signals, phone, bhk, rent, broker } = extractAndScore(tileResult.text);
        if (score < CANDIDATE_SCORE_THRESHOLD) continue;

        const cropFileName = `${pano.provider}_${pano.sourceId}_tile${i}.jpg`;
        const cropPath = path.join(CROPS_DIR, cropFileName);
        await writeFile(cropPath, tileResult.cropBuffer);

        // Provider-neutral candidate shape — see imageryProvider.js. sourceId is
        // an observation identifier, never a property identity: the same board
        // re-observed later, or by a different provider, is a different sourceId
        // pointing at the same (or a nearby) lat/lng, to be reconciled by a later
        // geospatial-dedup stage, not here.
        candidates.push({
          provider: pano.provider,
          sourceId: pano.sourceId,
          latitude: pano.latitude,
          longitude: pano.longitude,
          bearing: pano.bearing,
          firstSeen: pano.observedAt,
          lastSeen: pano.observedAt,
          captureDate: pano.captureDate,
          tile: tileResult.tile,
          ocrText: tileResult.text,
          ocrConfidence: tileResult.confidence,
          signals,
          phone,
          bhk,
          rent,
          broker,
          score,
          cropImage: `crops/${cropFileName}`,
        });
        console.log(
          `[experiment] candidate: score=${score} signals=[${signals.join(",")}] phone=${phone} bhk=${bhk} rent=${rent}`
        );
      }
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  const outPath = path.join(DATA_DIR, "tolet_candidates.json");
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        seed: SEED,
        candidateScoreThreshold: CANDIDATE_SCORE_THRESHOLD,
        ocrConfidenceFloor: OCR_CONFIDENCE_FLOOR,
        panoramasProcessed: panoramas.length,
        ocrCropsProcessed: cropsProcessed,
        apiRequestsUsed: crawlStats.requestsMade,
        candidateCount: candidates.length,
        candidates,
      },
      null,
      2
    )
  );

  console.log("");
  console.log("=== Experiment summary ===");
  console.log(`panoramas processed: ${panoramas.length}`);
  console.log(`OCR crops processed: ${cropsProcessed}`);
  console.log(`candidates found: ${candidates.length}`);
  console.log(`API requests used: ${crawlStats.requestsMade}`);
  console.log(`output: ${outPath}`);
}

main().catch((err) => {
  console.error("[experiment] failed:", err);
  process.exitCode = 1;
});
