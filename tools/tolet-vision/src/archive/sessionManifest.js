// Per-session manifest.json — the durable record of one crawl/test:
// provider, strategy, geographic scope, configuration, code version,
// limits, usage, and outcome. One manifest per session directory
// (paths.js's sessionManifestPath), created once at session start and
// updated in place as the session progresses (write-to-tmp-then-rename,
// same durability pattern as panoramaRegistry.js/apiQuota.js use
// elsewhere in this tool).
import { writeFile, mkdir, readFile, rename } from "node:fs/promises";
import { execSync } from "node:child_process";
import { sessionDir, sessionManifestPath } from "./paths.js";

function currentCommit() {
  try {
    return execSync("git rev-parse HEAD", { cwd: import.meta.dirname, encoding: "utf8" }).trim();
  } catch {
    return null; // not fatal — a manifest without a resolvable commit still records everything else
  }
}

// Fields match the spec exactly: provider, session ID, strategy,
// start/end time, geographic scope, configuration, code/version/commit,
// API limits, API usage, runtime, panorama/tile/OCR/candidate/unique-board
// counts, errors, stop reason. `migrated` distinguishes a manifest
// synthesized from pre-archive data (see archiveMigrateExisting.js) from
// a real live session — migrated manifests leave several of these fields
// explicitly null rather than guessing, and say why in `notes`. Live
// sessions use the same `notes` array for anything worth flagging (e.g.
// "per-request cost unknown, not guessed").
export function newManifest({ provider, sessionId, strategy, geographicScope = null, configuration = null, apiLimits = null, migrated = false }) {
  return {
    provider,
    sessionId,
    strategy,
    startTime: new Date().toISOString(),
    endTime: null,
    geographicScope,
    configuration,
    codeCommit: currentCommit(),
    apiLimits,
    apiUsage: { requestsBySource: {}, billableRequests: 0, nonBillableRequests: 0, estimatedCostUsd: 0 },
    runtimeMs: null,
    panoramaCount: 0,
    tileCount: 0,
    ocrCount: 0,
    candidateCount: 0,
    uniqueBoardCount: 0,
    errors: [],
    stopReason: null,
    migrated,
    notes: [],
  };
}

export async function saveManifest(manifest) {
  const dir = sessionDir(manifest.provider.toLowerCase(), manifest.sessionId);
  await mkdir(dir, { recursive: true });
  const filePath = sessionManifestPath(manifest.provider.toLowerCase(), manifest.sessionId);
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, JSON.stringify(manifest, null, 2));
  await rename(tmpPath, filePath);
  return filePath;
}

export async function loadManifest(provider, sessionId) {
  const filePath = sessionManifestPath(provider, sessionId);
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export function finalizeManifest(manifest, { stopReason, errors = [] }) {
  manifest.endTime = new Date().toISOString();
  manifest.runtimeMs = new Date(manifest.endTime) - new Date(manifest.startTime);
  manifest.stopReason = stopReason;
  manifest.errors.push(...errors);
  return manifest;
}
