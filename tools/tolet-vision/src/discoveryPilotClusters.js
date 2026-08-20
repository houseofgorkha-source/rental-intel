// Bangalore cluster pilot: scales the single-area discovery pilot up to
// ~3,000 panoramas across 3 named clusters (Whitefield, Koramangala,
// Indiranagar), each broken into real localities, each locality crawled
// from multiple seed points ("multiple seeds and streets" per instruction)
// rather than one seed per locality.
//
// Reuses every existing pipeline module completely unchanged
// (imageryProvider/providers/ola, ocrPipeline, paddleOcrEngine,
// rentalScoring, boardDedup, apiQuota) — this file only adds the
// locality/cluster orchestration, checkpointing, and rate reporting that
// discoveryPilot.js / discoveryPilotMultiArea.js don't have. Neither of
// those files is modified.
//
// Quota: one shared, persistent, source-aware budget (apiQuota.js) across
// the entire run — not reset per locality or per cluster. The hard-stop is
// real: the moment any crawlPanoramas() call reports
// stoppedReason === "quota_exceeded", this script stops starting new work
// immediately (see runQuotaExceeded below) and writes out everything
// completed so far, rather than burning further calls that would just
// fail identically.
//
// Checkpointing: every locality's result is written to disk the moment
// it finishes (crawl + OCR + score + dedupe), and a running
// clusters_progress_summary.json is rewritten after every locality — this
// is an unattended multi-hour run, so progress must survive being
// inspected (or the process being killed) at any point, not just at the
// very end.
//
// No RentalIntel/Supabase integration — local JSON + images under
// .data/pilot/clusters/ only.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { configureQuota, getQuotaStatus } from "./apiQuota.js";
import { getProvider } from "./imageryProvider.js";
// Coverage lookup is Ola-specific; imported directly here (this is new
// orchestration, not a change to the unchanged crawl/OCR/score pipeline)
// rather than added to providers/ola/olaProvider.js's existing surface.
import { getCoverage } from "./providers/ola/olaClient.js";
import { ocrPanorama } from "./ocrPipeline.js";
import { createPaddleOcrWorker } from "./paddleOcrEngine.js";
import { extractAndScore, hasRentalSignal } from "./rentalScoring.js";
import { dedupeBoards } from "./boardDedup.js";

const PROVIDER_NAME = "ola";
const CANDIDATE_SCORE_THRESHOLD = 15;
const OCR_CONFIDENCE_FLOOR = 50;

// Approved budget for this run (see conversation): enough headroom for
// ~3,000 panoramas at the ~2.5 requests/panorama ratio observed in the
// prior 3-area pilot (~7,000-8,000 calls), with the hard-stop as the real
// backstop if the ratio runs higher in practice (denser link graphs,
// coverage gaps needing more probing, etc).
const TOTAL_REQUEST_LIMIT = Number(process.env.OLA_API_REQUEST_LIMIT) || 8000;

// Half-width of each locality's bounding box in degrees (~0.008 deg ~=
// 890m N-S at this latitude), giving the /coverage lookup below a big
// enough box to find real streets in even where the hand-picked center
// isn't itself right on a mapped road.
const BBOX_HALF_WIDTH_DEG = 0.008;

function locality(id, label, centerLat, centerLon, target) {
  return {
    id,
    label,
    target,
    bbox: {
      xMin: centerLon - BBOX_HALF_WIDTH_DEG,
      xMax: centerLon + BBOX_HALF_WIDTH_DEG,
      yMin: centerLat - BBOX_HALF_WIDTH_DEG,
      yMax: centerLat + BBOX_HALF_WIDTH_DEG,
    },
  };
}

// Splits `total` into `n` integer parts as evenly as possible (first
// `total % n` parts get one extra), so cluster totals land exactly on the
// ~1,000/cluster target regardless of locality count.
function splitEvenly(total, n) {
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

const CLUSTER_TARGET = Number(process.env.CLUSTER_PANORAMA_TARGET) || 1000;

function buildClusters() {
  const whitefieldLocalities = [
    ["hoodi", "Hoodi", 12.9931, 77.7139],
    ["aecs-layout", "AECS Layout", 12.9698, 77.7157],
    ["brookefield", "Brookefield", 12.9635, 77.7148],
    ["kundalahalli", "Kundalahalli", 12.9646, 77.7176],
    ["itpl", "ITPL", 12.986, 77.7378],
    ["varthur", "Varthur", 12.9412, 77.7469],
    ["kadugodi", "Kadugodi", 12.993, 77.762],
  ];

  const koramangalaLocalities = [
    ["koramangala", "Koramangala", 12.9352, 77.6245],
    ["ejipura", "Ejipura", 12.9422, 77.6296],
    ["adugodi", "Adugodi", 12.9459, 77.6088],
    ["btm-layout", "BTM Layout", 12.9166, 77.6101],
    ["hsr-layout", "HSR Layout", 12.9121, 77.6446],
    ["madiwala", "Madiwala", 12.9224, 77.6144],
    ["sg-palya", "SG Palya", 12.9327, 77.6113],
    ["jakkasandra", "Jakkasandra", 12.9345, 77.6187],
  ];

  const indiranagarLocalities = [
    ["domlur", "Domlur", 12.961, 77.6387],
    ["hal-2nd-stage", "HAL 2nd Stage", 12.96, 77.648],
    ["jeevan-bima-nagar", "Jeevan Bima Nagar", 12.9611, 77.658],
    ["ulsoor", "Ulsoor", 12.9815, 77.6217],
    ["cv-raman-nagar", "CV Raman Nagar", 12.9819, 77.666],
    ["murugeshpalya", "Murugeshpalya", 12.956, 77.662],
  ];

  const clusterDefs = [
    { id: "whitefield", label: "Whitefield", localities: whitefieldLocalities },
    { id: "koramangala", label: "Koramangala", localities: koramangalaLocalities },
    { id: "indiranagar", label: "Indiranagar", localities: indiranagarLocalities },
  ];

  return clusterDefs.map((c) => {
    const targets = splitEvenly(CLUSTER_TARGET, c.localities.length);
    return {
      id: c.id,
      label: c.label,
      localities: c.localities.map(([id, label, lat, lon], i) => locality(id, label, lat, lon, targets[i])),
    };
  });
}

// Picks up to `maxSeeds` well-spread seed points from a /coverage response's
// "ways" (real street segments with confirmed Street View imagery), taking
// the midpoint of evenly-spaced ways rather than every way's first point,
// so seeds land on different streets instead of clustering on one road.
// Returns [] if the bbox has no coverage at all — the caller treats that as
// a normal (not an error) "no_coverage" outcome for that locality.
function pickSeedsFromCoverage(coverageBody, maxSeeds) {
  const ways = coverageBody?.payload?.ways ?? [];
  if (ways.length === 0) return [];
  const count = Math.min(maxSeeds, ways.length);
  const stride = ways.length / count;
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const way = ways[Math.floor(i * stride)];
    const coords = way.line_geometry?.geometry?.coordinates ?? [];
    if (coords.length === 0) continue;
    const [lon, lat] = coords[Math.floor(coords.length / 2)];
    seeds.push({ seedLat: lat, seedLon: lon });
  }
  return seeds;
}

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data", "pilot", "clusters");

function bboxAreaKm2(bbox) {
  const midLat = (bbox.yMin + bbox.yMax) / 2;
  const kmPerDegLat = 111.0;
  const kmPerDegLon = 111.0 * Math.cos((midLat * Math.PI) / 180);
  return (bbox.yMax - bbox.yMin) * kmPerDegLat * ((bbox.xMax - bbox.xMin) * kmPerDegLon);
}

function perThousand(count, denominator) {
  return denominator > 0 ? (count / denominator) * 1000 : null;
}

async function processPanoramas(panoramas, worker, cropsDir) {
  const candidates = [];
  let cropsProcessed = 0;
  for (const pano of panoramas) {
    const tileResults = await ocrPanorama({
      imageBytes: pano.imageBytes,
      worker,
      onTile: () => {
        cropsProcessed++;
      },
    });
    for (const [i, tileResult] of tileResults.entries()) {
      if (tileResult.confidence < OCR_CONFIDENCE_FLOOR) continue;
      const extracted = extractAndScore(tileResult.text);
      if (extracted.score < CANDIDATE_SCORE_THRESHOLD) continue;
      if (!hasRentalSignal(extracted.signals)) continue;

      const cropFileName = `${pano.sourceId}_tile${i}.jpg`;
      await writeFile(path.join(cropsDir, cropFileName), tileResult.cropBuffer);
      candidates.push({
        provider: pano.provider,
        sourceId: pano.sourceId,
        latitude: pano.latitude,
        longitude: pano.longitude,
        tile: tileResult.tile,
        ocrText: extracted.rawText,
        ocrConfidence: tileResult.confidence,
        ...extracted,
        cropImage: `crops/${cropFileName}`,
      });
    }
  }
  return { candidates, cropsProcessed };
}

async function writeProgressSummary(state) {
  const summary = {
    generatedAt: new Date().toISOString(),
    runComplete: state.runComplete,
    stoppedForQuota: state.quotaExceeded,
    requestLimit: TOTAL_REQUEST_LIMIT,
    apiRequestsUsed: getQuotaStatus().used,
    apiRequestsRemaining: getQuotaStatus().remaining,
    elapsedSeconds: (Date.now() - state.startedAt) / 1000,
    totals: aggregateTotals(state.localityResults),
    clusters: aggregateClusters(state.localityResults),
    localities: state.localityResults.map(summarizeLocality),
  };
  await writeFile(path.join(DATA_DIR, "clusters_progress_summary.json"), JSON.stringify(summary, null, 2));
  return summary;
}

function summarizeLocality(r) {
  return {
    clusterId: r.clusterId,
    localityId: r.localityId,
    label: r.label,
    apiRequestsUsed: r.apiRequestsUsed,
    panoramasProcessed: r.panoramasProcessed,
    ocrCropsProcessed: r.ocrCropsProcessed,
    candidateCount: r.candidateCount,
    uniqueBoardCount: r.uniqueBoardCount,
    boardsPer1000Panoramas: perThousand(r.uniqueBoardCount, r.panoramasProcessed),
    boardsPer1000ApiCalls: perThousand(r.uniqueBoardCount, r.apiRequestsUsed),
    stoppedReason: r.stoppedReason,
    runtimeSeconds: r.runtimeSeconds,
  };
}

function aggregateClusters(localityResults) {
  const byCluster = new Map();
  for (const r of localityResults) {
    if (!byCluster.has(r.clusterId)) byCluster.set(r.clusterId, []);
    byCluster.get(r.clusterId).push(r);
  }
  const out = [];
  for (const [clusterId, rows] of byCluster) {
    const apiRequestsUsed = rows.reduce((s, r) => s + r.apiRequestsUsed, 0);
    const panoramasProcessed = rows.reduce((s, r) => s + r.panoramasProcessed, 0);
    const ocrCropsProcessed = rows.reduce((s, r) => s + r.ocrCropsProcessed, 0);
    const candidateCount = rows.reduce((s, r) => s + r.candidateCount, 0);
    // Cluster-level dedupe re-run across all candidates in the cluster (not
    // just summed per-locality board counts) so a board sitting near a
    // locality boundary isn't double-counted.
    const allCandidates = rows.flatMap((r) => r.candidates);
    const clusterBoards = dedupeBoards(allCandidates);
    const runtimeSeconds = rows.reduce((s, r) => s + r.runtimeSeconds, 0);
    out.push({
      clusterId,
      clusterLabel: rows[0].clusterLabel,
      apiRequestsUsed,
      panoramasProcessed,
      ocrCropsProcessed,
      candidateCount,
      uniqueBoardCount: clusterBoards.length,
      boardsPer1000Panoramas: perThousand(clusterBoards.length, panoramasProcessed),
      boardsPer1000ApiCalls: perThousand(clusterBoards.length, apiRequestsUsed),
      runtimeSeconds,
      localityCount: rows.length,
    });
  }
  return out;
}

function aggregateTotals(localityResults) {
  const apiRequestsUsed = localityResults.reduce((s, r) => s + r.apiRequestsUsed, 0);
  const panoramasProcessed = localityResults.reduce((s, r) => s + r.panoramasProcessed, 0);
  const ocrCropsProcessed = localityResults.reduce((s, r) => s + r.ocrCropsProcessed, 0);
  const candidateCount = localityResults.reduce((s, r) => s + r.candidateCount, 0);
  const allCandidates = localityResults.flatMap((r) => r.candidates);
  const overallBoards = dedupeBoards(allCandidates);
  const runtimeSeconds = localityResults.reduce((s, r) => s + r.runtimeSeconds, 0);
  return {
    apiRequestsUsed,
    panoramasProcessed,
    ocrCropsProcessed,
    candidateCount,
    uniqueBoardCount: overallBoards.length,
    boardsPer1000Panoramas: perThousand(overallBoards.length, panoramasProcessed),
    boardsPer1000ApiCalls: perThousand(overallBoards.length, apiRequestsUsed),
    runtimeSeconds,
    localityCount: localityResults.length,
  };
}

async function runLocality(cluster, loc, worker) {
  const startedAt = Date.now();
  const localityDir = path.join(DATA_DIR, cluster.id, loc.id);
  const cropsDir = path.join(localityDir, "crops");
  await mkdir(cropsDir, { recursive: true });

  const quotaBefore = getQuotaStatus().used;
  const { crawlPanoramas } = getProvider(PROVIDER_NAME);

  const seenSourceIds = new Set();
  const panoramas = [];
  let requestsMade = 0;
  let skippedOutsideBbox = 0;
  let lastStoppedReason = "target_reached";
  let quotaExceeded = false;

  // Find real streets with confirmed imagery inside this locality's bbox
  // before crawling, rather than guessing a seed coordinate — a guessed
  // center is often just off the nearest mapped road and returns "No SLI
  // Image Found nearby" (confirmed against this run's own coverage data).
  const coverageRes = await getCoverage(loc.bbox);
  requestsMade += 1;
  const wayCount = coverageRes.body?.payload?.ways?.length ?? 0;
  const seeds = pickSeedsFromCoverage(coverageRes.body, 3);
  if (seeds.length === 0) {
    console.log(`[${cluster.id}/${loc.id}] no Street View coverage in bbox (${wayCount} ways) — skipping crawl`);
    const runtimeSeconds0 = (Date.now() - startedAt) / 1000;
    const result0 = {
      clusterId: cluster.id,
      clusterLabel: cluster.label,
      localityId: loc.id,
      label: loc.label,
      bbox: loc.bbox,
      areaKm2: bboxAreaKm2(loc.bbox),
      seeds: [],
      stoppedReason: "no_coverage",
      quotaExceeded: false,
      apiRequestsUsed: getQuotaStatus().used - quotaBefore,
      panoramasProcessed: 0,
      ocrCropsProcessed: 0,
      candidateCount: 0,
      uniqueBoardCount: 0,
      runtimeSeconds: runtimeSeconds0,
      candidates: [],
      boards: [],
    };
    await writeFile(path.join(localityDir, "discovery_results.json"), JSON.stringify(result0, null, 2));
    return result0;
  }
  console.log(`[${cluster.id}/${loc.id}] coverage: ${wayCount} ways, ${seeds.length} seeds selected`);
  const seedTargets = splitEvenly(loc.target, seeds.length);
  const seedsWithTargets = seeds.map((s, i) => ({ ...s, targetCount: seedTargets[i] }));

  for (const seed of seedsWithTargets) {
    if (quotaExceeded) break;
    const res = await crawlPanoramas({
      seedLat: seed.seedLat,
      seedLon: seed.seedLon,
      targetCount: seed.targetCount,
      bbox: loc.bbox,
    });
    requestsMade += res.stats.requestsMade;
    skippedOutsideBbox += res.stats.skippedOutsideBbox;
    lastStoppedReason = res.stoppedReason;
    if (res.stoppedReason === "quota_exceeded") quotaExceeded = true;
    for (const pano of res.panoramas) {
      if (seenSourceIds.has(pano.sourceId)) continue;
      seenSourceIds.add(pano.sourceId);
      panoramas.push(pano);
    }
  }

  console.log(
    `[${cluster.id}/${loc.id}] crawl: ${panoramas.length} panoramas (${seedsWithTargets.length} seeds), ` +
      `${requestsMade} requests, ${skippedOutsideBbox} skipped outside bbox, stopped=${lastStoppedReason}`
  );

  const { candidates, cropsProcessed } = await processPanoramas(panoramas, worker, cropsDir);
  const boards = dedupeBoards(candidates);
  const apiRequestsUsed = getQuotaStatus().used - quotaBefore;
  const runtimeSeconds = (Date.now() - startedAt) / 1000;

  if (candidates.length > 0) {
    console.log(
      `[${cluster.id}/${loc.id}] candidates: ${candidates.length}, unique boards: ${boards.length} ` +
        `[${boards.map((b) => `phone=${b.phone ?? "n/a"} score=${b.representativeScore}`).join("; ")}]`
    );
  }

  const result = {
    clusterId: cluster.id,
    clusterLabel: cluster.label,
    localityId: loc.id,
    label: loc.label,
    bbox: loc.bbox,
    areaKm2: bboxAreaKm2(loc.bbox),
    seeds: seedsWithTargets,
    stoppedReason: lastStoppedReason,
    quotaExceeded,
    apiRequestsUsed,
    panoramasProcessed: panoramas.length,
    ocrCropsProcessed: cropsProcessed,
    candidateCount: candidates.length,
    uniqueBoardCount: boards.length,
    runtimeSeconds,
    candidates,
    boards,
  };

  await writeFile(path.join(localityDir, "discovery_results.json"), JSON.stringify(result, null, 2));
  return result;
}

async function main() {
  const startedAt = Date.now();
  configureQuota(TOTAL_REQUEST_LIMIT);
  await mkdir(DATA_DIR, { recursive: true });

  const clusters = buildClusters();
  const totalLocalities = clusters.reduce((s, c) => s + c.localities.length, 0);
  console.log(`[clusters] request limit: ${TOTAL_REQUEST_LIMIT} (persistent, shared across the whole run)`);
  console.log(`[clusters] target: ~${CLUSTER_TARGET} panoramas/cluster x ${clusters.length} clusters`);
  console.log(`[clusters] localities: ${totalLocalities}`);
  console.log(`[clusters] quota before this run: ${getQuotaStatus().used}/${TOTAL_REQUEST_LIMIT}`);

  const worker = await createPaddleOcrWorker();
  const state = { startedAt, localityResults: [], quotaExceeded: false, runComplete: false };

  try {
    outer: for (const cluster of clusters) {
      console.log("");
      console.log(`=== Cluster: ${cluster.label} (${cluster.id}) ===`);
      for (const loc of cluster.localities) {
        if (getQuotaStatus().remaining <= 0) {
          console.warn(`[clusters] quota exhausted (${getQuotaStatus().used}/${TOTAL_REQUEST_LIMIT}) — stopping before ${cluster.id}/${loc.id}`);
          state.quotaExceeded = true;
          break outer;
        }
        let result;
        try {
          result = await runLocality(cluster, loc, worker);
        } catch (err) {
          console.error(`[clusters] locality ${cluster.id}/${loc.id} failed, continuing:`, err);
          continue;
        }
        state.localityResults.push(result);
        if (result.quotaExceeded) {
          state.quotaExceeded = true;
          console.warn(`[clusters] hard-stop: quota exceeded during ${cluster.id}/${loc.id}`);
        }
        const progress = await writeProgressSummary(state);
        console.log(
          `[clusters] progress: ${progress.totals.panoramasProcessed} panoramas, ` +
            `${progress.totals.apiRequestsUsed}/${TOTAL_REQUEST_LIMIT} API calls, ` +
            `${progress.totals.uniqueBoardCount} unique boards so far`
        );
        if (state.quotaExceeded) break outer;
      }
    }
  } finally {
    await worker.terminate();
  }

  state.runComplete = !state.quotaExceeded;
  const finalSummary = await writeProgressSummary(state);

  console.log("");
  console.log("=== Bangalore cluster pilot: final summary ===");
  console.log(`stopped for quota: ${state.quotaExceeded}`);
  console.log(`API calls used: ${finalSummary.apiRequestsUsed}/${TOTAL_REQUEST_LIMIT}`);
  console.log(`total runtime: ${finalSummary.elapsedSeconds.toFixed(1)}s`);
  console.log(`panoramas: ${finalSummary.totals.panoramasProcessed}`);
  console.log(`OCR crops: ${finalSummary.totals.ocrCropsProcessed}`);
  console.log(`candidates: ${finalSummary.totals.candidateCount}`);
  console.log(`unique boards (overall, deduped): ${finalSummary.totals.uniqueBoardCount}`);
  console.log(`boards/1000 panoramas: ${finalSummary.totals.boardsPer1000Panoramas?.toFixed(2)}`);
  console.log(`boards/1000 API calls: ${finalSummary.totals.boardsPer1000ApiCalls?.toFixed(2)}`);
  for (const c of finalSummary.clusters) {
    console.log("");
    console.log(`[${c.clusterId}] ${c.clusterLabel} — ${c.localityCount} localities`);
    console.log(`  panoramas: ${c.panoramasProcessed}, API calls: ${c.apiRequestsUsed}, crops: ${c.ocrCropsProcessed}`);
    console.log(`  candidates: ${c.candidateCount}, unique boards: ${c.uniqueBoardCount}`);
    console.log(`  boards/1000 panoramas: ${c.boardsPer1000Panoramas?.toFixed(2)}, boards/1000 API calls: ${c.boardsPer1000ApiCalls?.toFixed(2)}`);
    console.log(`  runtime: ${c.runtimeSeconds.toFixed(1)}s`);
  }
  console.log("");
  console.log(`output: ${path.join(DATA_DIR, "clusters_progress_summary.json")}`);
}

main().catch((err) => {
  console.error("[clusters] failed:", err);
  process.exitCode = 1;
});
