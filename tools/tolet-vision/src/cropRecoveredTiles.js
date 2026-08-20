// Diagnostic only: crop the 6 recovered low-confidence-floor board tiles
// out of the panorama.jpg files already archived from the Google Tiles
// comparison session, for visual inspection. Makes ZERO API requests —
// reuses already-downloaded panorama bytes and the tile coordinates
// recorded in rescore_no_confidence_floor.json.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";

const SESSION_DIR = path.resolve(
  import.meta.dirname,
  "..",
  ".data/imagery/google/sessions/GOOGLE-TILES-20260820T020305Z-735acc"
);
const PANO_DIR = path.join(SESSION_DIR, "panoramas");
const OUT_DIR = path.resolve(import.meta.dirname, "..", ".data", "recovered_crops");

const RECOVERED = [
  {
    boardKey: "phone_9845783888",
    sourceId: "_XoPftnjfSo3W7D8Xne_TA",
    tile: { x: 0, y: 614, w: 1024, h: 1024 },
    ocrConfidence: 0,
    ocrTextSnippet: "TOLET / 2,3 BHK / TO-LET / 1,2,3 BHK / 9845783888 / BRAHMA FITNESS",
  },
  {
    boardKey: "phone_8197664073",
    sourceId: "_XoPftnjfSo3W7D8Xne_TA",
    tile: { x: 819, y: 614, w: 1024, h: 1024 },
    ocrConfidence: 0,
    ocrTextSnippet: "TO-LET / 1BHK&STUDIOROOM / 8197664073 / BRAHMA FITNESS",
  },
  {
    boardKey: "phone_9986120344",
    sourceId: "vBkLWuyfBUnZJUMEzxWOlg",
    tile: { x: 819, y: 614, w: 1024, h: 1024 },
    ocrConfidence: 15.71,
    ocrTextSnippet: "TO-LET / 1,2,3 BHK / 9986120344",
  },
  {
    boardKey: "phone_9880047621",
    sourceId: "vBkLWuyfBUnZJUMEzxWOlg",
    tile: { x: 2457, y: 614, w: 1024, h: 1024 },
    ocrConfidence: 0,
    ocrTextSnippet: "REAL ESTATE LEASE& RENT / MOB: 9880047621",
  },
  {
    boardKey: "phone_7406621768",
    sourceId: "_KLkqJqDygbmA0avTPZ6Hg",
    tile: { x: 2457, y: 614, w: 1024, h: 1024 },
    ocrConfidence: 0,
    ocrTextSnippet: "TO-LET / 1BHK / OLD PAPER MART / 7406621768 / BROKERAGE APPLICABLE",
  },
  {
    boardKey: "phone_9108447829",
    sourceId: "kxzfeMI5acGoodhN8Awkug",
    tile: { x: 0, y: 614, w: 1024, h: 1024 },
    ocrConfidence: 0,
    ocrTextSnippet: "TO-LET / FULLY FURNISHED BHK / 9108447829",
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`[crop] output dir: ${OUT_DIR}`);

  for (const item of RECOVERED) {
    const panoPath = path.join(PANO_DIR, item.sourceId, "panorama.jpg");
    const imageBytes = await readFile(panoPath);
    const image = await Jimp.fromBuffer(imageBytes);
    const crop = image.clone().crop(item.tile);
    const buffer = await crop.getBuffer(JimpMime.jpeg);

    const outPath = path.join(OUT_DIR, `${item.boardKey}.jpg`);
    await writeFile(outPath, buffer);
    console.log(
      `[crop] ${item.boardKey} <- ${item.sourceId} tile(${item.tile.x},${item.tile.y},${item.tile.w}x${item.tile.h}) ocrConfidence=${item.ocrConfidence} -> ${outPath}`
    );
  }

  console.log(`[crop] done. ${RECOVERED.length} crops written, 0 API requests.`);
}

main().catch((err) => {
  console.error("[crop] failed:", err);
  process.exitCode = 1;
});
