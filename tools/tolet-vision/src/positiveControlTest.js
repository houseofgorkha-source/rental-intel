// Positive-control test: aim the corrected de-warp directly at the
// clearest, largest real signage found in an already-saved panorama
// ("jute Tree" storefront cluster — multiple posters, readable text,
// found by scouting crops of .data/diagnostic_panoramas/), render a
// rectilinear view centered/zoomed on it, and OCR it. Zero API calls —
// reuses an already-downloaded panorama.
//
// Goal: isolate whether "corrected de-warp + OCR" can read real signage at
// all, before touching tiling, OCR engine, or thresholds.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";
import { withOcrWorker } from "./ocrPipeline.js";
import { extractAndScore } from "./rentalScoring.js";

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data");
const PANO_FILE = path.join(DATA_DIR, "diagnostic_panoramas", "c52777d9dd165df1a4a0f11e9cd250e9.jpg");
const OUT_DIR = path.join(DATA_DIR, "positive_control");

// Pixel location of the signage cluster, found by cropping/inspecting the
// source panorama directly (.data/scout_crops/..._left.jpg): the "jute
// Tree" storefront's dense poster cluster ("Honey Gold 7 Spa", "Curves 7
// Slim", branding), at roughly (1030, 1190) in the full 5760x2880 source.
const TARGET_PX = { x: 1030, y: 1190 };

// Equirect-to-rectilinear reprojection with both yaw (heading) and pitch
// (up/down look angle), corrected for the earlier vertical-flip bug.
function renderPerspective(srcImage, { yawDeg, pitchDeg, outWidth, outHeight, hFovDeg }) {
  const srcW = srcImage.bitmap.width;
  const srcH = srcImage.bitmap.height;
  const src = srcImage.bitmap.data;

  const out = new Jimp({ width: outWidth, height: outHeight });
  const dst = out.bitmap.data;

  const hFov = (hFovDeg * Math.PI) / 180;
  const vFov = hFov * (outHeight / outWidth);
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;

  for (let j = 0; j < outHeight; j++) {
    const py = (0.5 - (j + 0.5) / outHeight) * 2; // -1..1, image-row-down -> camera-Y-up
    for (let i = 0; i < outWidth; i++) {
      const px = ((i + 0.5) / outWidth - 0.5) * 2; // -1..1

      const camX = px * Math.tan(hFov / 2);
      const camY = py * Math.tan(vFov / 2);

      // Pitch: rotate the (camY, z=1) ray around the camera's local X axis.
      const y1 = camY * Math.cos(pitch) + Math.sin(pitch);
      const z1 = -camY * Math.sin(pitch) + Math.cos(pitch);
      const x1 = camX;

      // Yaw: rotate around the world vertical (Y) axis.
      const dirX = x1 * Math.cos(yaw) + z1 * Math.sin(yaw);
      const dirZ = -x1 * Math.sin(yaw) + z1 * Math.cos(yaw);
      const dirY = y1;

      const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
      const nx = dirX / len;
      const ny = dirY / len;
      const nz = dirZ / len;

      const theta = Math.atan2(nx, nz);
      const phi = Math.asin(ny);

      const u = (theta / (2 * Math.PI) + 0.5) * srcW;
      const v = (0.5 - phi / Math.PI) * srcH;

      const sx = Math.min(srcW - 1, Math.max(0, Math.floor(u)));
      const sy = Math.min(srcH - 1, Math.max(0, Math.floor(v)));

      const srcIdx = (sy * srcW + sx) * 4;
      const dstIdx = (j * outWidth + i) * 4;
      dst[dstIdx] = src[srcIdx];
      dst[dstIdx + 1] = src[srcIdx + 1];
      dst[dstIdx + 2] = src[srcIdx + 2];
      dst[dstIdx + 3] = 255;
    }
  }

  return out;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const bytes = await readFile(PANO_FILE);
  const srcImage = await Jimp.fromBuffer(bytes);
  const srcW = srcImage.bitmap.width;
  const srcH = srcImage.bitmap.height;
  console.log(`[positive-control] source: ${PANO_FILE} (${srcW}x${srcH})`);

  const yawDeg = (TARGET_PX.x / srcW - 0.5) * 360;
  const pitchDeg = (0.5 - TARGET_PX.y / srcH) * 180;
  console.log(`[positive-control] target px (${TARGET_PX.x}, ${TARGET_PX.y}) -> yaw=${yawDeg.toFixed(1)}deg pitch=${pitchDeg.toFixed(1)}deg`);

  // Two variants: a tight zoom directly on the target, and a wider
  // fallback in case the hand-picked pixel estimate is slightly off.
  const variants = [
    { name: "zoomed", hFovDeg: 25, outWidth: 1000, outHeight: 750 },
    { name: "wide", hFovDeg: 50, outWidth: 1200, outHeight: 900 },
  ];

  await withOcrWorker(async (worker) => {
    for (const variant of variants) {
      console.log(`[positive-control] rendering "${variant.name}" (hFOV=${variant.hFovDeg}deg)...`);
      const view = renderPerspective(srcImage, { yawDeg, pitchDeg, ...variant });
      const buffer = await view.getBuffer(JimpMime.jpeg);
      const outPath = path.join(OUT_DIR, `${variant.name}.jpg`);
      await writeFile(outPath, buffer);

      const {
        data: { text, confidence },
      } = await worker.recognize(buffer);
      const trimmed = text.trim();
      const { score, signals, phone, bhk, rent, broker } = extractAndScore(trimmed);
      console.log(`[positive-control] "${variant.name}" confidence=${confidence.toFixed(1)} score=${score} signals=[${signals.join(",")}]`);
      console.log(`[positive-control] "${variant.name}" text: ${JSON.stringify(trimmed)}`);
      console.log(`[positive-control] saved: ${outPath}`);
      console.log("");
    }
  });
}

main().catch((err) => {
  console.error("[positive-control] failed:", err);
  process.exitCode = 1;
});
