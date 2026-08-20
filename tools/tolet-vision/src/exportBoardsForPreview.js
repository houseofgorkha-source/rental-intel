// One-off export: turns panoramaRegistry.js's 42 deduped boards into a
// static dataset + copied crop images for a RentalIntel preview page.
//
// Read-only against everything in this tool (registry, discovery results,
// crop images) — makes zero calls to any discovery endpoint (nearestImageId
// /metadata/imageDownload) and never touches apiQuota.js's quota_state.json
// or any hybrid/BFS/spatial checkpoint file. The one live network call it
// does make (a single Ola Maps *static snapshot* image for the overview
// map) goes through a plain fetch(), bypassing apiQuota.js entirely — same
// reasoning as the earlier artifact preview: this is a UI asset render,
// not a discovery request, and must never race the crawler's own quota
// bookkeeping file.
//
// Writes only into the sibling RentalIntel app directory (../../data,
// ../../public/spotted-boards-preview) — never into this tool's own
// .data/pilot/ output.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const TOOL_ROOT = path.resolve(import.meta.dirname, "..");
const APP_ROOT = path.resolve(TOOL_ROOT, "..", "..");
const PILOT_DIR = path.join(TOOL_ROOT, ".data", "pilot");
const REGISTRY_PATH = path.join(PILOT_DIR, "registry", "panorama_registry.json");

const OUT_DATA_PATH = path.join(APP_ROOT, "data", "spotted-boards-dataset.json");
const OUT_IMAGE_DIR = path.join(APP_ROOT, "public", "spotted-boards-preview");

// Known, previously-confirmed labels for the two boards found outside the
// 21 cluster localities (see the conversation this was built in) — not
// derived from any field the pipeline extracted, but not fabricated
// either: both were manually visually confirmed earlier in this session.
const LOCALITY_LABELS = {
  pilot: "Ambalipura / Haralur Road",
  "indiranagar-100ft-road": "Indiranagar, 100 Feet Road (early pilot)",
};

function resolveCropSourceDir(observation) {
  if (observation.source === "bfs_cluster") return path.join(PILOT_DIR, "clusters", observation.locality);
  if (observation.locality === "pilot") return PILOT_DIR;
  if (observation.locality === "indiranagar-100ft-road") return path.join(PILOT_DIR, "indiranagar-100ft-road");
  return path.join(PILOT_DIR, observation.locality);
}

function localityLabel(locality) {
  if (LOCALITY_LABELS[locality]) return LOCALITY_LABELS[locality];
  if (!locality) return "Unknown";
  const parts = locality.split("/");
  const localityId = parts[parts.length - 1];
  return localityId
    .split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function clusterLabel(locality) {
  if (locality === "pilot" || locality === "indiranagar-100ft-road") return "other";
  return (locality ?? "unknown").split("/")[0];
}

async function exportBoards() {
  const registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
  const boards = Object.values(registry.seenBoards);
  await mkdir(OUT_IMAGE_DIR, { recursive: true });

  const dataset = [];
  for (const board of boards) {
    // Best observation = highest-scoring one with a crop image (should be
    // all of them — every candidate that reached boardDedup.js already
    // has a cropImage), tie-broken by whichever was recorded first.
    const best = [...board.observations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const sourceDir = resolveCropSourceDir(best);
    const sourceCropPath = path.join(sourceDir, best.cropImage);
    if (!existsSync(sourceCropPath)) {
      console.warn(`[export] skipping ${board.key} — crop image missing on disk: ${sourceCropPath}`);
      continue;
    }

    const slug = board.key.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    const imageFileName = `${slug}.jpg`;
    await copyFile(sourceCropPath, path.join(OUT_IMAGE_DIR, imageFileName));

    const sources = [...new Set(board.observations.map((o) => o.source))];
    dataset.push({
      id: slug,
      key: board.key,
      phone: board.phone,
      // rentalScoring.js extracts bhk as a Number (deliberately, unchanged
      // here) — normalized to a string at this export boundary since the
      // preview UI treats bhk as a filter/display string, not a quantity.
      bhk: board.bhk !== null && board.bhk !== undefined ? String(board.bhk) : null,
      rent: board.rent,
      propertyName: board.propertyName ? board.propertyName.replace(/\s+/g, " ").trim() : null,
      latitude: best.latitude,
      longitude: best.longitude,
      imagePath: `/spotted-boards-preview/${imageFileName}`,
      score: best.score,
      ocrConfidence: best.ocrConfidence,
      observationCount: board.observations.length,
      sources,
      cluster: clusterLabel(best.locality),
      locality: localityLabel(best.locality),
      localityKey: best.locality,
      firstSeenAt: board.firstSeenAt,
    });
  }

  dataset.sort((a, b) => b.score - a.score);
  return dataset;
}

async function fetchStaticMap({ boards, zoom, width, height, fileName, key }) {
  const lats = boards.map((b) => b.latitude);
  const lons = boards.map((b) => b.longitude);
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;

  const markerParams = boards.map((b) => `marker=${b.longitude},${b.latitude}|red|scale:0.6`).join("&");
  const url =
    `https://api.olamaps.io/tiles/v1/styles/default-light-standard/static/` +
    `${centerLon},${centerLat},${zoom}/${width}x${height}.png?api_key=${key}&${markerParams}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[export] ${fileName} fetch failed: HTTP ${res.status}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(OUT_IMAGE_DIR, fileName), buf);
  console.log(`[export] ${fileName} saved (${buf.length} bytes, ${boards.length} boards)`);
  return { centerLat, centerLon, zoom, width, height, fileName, boardCount: boards.length };
}

// One city-wide overview (all 42, oriented) plus one properly-zoomed map
// per cluster — Koramangala's 27 boards span ~4km and are illegible at a
// zoom wide enough to also fit Whitefield 15km away, so a single shared
// map can't serve both "orientation" and "individually clickable pins" at
// once. Deliberately fixed center/zoom per map (not auto-fit) so exact
// click-hotspot pixel positions can be computed afterward.
async function fetchAllMaps(dataset) {
  const key = process.env.OLA_MAPS_API_KEY;
  if (!key) {
    console.warn("[export] OLA_MAPS_API_KEY not set — skipping map fetches.");
    return {};
  }

  const byCluster = {};
  for (const b of dataset) (byCluster[b.cluster] ??= []).push(b);

  const maps = {};
  maps.all = await fetchStaticMap({ boards: dataset, zoom: 11, width: 900, height: 900, fileName: "map-all.png", key });
  if (byCluster.koramangala) maps.koramangala = await fetchStaticMap({ boards: byCluster.koramangala, zoom: 14, width: 800, height: 800, fileName: "map-koramangala.png", key });
  if (byCluster.indiranagar) maps.indiranagar = await fetchStaticMap({ boards: byCluster.indiranagar, zoom: 14, width: 800, height: 800, fileName: "map-indiranagar.png", key });
  if (byCluster.whitefield) maps.whitefield = await fetchStaticMap({ boards: byCluster.whitefield, zoom: 14, width: 800, height: 800, fileName: "map-whitefield.png", key });
  if (byCluster.other) maps.other = await fetchStaticMap({ boards: byCluster.other, zoom: 12, width: 800, height: 800, fileName: "map-other.png", key });

  return maps;
}

async function main() {
  const dataset = await exportBoards();
  console.log(`[export] ${dataset.length} boards exported (of ${Object.keys(JSON.parse(await readFile(REGISTRY_PATH, "utf8")).seenBoards).length} in registry)`);

  const maps = await fetchAllMaps(dataset);

  await mkdir(path.dirname(OUT_DATA_PATH), { recursive: true });
  await writeFile(
    OUT_DATA_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        boardCount: dataset.length,
        maps,
        boards: dataset,
      },
      null,
      2
    )
  );
  console.log(`[export] dataset written: ${OUT_DATA_PATH}`);
  console.log(`[export] images written: ${OUT_IMAGE_DIR}`);
}

main().catch((err) => {
  console.error("[export] failed:", err);
  process.exitCode = 1;
});
