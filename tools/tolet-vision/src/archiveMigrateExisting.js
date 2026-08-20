// One-time, re-runnable migration: inventories everything the tool has
// already produced (panoramaRegistry.js's fully-reconciled Ola registry,
// on-disk crop images, the handful of standalone diagnostic panorama
// JPGs, and apiQuota.js's usage log) and imports it into the new durable
// archive (.data/imagery/**) WITHOUT downloading anything new and WITHOUT
// moving, copying wholesale, or deleting any existing file.
//
// Read-only against every source it touches. Additive-only against the
// archive (new files under .data/imagery/ only). Never modifies
// .data/pilot/**, panoramaRegistry.js's own storage, apiQuota.js's
// storage, or Supabase.
//
// Honesty is the point of this script, not completeness: most historical
// Ola panoramas were only ever held in memory long enough to OCR (see the
// reconciliation report's rawImageAvailable counts) — this migration does
// not pretend otherwise, and it does not fabricate per-session API usage
// that the original apiQuota.js log never recorded at that granularity.
import { readFile, readdir, mkdir, writeFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { loadRegistry, registryStats } from "./panoramaRegistry.js";
import { readImageDimensions } from "./providers/ola/olaClient.js";
import { legacySessionId } from "./archive/sessionId.js";
import { newManifest, saveManifest } from "./archive/sessionManifest.js";
import { loadImageRegistry, saveImageRegistry, upsertImage, imageRegistryStats } from "./archive/imageRegistry.js";
import { loadBoardRegistry, saveBoardRegistry, upsertBoardObservation, boardRegistryStats } from "./archive/boardRegistry.js";
import { loadDedupRegistry, saveDedupRegistry, addRelationship, dedupRegistryStats } from "./archive/dedupRegistry.js";
import { recomputeCostRegistry } from "./archive/costRegistry.js";
import { REGISTRY_DIR } from "./archive/paths.js";

const TOLET_VISION_ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(TOLET_VISION_ROOT, ".data");

// ---- Step 1: read-only inventory of raw image files on disk ------------

const RAW_IMAGE_DIRS = [
  "diagnostic_panoramas",
  "recall_test_panoramas",
  "positive_control",
  "dewarp_test",
]; // directories observed (by inspection) to hold full panorama JPGs, not OCR crops

async function walkFiles(dir, results = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(full, results);
    else results.push(full);
  }
  return results;
}

const HEX_ID_RE = /([0-9a-f]{24,40})/i;

// Full raw panoramas are named exactly `<imageId>.jpg` at the top level of
// one of RAW_IMAGE_DIRS (confirmed by inspection: diagnostic/recall
// panorama filenames are bare imageId.jpg, unlike crop filenames which
// carry a `_tileN` suffix). Matched only against this narrower pattern so
// crop images are never mistaken for full panoramas.
async function inventoryRawPanoramaFiles() {
  const found = new Map(); // imageId -> { path, sizeBytes }
  for (const dirName of RAW_IMAGE_DIRS) {
    const dir = path.join(DATA_DIR, dirName);
    const files = await walkFiles(dir);
    for (const filePath of files) {
      const base = path.basename(filePath, path.extname(filePath));
      if (/^[0-9a-f]{24,40}$/i.test(base)) {
        if (!found.has(base)) {
          const st = await stat(filePath);
          found.set(base, { path: filePath, sizeBytes: st.size });
        }
      }
    }
  }
  // The one loose top-level file from the very first single-coordinate test.
  const loose = path.join(DATA_DIR, "1379913d1fa7a924792b5cba607a1eb7.jpg");
  try {
    const st = await stat(loose);
    const base = "1379913d1fa7a924792b5cba607a1eb7";
    if (!found.has(base)) found.set(base, { path: loose, sizeBytes: st.size });
  } catch {
    /* not present — fine */
  }
  return found;
}

// Crop images (OCR tile crops for accepted candidates only) live under
// .data/pilot/**/crops/*.jpg, named `${sourceId}_tile${i}.jpg` (hybrid) or
// an equivalent convention in the older strategies. Indexed by the hex ID
// embedded in the filename so a board observation's sourceId can be
// matched back to its crop file without needing to know which strategy
// directory produced it.
async function inventoryCropFiles() {
  const pilotDir = path.join(DATA_DIR, "pilot");
  const allFiles = await walkFiles(pilotDir);
  const cropsByImageId = new Map(); // imageId -> [ { path, sizeBytes } ]
  for (const filePath of allFiles) {
    if (!filePath.endsWith(".jpg")) continue;
    if (!path.dirname(filePath).endsWith("crops")) continue;
    const match = path.basename(filePath).match(HEX_ID_RE);
    if (!match) continue;
    const imageId = match[1];
    if (!cropsByImageId.has(imageId)) cropsByImageId.set(imageId, []);
    cropsByImageId.get(imageId).push(filePath);
  }
  return cropsByImageId;
}

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

// ---- Step 2: group registry records into synthetic legacy sessions -----
//
// `hybrid_spatial`/`hybrid_expansion` records carry a genuine per-process
// `run` tag (discoveryPilotHybrid.js computes one run ID per invocation)
// — that IS a real session boundary, so those are grouped by `run`.
//
// `bfs_cluster`/`bfs_multiarea`/`bfs_single` records were all backfilled
// into the registry after the fact by inventoryExistingRuns.js, under a
// synthetic `inventory-<timestamp of the backfill script's own run>` tag
// — that tag reflects when the backfill happened, not when the original
// crawl ran, so it is NOT a meaningful session boundary. Those are
// grouped by `source` instead, collapsing across backfill invocations.
function sessionGroupKeyFor(record) {
  if (record.source === "hybrid_spatial" || record.source === "hybrid_expansion") {
    return { groupKey: record.run, strategy: "hybrid", realSessionBoundary: true };
  }
  return { groupKey: record.source, strategy: record.source, realSessionBoundary: false };
}

async function buildLegacySessions(registry) {
  const groups = new Map(); // groupKey -> { strategy, realSessionBoundary, imageIds: [], localities: Set, timestamps: [] }

  for (const [imageId, rec] of Object.entries(registry.seenImageIds)) {
    const { groupKey, strategy, realSessionBoundary } = sessionGroupKeyFor(rec);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, { strategy, realSessionBoundary, imageIds: [], localities: new Set(), timestamps: [] });
    }
    const g = groups.get(groupKey);
    g.imageIds.push(imageId);
    if (rec.locality) g.localities.add(rec.locality);
    if (rec.firstSeenAt) g.timestamps.push(rec.firstSeenAt);
  }

  const sessions = [];
  for (const [groupKey, g] of groups) {
    const sessionId = legacySessionId("ola", g.strategy, groupKey);
    const sortedTs = [...g.timestamps].sort();
    const manifest = newManifest({
      provider: "ola",
      sessionId,
      strategy: g.strategy,
      geographicScope: [...g.localities],
      configuration: null,
      apiLimits: null,
      migrated: true,
    });
    manifest.startTime = sortedTs[0] ?? null;
    manifest.endTime = sortedTs[sortedTs.length - 1] ?? null;
    manifest.panoramaCount = g.imageIds.length;
    manifest.apiUsage = null; // see notes[] below — not reconstructible at this granularity
    manifest.stopReason = "migrated_unknown";
    manifest.notes = g.realSessionBoundary
      ? [
          `Original per-request session boundary (run tag "${groupKey}") — panorama count and geographic scope are exact.`,
          "Per-session API usage/cost is not reconstructible: apiQuota.js's request log records only source+endpoint+timestamp, not which run/session each request belonged to.",
        ]
      : [
          `Synthetic grouping by source="${groupKey}" — the original registry tag for these records ("inventory-*") reflects when inventoryExistingRuns.js backfilled them, not the original crawl's real session boundary, which is not recoverable.`,
          "startTime/endTime above are the min/max firstSeenAt across all matching records, not the true original crawl start/end.",
          "Configuration, API limits, and per-session API usage/cost at the time of the original crawl are not reconstructible.",
        ];
    await saveManifest(manifest);
    sessions.push({ sessionId, groupKey, strategy: g.strategy, panoramaCount: g.imageIds.length, imageIds: g.imageIds, realSessionBoundary: g.realSessionBoundary });
  }
  return sessions;
}

function sessionIdForImageId(sessions, imageId) {
  const s = sessions.find((s) => s.imageIds.includes(imageId));
  return s?.sessionId ?? null;
}

// ---- Step 3: populate image_registry.json -------------------------------

async function migrateImageRegistry(registry, sessions, rawFiles, cropsByImageId) {
  const imgRegistry = await loadImageRegistry();
  let newCount = 0;
  let rawAvailableCount = 0;

  // sourceId -> boardKey, for detectionOutputRef backfill
  const sourceIdToBoardKey = new Map();
  for (const board of Object.values(registry.seenBoards)) {
    for (const obs of board.observations) sourceIdToBoardKey.set(obs.sourceId, board.key);
  }

  for (const [imageId, rec] of Object.entries(registry.seenImageIds)) {
    const raw = rawFiles.get(imageId);
    const crops = cropsByImageId.get(imageId);
    let imageWidth = null;
    let imageHeight = null;
    let fileHash = null;
    if (raw) {
      const buf = await readFile(raw.path);
      const dims = readImageDimensions(buf);
      imageWidth = dims?.width ?? null;
      imageHeight = dims?.height ?? null;
      fileHash = createHash("sha256").update(buf).digest("hex");
      rawAvailableCount++;
    }

    const entry = {
      provider: "ola",
      sourceId: imageId,
      latitude: rec.latitude,
      longitude: rec.longitude,
      captureDate: null, // Ola's metadata never exposed this (see olaProvider.js's own comment)
      metadataResponse: null, // raw metadata JSON was never persisted — only derived lat/lon/bearing/links were kept in-memory and discarded
      sourceEndpoint: "/sli/v1/streetview/metadata",
      requestTimestamp: rec.firstSeenAt,
      imageWidth,
      imageHeight,
      fileHash,
      sessionId: sessionIdForImageId(sessions, imageId),
      apiRequestId: null, // Ola's API does not expose one
      ocrOutputRef: crops ? crops[0] : null,
      detectionOutputRef: sourceIdToBoardKey.get(imageId) ?? null,
      rawImageAvailable: !!raw,
      rawImagePath: raw?.path ?? null,
      physicalLocationId: null, // no cross-provider matching pass has run yet — see dedup_registry.json
    };

    const { isNew } = upsertImage(imgRegistry, entry);
    if (isNew) newCount++;
  }

  await saveImageRegistry(imgRegistry);
  return { newCount, rawAvailableCount, stats: imageRegistryStats(imgRegistry) };
}

// ---- Step 4: populate board_registry.json + dedup_registry.json --------

async function migrateBoardAndDedupRegistries(registry, sessions) {
  const boardRegistry = await loadBoardRegistry();
  const dedupRegistry = await loadDedupRegistry();
  let observationsRecorded = 0;
  let relationshipsRecorded = 0;

  for (const board of Object.values(registry.seenBoards)) {
    let firstObs = null;
    for (const obs of board.observations) {
      const candidate = {
        provider: "ola",
        sourceId: obs.sourceId,
        latitude: obs.latitude,
        longitude: obs.longitude,
        phone: board.phone,
        bhk: board.bhk,
        rent: board.rent,
        propertyName: board.propertyName,
        score: obs.score,
        ocrConfidence: obs.ocrConfidence,
        cropImage: obs.cropImage,
      };
      const context = {
        sessionId: sessionIdForImageId(sessions, obs.sourceId),
        source: obs.source,
        locality: obs.locality,
        run: obs.run,
      };
      upsertBoardObservation(boardRegistry, candidate, context);
      observationsRecorded++;

      if (!firstObs) {
        firstObs = obs;
      } else {
        const { isNew } = addRelationship(dedupRegistry, {
          type: "same_physical_board",
          subject: { provider: "ola", sourceId: obs.sourceId },
          related: { provider: "ola", sourceId: firstObs.sourceId },
          method: "existing_boardDedup_key_reuse",
          confidence: board.phone ? "high" : "medium",
          notes: board.phone ? "matched on phone number" : "matched on rounded-coordinate bucket (~11m)",
        });
        if (isNew) relationshipsRecorded++;
      }
    }
  }

  await saveBoardRegistry(boardRegistry);
  await saveDedupRegistry(dedupRegistry);
  return { observationsRecorded, relationshipsRecorded, boardStats: boardRegistryStats(boardRegistry), dedupStats: dedupRegistryStats(dedupRegistry) };
}

// ---- Step 5: read-only Ola API usage snapshot (not attributable per-session) --

async function readOlaQuotaSnapshot() {
  const quotaPath = path.join(DATA_DIR, "quota_state.json");
  const archiveDir = path.join(DATA_DIR, "quota_archive");
  const current = JSON.parse(await readFile(quotaPath, "utf8"));
  let archived = [];
  try {
    const files = await readdir(archiveDir);
    for (const f of files) {
      const content = JSON.parse(await readFile(path.join(archiveDir, f), "utf8"));
      archived.push({ file: f, ...content });
    }
  } catch {
    /* no archive dir — fine */
  }
  return {
    currentMonth: { month: current.month, crawlerRequests: current.counters.crawler, userMapRequests: current.counters.user_map, logEntries: current.log.length },
    archivedMonths: archived.map((a) => ({ file: a.file, month: a.month, crawlerRequests: a.counters.crawler, userMapRequests: a.counters.user_map })),
    note:
      "This is an aggregate monthly total from apiQuota.js, not attributable to any individual session — the underlying log records source+endpoint+timestamp only, never a run/session identifier. Session-level apiUsage in migrated manifests is therefore null by design, not an oversight.",
  };
}

// ---- Main ----------------------------------------------------------------

async function main() {
  console.log("[archiveMigrate] step 1/6: inventorying raw image files and OCR crops (read-only)...");
  const rawFiles = await inventoryRawPanoramaFiles();
  const cropsByImageId = await inventoryCropFiles();
  console.log(`[archiveMigrate]   raw full-panorama files found: ${rawFiles.size}`);
  console.log(`[archiveMigrate]   imageIds with at least one OCR crop on disk: ${cropsByImageId.size}`);

  console.log("[archiveMigrate] step 2/6: loading existing Ola registry (read-only)...");
  const registry = await loadRegistry();
  const beforeStats = registryStats(registry);
  console.log(`[archiveMigrate]   ${beforeStats.imageIdCount} imageIds, ${beforeStats.boardCount} boards`);

  console.log("[archiveMigrate] step 3/6: synthesizing legacy session manifests...");
  const sessions = await buildLegacySessions(registry);
  console.log(`[archiveMigrate]   ${sessions.length} legacy sessions created (${sessions.filter((s) => s.realSessionBoundary).length} real boundaries, ${sessions.filter((s) => !s.realSessionBoundary).length} synthetic groupings)`);

  console.log("[archiveMigrate] step 4/6: migrating image_registry.json...");
  const imageMigration = await migrateImageRegistry(registry, sessions, rawFiles, cropsByImageId);
  console.log(`[archiveMigrate]   ${imageMigration.newCount} entries recorded, ${imageMigration.rawAvailableCount} with raw image bytes verified on disk`);

  console.log("[archiveMigrate] step 5/6: migrating board_registry.json + dedup_registry.json...");
  const boardMigration = await migrateBoardAndDedupRegistries(registry, sessions);
  console.log(`[archiveMigrate]   ${boardMigration.observationsRecorded} observations, ${boardMigration.relationshipsRecorded} dedup relationships`);

  console.log("[archiveMigrate] step 6/6: recomputing cost_registry.json + reading Ola quota snapshot...");
  const costRegistry = await recomputeCostRegistry();
  const quotaSnapshot = await readOlaQuotaSnapshot();

  const report = {
    generatedAt: new Date().toISOString(),
    sourceRegistrySnapshot: beforeStats,
    rawImageFilesFound: rawFiles.size,
    imageIdsWithOcrCropsOnDisk: cropsByImageId.size,
    legacySessions: sessions.map(({ sessionId, groupKey, strategy, panoramaCount, realSessionBoundary }) => ({ sessionId, groupKey, strategy, panoramaCount, realSessionBoundary })),
    imageRegistry: { newEntries: imageMigration.newCount, rawImageAvailable: imageMigration.rawAvailableCount, stats: imageMigration.stats },
    boardRegistry: { observationsRecorded: boardMigration.observationsRecorded, stats: boardMigration.boardStats },
    dedupRegistry: { relationshipsRecorded: boardMigration.relationshipsRecorded, stats: boardMigration.dedupStats },
    costRegistry: { sessionsIncluded: costRegistry.sessionsIncluded, total: costRegistry.total },
    olaQuotaSnapshot: quotaSnapshot,
    notReconstructible: [
      `Full-resolution panorama images for ${beforeStats.imageIdCount - imageMigration.rawAvailableCount} of ${beforeStats.imageIdCount} imageIds — the discovery pipeline (BFS/clusters/spatial/hybrid) only ever held panorama bytes in memory long enough to OCR, never wrote them to disk. Only ${imageMigration.rawAvailableCount} raw panoramas exist on disk at all, from unrelated one-off diagnostic/benchmark scripts, not the actual discovery crawls.`,
      "Per-tile OCR text/confidence for panoramas that produced zero candidates — only accepted-candidate OCR output was ever persisted (as a crop image + extracted fields), never the raw OCR pass over a panorama that found nothing.",
      "Raw Ola metadata API responses (bearing, links, full JSON) — only derived latitude/longitude were kept.",
      "Per-session (per-original-crawl) API request counts, cost, retries, latency, or HTTP status for anything before this archive existed — apiQuota.js's log has never recorded a run/session identifier per request, only source+endpoint+timestamp+running totals.",
      "True original session start/end times and configuration for the bfs_cluster/bfs_multiarea/bfs_single records — these were backfilled into the registry after the fact by inventoryExistingRuns.js under its own backfill timestamp, not tagged with the original crawl's real boundaries.",
    ],
  };

  await mkdir(REGISTRY_DIR, { recursive: true });
  const reportPath = path.join(REGISTRY_DIR, "..", "migration_reconciliation_report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log("");
  console.log("=== Archive migration: complete ===");
  console.log(`report written: ${reportPath}`);
}

main().catch((err) => {
  console.error("[archiveMigrate] failed:", err);
  process.exitCode = 1;
});
