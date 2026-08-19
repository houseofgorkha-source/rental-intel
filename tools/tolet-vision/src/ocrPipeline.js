// Tiles an equirectangular panorama into overlapping crops and runs OCR
// on each. Pure compute — no network calls.
import { Jimp, JimpMime } from "jimp";
import { createWorker } from "tesseract.js";

const DEFAULT_TILE_SIZE = 1024;
const DEFAULT_OVERLAP = 0.2;

// Restrict tiling to the vertical band most likely to contain storefronts
// and boards (skips the sky band at top and the road/pavement band at the
// bottom), to keep OCR volume manageable in this prototype.
const BAND_TOP_FRACTION = 0.3;
const BAND_BOTTOM_FRACTION = 0.85;

export function planTiles(width, height, { tileSize = DEFAULT_TILE_SIZE, overlap = DEFAULT_OVERLAP } = {}) {
  const stride = Math.round(tileSize * (1 - overlap));
  const bandTop = Math.floor(height * BAND_TOP_FRACTION);
  const bandBottom = Math.floor(height * BAND_BOTTOM_FRACTION);
  const bandHeight = bandBottom - bandTop;

  const tiles = [];
  for (let y = bandTop; y < bandBottom; y += stride) {
    const h = Math.min(tileSize, bandTop + bandHeight - y);
    if (h < tileSize * 0.5) break;
    for (let x = 0; x < width; x += stride) {
      const w = Math.min(tileSize, width - x);
      if (w < tileSize * 0.5) continue;
      tiles.push({ x, y, w, h });
    }
  }
  return tiles;
}

export async function withOcrWorker(fn) {
  const worker = await createWorker("eng");
  try {
    return await fn(worker);
  } finally {
    await worker.terminate();
  }
}

export async function ocrPanorama({ imageBytes, worker, onTile, tileSize, overlap }) {
  const image = await Jimp.fromBuffer(imageBytes);
  const tiles = planTiles(image.bitmap.width, image.bitmap.height, { tileSize, overlap });
  const results = [];

  for (const tile of tiles) {
    const crop = image.clone().crop(tile);
    const buffer = await crop.getBuffer(JimpMime.jpeg);
    const {
      data: { text, confidence },
    } = await worker.recognize(buffer);
    const result = { tile, text: text.trim(), confidence, cropBuffer: buffer };
    results.push(result);
    if (onTile) onTile(result);
  }

  return results;
}
