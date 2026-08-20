// Append-only, per-session API request ledger (requests.jsonl — one JSON
// object per line, never rewritten in place) — the complete, immutable
// record of every request a session makes. Deliberately separate from
// apiQuota.js: that module enforces Ola's live crawler budget in-process;
// this module is a durable audit log, provider-agnostic, and is never
// consulted to decide whether a request is allowed — only to record that
// it happened. Google usage is never written into apiQuota.js's counters
// (see providers/google/googleClient.js's own header comment) — this
// ledger is where Google's request history actually lives.
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { sessionDir, sessionRequestsLedgerPath } from "./paths.js";

// record fields match the spec: provider, session, timestamp, endpoint,
// purpose, panoramaId, success, httpStatus, retryCount, latencyMs,
// billable, estimatedUnitCostUsd, estimatedCostUsd, quotaCategory.
export async function appendRequest(provider, sessionId, record) {
  const dir = sessionDir(provider, sessionId);
  await mkdir(dir, { recursive: true });
  const line =
    JSON.stringify({
      provider,
      session: sessionId,
      timestamp: new Date().toISOString(),
      endpoint: record.endpoint,
      purpose: record.purpose ?? null,
      panoramaId: record.panoramaId ?? null,
      success: record.success,
      httpStatus: record.httpStatus ?? null,
      retryCount: record.retryCount ?? 0,
      latencyMs: record.latencyMs ?? null,
      billable: record.billable,
      estimatedUnitCostUsd: record.estimatedUnitCostUsd ?? 0,
      estimatedCostUsd: record.estimatedCostUsd ?? 0,
      quotaCategory: record.quotaCategory ?? null,
    }) + "\n";
  await appendFile(sessionRequestsLedgerPath(provider, sessionId), line);
}

export async function readLedger(provider, sessionId) {
  try {
    const raw = await readFile(sessionRequestsLedgerPath(provider, sessionId), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}
