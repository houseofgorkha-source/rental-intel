// Manual verification only: render a handful of rectilinear ("normal
// photo") perspective views from one already-saved equirectangular
// panorama, at different headings, and run OCR on each. Goal: confirm
// whether de-warping actually fixes OCR legibility before building a full
// conversion stage into the pipeline. Zero API requests — reuses a
// panorama already saved to .data/diagnostic_panoramas/.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";
import { withOcrWorker } from "./ocrPipeline.js";
import { extractAndScore } from "./rentalScoring.js";

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data");
const PANO_FILE = path.join(DATA_DIR, "diagnostic_panoramas", "f1e6d2e9cac5f35457cfe6c2b90f1172.jpg");
const OUT_DIR = path.join(DATA_DIR, "dewarp_test");

const OUT_WIDTH = 1024;
const OUT_HEIGHT = 768;
const H_FOV_DEG = 90;
const HEADINGS_DEG = [0, 90, 180, 270];

// Standard equirectangular -> rectilinear reprojection. `yawDeg` is the
// camera heading (0 = center of the source pano), pitch fixed at 0
// (horizon-level, where signage sits).
function renderPerspective(srcImage, yawDeg) {
  const srcW = srcImage.bitmap.width;
  const srcH = srcImage.bitmap.height;
  const src = srcImage.bitmap.data;

  const out = new Jimp({ width: OUT_WIDTH, height: OUT_HEIGHT });
  const dst = out.bitmap.data;

  const hFov = (H_FOV_DEG * Math.PI) / 180;
  const vFov = hFov * (OUT_HEIGHT / OUT_WIDTH);
  const yaw = (yawDeg * Math.PI) / 180;

  for (let j = 0; j < OUT_HEIGHT; j++) {
    const py = (0.5 - (j + 0.5) / OUT_HEIGHT) * 2; // -1..1, image-row-down -> camera-Y-up
    for (let i = 0; i < OUT_WIDTH; i++) {
      const px = ((i + 0.5) / OUT_WIDTH - 0.5) * 2; // -1..1

      // Ray in camera space, then rotate by yaw around the vertical axis.
      const camX = px * Math.tan(hFov / 2);
      const camY = py * Math.tan(vFov / 2);
      const camZ = 1;

      const dirX = camX * Math.cos(yaw) + camZ * Math.sin(yaw);
      const dirZ = -camX * Math.sin(yaw) + camZ * Math.cos(yaw);
      const dirY = camY;

      const len = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);
      const nx = dirX / len;
      const ny = dirY / len;
      const nz = dirZ / len;

      const theta = Math.atan2(nx, nz); // -pi..pi, longitude
      const phi = Math.asin(ny); // -pi/2..pi/2, latitude

      const u = (theta / (2 * Math.PI) + 0.5) * srcW;
      const v = (0.5 - phi / Math.PI) * srcH;

      const sx = Math.min(srcW - 1, Math.max(0, Math.floor(u)));
      const sy = Math.min(srcH - 1, Math.max(0, Math.floor(v)));

      const srcIdx = (sy * srcW + sx) * 4;
      const dstIdx = (j * OUT_WIDTH + i) * 4;
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
  console.log(`[dewarp-test] source: ${PANO_FILE} (${srcImage.bitmap.width}x${srcImage.bitmap.height})`);

  await withOcrWorker(async (worker) => {
    for (const yawDeg of HEADINGS_DEG) {
      console.log(`[dewarp-test] rendering heading ${yawDeg}deg...`);
      const view = renderPerspective(srcImage, yawDeg);
      const buffer = await view.getBuffer(JimpMime.jpeg);
      const outPath = path.join(OUT_DIR, `heading_${yawDeg}.jpg`);
      await writeFile(outPath, buffer);

      const {
        data: { text, confidence },
      } = await worker.recognize(buffer);
      const trimmed = text.trim();
      const { score, signals } = extractAndScore(trimmed);
      console.log(`[dewarp-test] heading=${yawDeg} confidence=${confidence.toFixed(1)} score=${score} signals=[${signals.join(",")}]`);
      console.log(`[dewarp-test] text: ${JSON.stringify(trimmed.slice(0, 300))}`);
      console.log(`[dewarp-test] saved: ${outPath}`);
      console.log("");
    }
  });
}

main().catch((err) => {
  console.error("[dewarp-test] failed:", err);
  process.exitCode = 1;
});
