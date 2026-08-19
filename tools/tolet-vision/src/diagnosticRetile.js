// Diagnostic only: re-tile the 5 panoramas already saved to
// .data/diagnostic_panoramas/ (from the Haralur Road ground-truth check)
// at a smaller/denser tile size, to test whether recall improves. Makes
// ZERO new API requests — reuses already-downloaded panorama bytes.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { withOcrWorker, ocrPanorama } from "./ocrPipeline.js";
import { extractAndScore } from "./rentalScoring.js";

const TILE_SIZE = 512;
const OVERLAP = 0.3;
const OCR_CONFIDENCE_FLOOR = 50;
const CANDIDATE_SCORE_THRESHOLD = 15;

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data");
const PANO_DIR = path.join(DATA_DIR, "diagnostic_panoramas");
const CROPS_DIR = path.join(DATA_DIR, "diagnostic_crops");

async function main() {
  const files = (await readdir(PANO_DIR)).filter((f) => f.endsWith(".jpg"));
  console.log(`[diagnostic] re-tiling ${files.length} panoramas at ${TILE_SIZE}px / ${OVERLAP * 100}% overlap`);
  await mkdir(CROPS_DIR, { recursive: true });

  const candidates = [];
  let cropsProcessed = 0;
  let lowConfidenceButNonEmpty = 0;

  await withOcrWorker(async (worker) => {
    for (const file of files) {
      const sourceId = file.replace(".jpg", "");
      const imageBytes = await readFile(path.join(PANO_DIR, file));
      console.log(`[diagnostic] OCR: ${sourceId}`);

      const tileResults = await ocrPanorama({
        imageBytes,
        worker,
        tileSize: TILE_SIZE,
        overlap: OVERLAP,
        onTile: () => {
          cropsProcessed++;
          process.stdout.write(".");
        },
      });
      console.log("");

      for (const [i, tileResult] of tileResults.entries()) {
        if (!tileResult.text) continue;
        if (tileResult.confidence < OCR_CONFIDENCE_FLOOR) {
          lowConfidenceButNonEmpty++;
          continue;
        }
        const { score, signals, phone, bhk, rent, broker } = extractAndScore(tileResult.text);
        if (score < CANDIDATE_SCORE_THRESHOLD) continue;

        const cropFileName = `${sourceId}_tile${i}.jpg`;
        await writeFile(path.join(CROPS_DIR, cropFileName), tileResult.cropBuffer);
        candidates.push({
          sourceId,
          tile: tileResult.tile,
          ocrText: tileResult.text,
          ocrConfidence: tileResult.confidence,
          signals,
          phone,
          bhk,
          rent,
          broker,
          score,
          cropImage: `diagnostic_crops/${cropFileName}`,
        });
        console.log(`[diagnostic] candidate: score=${score} signals=[${signals.join(",")}]`);
      }
    }
  });

  console.log("");
  console.log("=== Diagnostic summary ===");
  console.log(`panoramas re-tiled: ${files.length}`);
  console.log(`OCR crops processed: ${cropsProcessed}`);
  console.log(`crops with non-empty text below confidence floor: ${lowConfidenceButNonEmpty}`);
  console.log(`candidates found: ${candidates.length}`);
  console.log(`API requests used: 0 (reused already-downloaded panoramas)`);

  await writeFile(
    path.join(DATA_DIR, "diagnostic_retile_result.json"),
    JSON.stringify({ tileSize: TILE_SIZE, overlap: OVERLAP, cropsProcessed, candidates }, null, 2)
  );
}

main().catch((err) => {
  console.error("[diagnostic] failed:", err);
  process.exitCode = 1;
});
