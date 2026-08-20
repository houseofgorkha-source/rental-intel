// Aggregate cost/usage rollups (cost_registry.json) — computed from
// session manifests' apiUsage summaries (cheap, always available) rather
// than re-reading every session's full requests.jsonl ledger every time
// (possible later if per-request granularity is ever needed, but the
// manifest-level summary is what every rollup below actually needs).
// Rebuilt from scratch on every call — this file is a derived view, not a
// second source of truth, so there's no incremental-update bug class to
// worry about.
import { writeFile, mkdir, readFile, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { REGISTRY_DIR, COST_REGISTRY_PATH, IMAGERY_ROOT } from "./paths.js";

async function listSessionManifests() {
  const manifests = [];
  let providers;
  try {
    providers = await readdir(IMAGERY_ROOT, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return manifests;
    throw err;
  }
  for (const providerEntry of providers) {
    if (!providerEntry.isDirectory() || providerEntry.name === "registry") continue;
    const sessionsPath = path.join(IMAGERY_ROOT, providerEntry.name, "sessions");
    let sessions;
    try {
      sessions = await readdir(sessionsPath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const sessionEntry of sessions) {
      if (!sessionEntry.isDirectory()) continue;
      const manifestPath = path.join(sessionsPath, sessionEntry.name, "manifest.json");
      try {
        manifests.push(JSON.parse(await readFile(manifestPath, "utf8")));
      } catch {
        // missing/unreadable manifest — skip rather than fail the whole rollup
      }
    }
  }
  return manifests;
}

function dayKey(iso) {
  return iso ? iso.slice(0, 10) : "unknown";
}
function monthKey(iso) {
  return iso ? iso.slice(0, 7) : "unknown";
}

function bump(map, key, cost, requests) {
  const entry = map[key] ?? { estimatedCostUsd: 0, requests: 0 };
  entry.estimatedCostUsd += cost;
  entry.requests += requests;
  map[key] = entry;
}

export async function recomputeCostRegistry() {
  const manifests = await listSessionManifests();
  const registry = {
    version: 1,
    updatedAt: new Date().toISOString(),
    bySession: {},
    byProvider: {},
    byStrategy: {},
    byDay: {},
    byMonth: {},
    total: { estimatedCostUsd: 0, requests: 0 },
    sessionsIncluded: manifests.length,
  };

  for (const m of manifests) {
    const cost = m.apiUsage?.estimatedCostUsd ?? 0;
    const requests = (m.apiUsage?.billableRequests ?? 0) + (m.apiUsage?.nonBillableRequests ?? 0);
    registry.bySession[m.sessionId] = { provider: m.provider, strategy: m.strategy, estimatedCostUsd: cost, requests, migrated: !!m.migrated };
    bump(registry.byProvider, m.provider, cost, requests);
    bump(registry.byStrategy, `${m.provider}:${m.strategy}`, cost, requests);
    bump(registry.byDay, dayKey(m.startTime), cost, requests);
    bump(registry.byMonth, monthKey(m.startTime), cost, requests);
    registry.total.estimatedCostUsd += cost;
    registry.total.requests += requests;
  }

  await mkdir(REGISTRY_DIR, { recursive: true });
  const tmpPath = `${COST_REGISTRY_PATH}.tmp`;
  await writeFile(tmpPath, JSON.stringify(registry, null, 2));
  await rename(tmpPath, COST_REGISTRY_PATH);
  return registry;
}
