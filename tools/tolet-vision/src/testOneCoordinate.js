// Single-coordinate smoke test: ONE Bangalore point -> nearest Street View
// image -> metadata -> save one image locally. Makes exactly 3 API requests
// (nearest, metadata, image download). Does not loop, does not scan.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  getNearestImageId,
  getMetadata,
  fetchImageBytes,
  readImageDimensions,
} from "./providers/ola/olaClient.js";

// One known Bangalore coordinate (HSR Layout).
const TEST_COORD = { lat: 12.934698876081738, lon: 77.61346209225312 };

let requestsMade = 0;

async function main() {
  console.log(`[test] coordinate: ${TEST_COORD.lat}, ${TEST_COORD.lon}`);

  const nearest = await getNearestImageId(TEST_COORD);
  requestsMade++;
  console.log(`[test] imageId request -> HTTP ${nearest.status} (${nearest.url})`);
  console.log(JSON.stringify(nearest.body, null, 2));
  if (!nearest.ok) {
    console.error(`[test] stopping: imageId request failed. Total requests made: ${requestsMade}`);
    return;
  }

  const imageId =
    nearest.body?.payload ?? nearest.body?.imageId ?? nearest.body?.ImageId ?? nearest.body?.image_id;
  if (!imageId) {
    console.error("[test] stopping: no imageId in response body — check field name above.");
    console.error(`[test] total requests made: ${requestsMade}`);
    return;
  }
  console.log(`[test] imageId: ${imageId}`);

  const metadata = await getMetadata({ imageId });
  requestsMade++;
  console.log(`[test] metadata request -> HTTP ${metadata.status} (${metadata.url})`);
  console.log(JSON.stringify(metadata.body, null, 2));
  if (!metadata.ok) {
    console.error(`[test] stopping: metadata request failed. Total requests made: ${requestsMade}`);
    return;
  }

  const m = metadata.body?.payload ?? {};
  const imageUrl = m.imageUrl ?? m.ImageUrl ?? m.image_url;
  console.log(`[test] returned latitude: ${m.lat ?? m.latitude}`);
  console.log(`[test] returned longitude: ${m.lon ?? m.longitude}`);
  console.log(`[test] bearing: ${m.bearing}`);
  console.log(`[test] captureDate: ${m.captureDate ?? m.capture_date ?? "(not present in response)"}`);
  console.log(`[test] imageUrl: ${imageUrl}`);

  if (!imageUrl) {
    console.error("[test] no imageUrl in metadata — API does not support direct image retrieval here.");
    console.error(`[test] total requests made: ${requestsMade}`);
    return;
  }

  const download = await fetchImageBytes(imageUrl);
  requestsMade++;
  console.log(`[test] image download -> HTTP ${download.status}`);
  if (!download.ok || !download.bytes) {
    console.error(`[test] stopping: image download failed. Total requests made: ${requestsMade}`);
    return;
  }

  const outDir = path.resolve(import.meta.dirname, "..", ".data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `${imageId}.jpg`);
  await writeFile(outPath, download.bytes);

  const dims = readImageDimensions(download.bytes);
  console.log(`[test] saved image -> ${outPath} (${download.bytes.length} bytes)`);
  console.log(`[test] image dimensions: ${dims ? `${dims.width}x${dims.height}` : "(could not parse)"}`);
  console.log(`[test] total API requests made: ${requestsMade}`);
}

main().catch((err) => {
  console.error("[test] failed:", err.message);
  console.error(`[test] total requests made before failure: ${requestsMade}`);
  process.exitCode = 1;
});
