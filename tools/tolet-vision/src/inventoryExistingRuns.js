// One-off (but safely re-runnable) bootstrap: scans every discovery run
// this tool has already produced — the BFS crawler's own log files and
// discovery_results.json outputs — and backfills panoramaRegistry.js from
// them, so a brand-new strategy (spatial sampling, or anything after it)
// starts with full knowledge of what the BFS crawl already captured
// instead of an empty registry.
//
// Read-only against everything it scans: opens log files and
// discovery_results.json with plain readFile, never writes to
// .data/pilot/clusters/ or .data/pilot/*.log. Safe to run while the BFS
// crawler is still active — it never touches apiQuota.js's
// quota_state.json (no API calls happen here at all) and only appends to
// panoramaRegistry.js's own separate file.
//
// Idempotent: recordImageId/recordBoardObservation are insert-if-absent /
// merge, so running this again later (e.g. after the BFS crawl finishes
// Indiranagar) only adds what's new — nothing already in the registry is
// duplicated or overwritten.
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  loadRegistry,
  saveRegistry,
  recordImageId,
  recordBoardObservation,
  registryStats,
} from "./panoramaRegistry.js";

const PILOT_DIR = path.resolve(import.meta.dirname, "..", ".data", "pilot");

async function walk(dir, predicate, results = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, predicate, results);
    else if (predicate(entry.name)) results.push(full);
  }
  return results;
}

// Matches lines like:
//   [olaProvider] (1/48) panorama bd5477313c18c4802357d749af848a95 @ 12.98812, 77.70663 [quota 264/8000]
const PANORAMA_LINE = /panorama\s+([0-9a-f]{16,40})\s+@\s+(-?[\d.]+),\s*(-?[\d.]+)/;
// Matches:  === [koramangala-5th-block] High-rental residential — ... ===   (multi-area log)
const AREA_HEADER = /^===\s*\[([a-z0-9-]+)\]/;
// Matches:  === Cluster: Whitefield (whitefield) ===   (cluster log)
const CLUSTER_HEADER = /^===\s*Cluster:\s*.*\(([a-z0-9-]+)\)\s*===/;
// Matches:  [whitefield/hoodi] coverage: 58 ways, ...   (cluster log, locality change)
const LOCALITY_LINE = /^\[([a-z0-9-]+)\/([a-z0-9-]+)\]/;

function parseLogFile(content, { defaultSource }) {
  const records = [];
  let currentCluster = null;
  let currentLocality = null;

  for (const line of content.split("\n")) {
    const areaMatch = line.match(AREA_HEADER);
    if (areaMatch) {
      currentCluster = null;
      currentLocality = areaMatch[1];
      continue;
    }
    const clusterMatch = line.match(CLUSTER_HEADER);
    if (clusterMatch) {
      currentCluster = clusterMatch[1];
      currentLocality = null;
      continue;
    }
    const localityMatch = line.match(LOCALITY_LINE);
    if (localityMatch) {
      currentCluster = localityMatch[1];
      currentLocality = localityMatch[2];
    }

    const panoMatch = line.match(PANORAMA_LINE);
    if (panoMatch) {
      const [, imageId, lat, lon] = panoMatch;
      records.push({
        imageId,
        latitude: Number(lat),
        longitude: Number(lon),
        source: defaultSource,
        locality: currentCluster && currentLocality ? `${currentCluster}/${currentLocality}` : currentLocality,
      });
    }
  }
  return records;
}

async function inventoryLogFiles(registry, run) {
  const logFiles = await walk(PILOT_DIR, (name) => name.endsWith(".log"));
  let recorded = 0;
  for (const filePath of logFiles) {
    const content = await readFile(filePath, "utf8");
    const source = path.basename(filePath) === "full_run.log" ? "bfs_cluster" : "bfs_multiarea";
    const records = parseLogFile(content, { defaultSource: source });
    for (const rec of records) {
      const before = registry.seenImageIds[rec.imageId];
      recordImageId(registry, rec.imageId, { ...rec, run });
      if (!before) recorded++;
    }
    console.log(`[inventory] ${path.relative(PILOT_DIR, filePath)}: ${records.length} panorama lines parsed`);
  }
  return recorded;
}

async function inventoryDiscoveryResults(registry, run) {
  const resultFiles = await walk(PILOT_DIR, (name) => name === "discovery_results.json");
  let imagesRecorded = 0;
  let boardsRecorded = 0;
  let observationsRecorded = 0;

  for (const filePath of resultFiles) {
    const raw = await readFile(filePath, "utf8");
    let json;
    try {
      json = JSON.parse(raw);
    } catch {
      console.warn(`[inventory] skipping unparsable file: ${filePath}`);
      continue;
    }

    const relative = path.relative(PILOT_DIR, filePath);
    const isCluster = relative.startsWith(path.join("clusters"));
    const locality =
      json.clusterId && json.localityId
        ? `${json.clusterId}/${json.localityId}`
        : (json.areaId ?? path.basename(path.dirname(filePath)));
    const source = isCluster ? "bfs_cluster" : relative.includes("pilot") ? "bfs_multiarea" : "bfs_single";

    for (const candidate of json.candidates ?? []) {
      const before = registry.seenImageIds[candidate.sourceId];
      recordImageId(registry, candidate.sourceId, {
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        source,
        locality,
        run,
      });
      if (!before) imagesRecorded++;

      const { isNewBoard } = recordBoardObservation(registry, candidate, { source, locality, run });
      observationsRecorded++;
      if (isNewBoard) boardsRecorded++;
    }
  }

  console.log(
    `[inventory] discovery_results.json files scanned: ${resultFiles.length} ` +
      `(${imagesRecorded} new imageIds, ${boardsRecorded} new boards, ${observationsRecorded} observations recorded)`
  );
  return { imagesRecorded, boardsRecorded };
}

async function main() {
  const run = `inventory-${new Date().toISOString()}`;
  const registry = await loadRegistry();
  const before = registryStats(registry);

  const newFromLogs = await inventoryLogFiles(registry, run);
  await inventoryDiscoveryResults(registry, run);

  await saveRegistry(registry);
  const after = registryStats(registry);

  console.log("");
  console.log("=== Registry inventory: summary ===");
  console.log(`imageIds: ${before.imageIdCount} -> ${after.imageIdCount} (+${after.imageIdCount - before.imageIdCount}, of which ${newFromLogs} from log-only panoramas with no candidate)`);
  console.log(`boards:   ${before.boardCount} -> ${after.boardCount} (+${after.boardCount - before.boardCount})`);
  console.log(`registry file: .data/pilot/registry/panorama_registry.json`);
}

main().catch((err) => {
  console.error("[inventory] failed:", err);
  process.exitCode = 1;
});
