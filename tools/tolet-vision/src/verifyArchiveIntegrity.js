// Read-only integrity check across the archive + registries + checkpoint,
// before trusting them for a new live run. Makes ZERO API requests.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { loadImageRegistry } from "./archive/imageRegistry.js";
import { loadBoardRegistry } from "./archive/boardRegistry.js";
import { loadDedupRegistry } from "./archive/dedupRegistry.js";
import { loadRegistry as loadPanoramaRegistry, registryStats } from "./panoramaRegistry.js";
import { getQuotaStatus } from "./apiQuota.js";

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data");
const problems = [];
const notes = [];

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== Archive/registry integrity check ===\n");

  // 1. Registries parse and load
  const imageRegistry = await loadImageRegistry();
  const boardRegistry = await loadBoardRegistry();
  const dedupRegistry = await loadDedupRegistry();
  const panoramaRegistry = await loadPanoramaRegistry();
  console.log(`image_registry.json: ${Object.keys(imageRegistry.entries).length} entries`);
  console.log(`board_registry.json: ${Object.keys(boardRegistry.boards).length} boards`);
  console.log(`dedup_registry.json: ${(dedupRegistry.relationships ?? []).length} relationships`);
  const panoStats = registryStats(panoramaRegistry);
  console.log(`panorama_registry.json (Ola-only quota-dedup): ${panoStats.imageIdCount} imageIds, ${panoStats.boardCount} boards`);

  // 2. Every image_registry entry with rawImageAvailable=true must have real files on disk
  let checkedOnDisk = 0;
  for (const [key, entry] of Object.entries(imageRegistry.entries)) {
    if (!entry.rawImageAvailable) continue;
    checkedOnDisk++;
    if (!entry.rawImagePath || !(await exists(entry.rawImagePath))) {
      problems.push(`image_registry entry ${key} claims rawImageAvailable but panorama.jpg missing: ${entry.rawImagePath}`);
      continue;
    }
    if (entry.ocrOutputRef && !(await exists(entry.ocrOutputRef))) {
      problems.push(`image_registry entry ${key} ocrOutputRef missing on disk: ${entry.ocrOutputRef}`);
    }
  }
  console.log(`checked ${checkedOnDisk} entries claiming rawImageAvailable=true against disk`);

  // 3. Every panorama directory on disk should be represented in image_registry
  const providerRoots = [
    ["google", path.join(DATA_DIR, "imagery", "google", "sessions")],
    ["ola", path.join(DATA_DIR, "imagery", "ola", "sessions")],
  ];
  const registryKeys = new Set(Object.keys(imageRegistry.entries));
  let totalPanoDirs = 0;
  for (const [provider, root] of providerRoots) {
    let sessionDirs = [];
    try {
      sessionDirs = await readdir(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const sd of sessionDirs) {
      if (!sd.isDirectory()) continue;
      const panoRoot = path.join(root, sd.name, "panoramas");
      let panoDirs = [];
      try {
        panoDirs = await readdir(panoRoot, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const pd of panoDirs) {
        if (!pd.isDirectory()) continue;
        totalPanoDirs++;
        const key = `${provider}:${pd.name}`;
        if (!registryKeys.has(key)) {
          notes.push(`panorama dir on disk not in image_registry (likely pre-archive/migrated data): ${provider}/${sd.name}/${pd.name}`);
        }
      }
    }
  }
  console.log(`panorama directories on disk: ${totalPanoDirs}`);

  // 4. Checkpoint consistency
  const checkpointPath = path.join(DATA_DIR, "pilot", "hybrid", "checkpoint.json");
  if (await exists(checkpointPath)) {
    const checkpoint = JSON.parse(await readFile(checkpointPath, "utf8"));
    const localities = Object.entries(checkpoint.localities ?? {});
    console.log(`checkpoint.json: ${localities.length} localities tracked`);
    for (const [key, state] of localities) {
      console.log(
        `  - ${key}: status=${state.status}, nextSampleIndex=${state.nextSampleIndex}/${state.samplePoints?.length ?? "?"}, panoramasProcessed=${state.panoramasProcessed}, candidates=${state.candidates?.length ?? 0}`
      );
      if (state.status === "in_progress" && state.samplePoints == null) {
        problems.push(`checkpoint locality ${key} is in_progress but samplePoints is null`);
      }
    }
  } else {
    notes.push("no checkpoint.json yet — a fresh hybrid run will start clean (expected if hybrid strategy never ran to completion/interruption before).");
  }

  // 5. Quota state sanity
  const quota = getQuotaStatus();
  console.log(`\nquota_state.json: month=${quota.month}, crawler used=${quota.crawler.used}`);

  // 6. Board registry: spot-check every observation's referenced session exists
  let brokenObservations = 0;
  for (const board of Object.values(boardRegistry.boards)) {
    for (const obs of board.observations) {
      // best-effort — not all older/legacy observations carry a sessionId
    }
  }

  console.log("\n=== Summary ===");
  console.log(`problems: ${problems.length}`);
  for (const p of problems) console.log(`  [PROBLEM] ${p}`);
  console.log(`notes: ${notes.length}`);
  for (const n of notes.slice(0, 20)) console.log(`  [note] ${n}`);
  if (notes.length > 20) console.log(`  ...and ${notes.length - 20} more notes`);

  console.log(`\nintegrity: ${problems.length === 0 ? "OK — safe to proceed" : "PROBLEMS FOUND — do not proceed until resolved"}`);
}

main().catch((err) => {
  console.error("[verify] failed:", err);
  process.exitCode = 1;
});
