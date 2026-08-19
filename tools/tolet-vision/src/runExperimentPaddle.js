// PaddleOCR rerun of the same experiment, over the same 5 panoramas
// already saved to .data/diagnostic_panoramas/ (these are the first 5 of
// the 25-panorama Haralur Road crawl the Tesseract baseline — run
// runExperiment.js — used, so this is a direct apples-to-apples subset
// comparison). Tiling, confidence floor, and scoring are unchanged from
// the Tesseract run; only the OCR engine differs. Zero new API requests.
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { withPaddleOcrWorker } from "./paddleOcrEngine.js";
import { ocrPanorama } from "./ocrPipeline.js";
import { extractAndScore } from "./rentalScoring.js";

const CANDIDATE_SCORE_THRESHOLD = 15;
const OCR_CONFIDENCE_FLOOR = 50; // same scale/threshold as the Tesseract baseline run
// mkldnn is disabled (see paddle_ocr_server.py) to work around a CPU crash,
// which makes each inference call much slower than a normal PaddleOCR run.
// Capping panorama count for a faster signal while that's investigated.
const PANORAMA_LIMIT = Number(process.env.PANORAMA_LIMIT) || 1;

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data");
const PANO_DIR = path.join(DATA_DIR, "diagnostic_panoramas");
const CROPS_DIR = path.join(DATA_DIR, "crops_paddle");

async function main() {
  const allFiles = (await readdir(PANO_DIR)).filter((f) => f.endsWith(".jpg"));
  const files = allFiles.slice(0, PANORAMA_LIMIT);
  console.log(
    `[experiment-paddle] re-running OCR on ${files.length}/${allFiles.length} already-saved panoramas (0 new API requests)`
  );
  await mkdir(CROPS_DIR, { recursive: true });

  const candidates = [];
  let cropsProcessed = 0;
  const allTileResults = []; // every tile's text+confidence, for the raw comparison log

  await withPaddleOcrWorker(async (worker) => {
    for (const file of files) {
      const sourceId = file.replace(".jpg", "");
      const imageBytes = await readFile(path.join(PANO_DIR, file));
      console.log(`[experiment-paddle] OCR: ${sourceId}`);

      const tileResults = await ocrPanorama({
        imageBytes,
        worker,
        onTile: (r) => {
          cropsProcessed++;
          process.stdout.write(r.text ? "." : " ");
        },
      });
      console.log("");

      for (const [i, tileResult] of tileResults.entries()) {
        allTileResults.push({
          sourceId,
          tileIndex: i,
          confidence: tileResult.confidence,
          text: tileResult.text,
        });

        if (tileResult.confidence < OCR_CONFIDENCE_FLOOR) continue;
        const {
          score,
          signals,
          phone,
          phones,
          bhk,
          rent,
          broker,
          propertyName,
          addressHints,
          agencyName,
          contactHints,
          otherText,
        } = extractAndScore(tileResult.text);
        if (score < CANDIDATE_SCORE_THRESHOLD) continue;

        const cropFileName = `${sourceId}_tile${i}.jpg`;
        await writeFile(path.join(CROPS_DIR, cropFileName), tileResult.cropBuffer);

        candidates.push({
          provider: "ola",
          sourceId,
          tile: tileResult.tile,
          ocrText: tileResult.text,
          ocrConfidence: tileResult.confidence,
          signals,
          phone,
          phones,
          bhk,
          rent,
          broker,
          propertyName,
          addressHints,
          agencyName,
          contactHints,
          otherText,
          score,
          cropImage: `crops_paddle/${cropFileName}`,
        });
        console.log(`[experiment-paddle] candidate: score=${score} signals=[${signals.join(",")}]`);
      }
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  const outPath = path.join(DATA_DIR, "tolet_candidates_paddle.json");
  await writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ocrEngine: "paddleocr",
        candidateScoreThreshold: CANDIDATE_SCORE_THRESHOLD,
        ocrConfidenceFloor: OCR_CONFIDENCE_FLOOR,
        panoramasProcessed: files.length,
        ocrCropsProcessed: cropsProcessed,
        apiRequestsUsed: 0,
        candidateCount: candidates.length,
        candidates,
      },
      null,
      2
    )
  );

  // Also dump every tile's raw OCR text+confidence (not just candidates)
  // so the Tesseract-vs-PaddleOCR comparison can be made on read quality,
  // not just on whether the scoring threshold happened to trip.
  await writeFile(path.join(DATA_DIR, "ocr_raw_paddle.json"), JSON.stringify(allTileResults, null, 2));

  const nonEmpty = allTileResults.filter((t) => t.text && t.text.trim().length > 0);
  const aboveFloor = allTileResults.filter((t) => t.confidence >= OCR_CONFIDENCE_FLOOR);

  console.log("");
  console.log("=== PaddleOCR experiment summary ===");
  console.log(`panoramas processed: ${files.length}`);
  console.log(`OCR crops processed: ${cropsProcessed}`);
  console.log(`crops with non-empty text: ${nonEmpty.length}`);
  console.log(`crops at/above confidence floor (${OCR_CONFIDENCE_FLOOR}): ${aboveFloor.length}`);
  console.log(`candidates found: ${candidates.length}`);
  console.log(`API requests used: 0`);
  console.log(`output: ${outPath}`);
}

main().catch((err) => {
  console.error("[experiment-paddle] failed:", err);
  process.exitCode = 1;
});
