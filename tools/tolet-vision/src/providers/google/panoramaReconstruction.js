// Reconstructs one full equirectangular panorama image from Street View
// Tiles — session/metadata/individual tiles are Google's product; a
// single stitched panorama.jpg is what the existing OCR pipeline
// (ocrPipeline.js) already expects, unmodified, the same shape Ola's
// panoramas arrive in.
//
// Zoom-to-resolution scaling (zoom 5 = full resolution, each lower zoom
// level halves both dimensions) is the standard tile-pyramid convention
// and is *inferred*, not explicitly stated in Google's docs — flagged
// here rather than presented as confirmed. If tile fetches start
// systematically 404ing at the computed grid edges, that's the signal
// this assumption needs revisiting.
//
// Full panorama (all rows, not band-limited to the OCR band) per
// explicit product-owner choice — see the archived plan. A failed
// individual tile is logged and left as a blank region in the composite
// rather than aborting the whole panorama.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";
import { getTile } from "./googleClient.js";

export function tileGridForZoom({ imageWidth, imageHeight, tileWidth, tileHeight, zoom }) {
  const scale = 2 ** (zoom - 5); // zoom 5 = 1.0, zoom 4 = 0.5, zoom 3 = 0.25, ...
  const scaledWidth = Math.max(1, Math.round(imageWidth * scale));
  const scaledHeight = Math.max(1, Math.round(imageHeight * scale));
  const cols = Math.ceil(scaledWidth / tileWidth);
  const rows = Math.ceil(scaledHeight / tileHeight);
  return { scaledWidth, scaledHeight, cols, rows };
}

// `metadata` needs: panoId, imageWidth, imageHeight, tileWidth, tileHeight
// (all from the metadata response — never hardcoded, see googleClient.js).
// `logTile(archiveSessionId, purpose, panoramaId, billable, fn)` is
// googleProvider.js's own request-ledger wrapper, passed in rather than
// imported here to avoid a circular import (googleProvider.js already
// imports this module) — every tile fetch is billable, so it always logs.
// `tilesDir`, if given, gets every successfully-fetched raw tile written
// to it as `tile_{zoom}_{x}_{y}.jpg` — preserving the individual tiles
// alongside the reconstructed panorama, per the archive spec.
// Returns { imageBytes, width, height, cols, rows, tilesRequested, tilesSucceeded }.
export async function reconstructPanorama({ session, metadata, zoom, archiveSessionId, logTile, tilesDir = null }) {
  if (tilesDir) await mkdir(tilesDir, { recursive: true });
  const { scaledWidth, scaledHeight, cols, rows } = tileGridForZoom({
    imageWidth: metadata.imageWidth,
    imageHeight: metadata.imageHeight,
    tileWidth: metadata.tileWidth,
    tileHeight: metadata.tileHeight,
    zoom,
  });

  const canvas = new Jimp({ width: cols * metadata.tileWidth, height: rows * metadata.tileHeight, color: 0x000000ff });
  let tilesRequested = 0;
  let tilesSucceeded = 0;
  const tileLog = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      tilesRequested++;
      const tile = await logTile(archiveSessionId, "tile", metadata.panoId, true, () =>
        getTile({ session, panoId: metadata.panoId, zoom, x, y })
      );
      tileLog.push({ x, y, ok: tile.ok, status: tile.status });
      if (!tile.ok || !tile.bytes) continue;
      tilesSucceeded++;
      if (tilesDir) await writeFile(path.join(tilesDir, `tile_${zoom}_${x}_${y}.jpg`), tile.bytes);
      try {
        const tileImage = await Jimp.fromBuffer(tile.bytes);
        canvas.composite(tileImage, x * metadata.tileWidth, y * metadata.tileHeight);
      } catch (err) {
        console.warn(`[panoramaReconstruction] tile (${x},${y}) at zoom ${zoom} failed to decode: ${err.message}`);
      }
    }
  }

  const imageBytes = await canvas.getBuffer(JimpMime.jpeg);
  return {
    imageBytes,
    width: cols * metadata.tileWidth,
    height: rows * metadata.tileHeight,
    cols,
    rows,
    zoom,
    tilesRequested,
    tilesSucceeded,
    tileLog,
  };
}
