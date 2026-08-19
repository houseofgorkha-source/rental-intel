// Quota accounting for the Ola Maps API, split by traffic source, and
// persistent across process runs — a fresh `node script.js` invocation
// must NOT reset the crawler's monthly usage back to zero, or "monthly
// limit" is meaningless (this was a real gap: the previous in-memory-only
// version reset every run, so the "124" reported for one pilot run was
// never comparable to Ola's own cumulative dashboard figure).
//
// Single choke point: every real HTTP call in providers/ola/olaClient.js
// goes through recordRequest(source, endpoint) first, so accounting can't
// be accidentally bypassed or mislabeled by a caller forgetting to check it.
//
// Design note: we do NOT assume that separate Ola API keys (if the crawler
// and RentalIntel's own user-facing traffic were ever given different keys)
// carry independent quotas — that isn't documented by Ola anywhere we've
// seen. Everything here is tracked and enforced as if crawler + user_map
// traffic draw from one shared account-level budget, which is the safe
// assumption until Ola's docs say otherwise.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

export const SOURCES = { CRAWLER: "crawler", USER_MAP: "user_map" };

export class QuotaExceededError extends Error {
  constructor(reason, detail) {
    super(`[apiQuota] crawler request blocked (${reason}): ${detail}`);
    this.name = "QuotaExceededError";
    this.reason = reason; // "crawler_limit" | "user_traffic_reserve"
  }
}

const DEFAULT_STORAGE_PATH = path.resolve(import.meta.dirname, "..", ".data", "quota_state.json");

// Derived from storagePath's directory, not a fixed constant — so
// setQuotaStoragePath() (tests) redirects the archive alongside the state
// file, and a test month rollover can never write into the real
// .data/quota_archive/ that actual crawler runs use.
function archiveDir() {
  return path.join(path.dirname(storagePath), "quota_archive");
}

const DEFAULTS = {
  crawlerLimit: Number(process.env.OLA_CRAWLER_MONTHLY_LIMIT) || 100,
  totalBudget: Number(process.env.OLA_TOTAL_MONTHLY_BUDGET) || Infinity,
  userTrafficReserve: Number(process.env.OLA_USER_TRAFFIC_RESERVE) || 0,
};

// Overridable only by tests (_setNowForTests) so month-rollover behavior can
// be verified deterministically without waiting for a real month to pass.
let now = () => new Date();
export function _setNowForTests(fn) {
  now = fn ?? (() => new Date());
}

function monthKey(date = now()) {
  // UTC, not local time — avoids the reset boundary silently shifting with
  // whatever timezone a given machine/CI runner happens to be in.
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

let storagePath = DEFAULT_STORAGE_PATH;

function emptyMonthState(month) {
  return { month, counters: { [SOURCES.CRAWLER]: 0, [SOURCES.USER_MAP]: 0 }, log: [] };
}

function readStateFile(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    console.warn(`[apiQuota] could not read/parse ${filePath} (${err.message}) — starting fresh.`);
    return null;
  }
}

function writeStateFile(filePath, data) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Runtime limits (crawlerLimit/totalBudget/userTrafficReserve) are policy,
// configured per-run from env vars or configureQuota() — not persisted.
// Only usage (counters + log) is durable.
let persisted = readStateFile(storagePath) ?? emptyMonthState(monthKey());
if (!existsSync(storagePath)) writeStateFile(storagePath, persisted);

const state = { ...DEFAULTS };

function persist() {
  writeStateFile(storagePath, persisted);
}

// Archives the just-finished month's final counts/log, then starts a fresh
// zeroed record for the new month. Called lazily — on the first read or
// write after the calendar month has actually rolled over — rather than on
// a timer, so it works correctly however long the process has been idle.
function rollOverIfNewMonth() {
  const current = monthKey();
  if (persisted.month === current) return;

  const dir = archiveDir();
  mkdirSync(dir, { recursive: true });
  writeStateFile(path.join(dir, `${persisted.month}.json`), persisted);

  persisted = emptyMonthState(current);
  persist();
}

function totalUsed() {
  return persisted.counters[SOURCES.CRAWLER] + persisted.counters[SOURCES.USER_MAP];
}

// Accepts either a plain number (legacy call shape: sets crawlerLimit only,
// budget/reserve stay at their current values — Infinity/0 by default,
// meaning no reserve constraint applies unless explicitly configured) or an
// options object for full control. Limits only — never touches persisted
// usage counters.
export function configureQuota(arg) {
  if (typeof arg === "number") {
    state.crawlerLimit = arg;
    return;
  }
  const { crawlerLimit, totalBudget, userTrafficReserve } = arg ?? {};
  if (crawlerLimit !== undefined) state.crawlerLimit = crawlerLimit;
  if (totalBudget !== undefined) state.totalBudget = totalBudget;
  if (userTrafficReserve !== undefined) state.userTrafficReserve = userTrafficReserve;
}

// Only `source: "crawler"` requests can ever be blocked here. `user_map`
// (real RentalIntel users) is tracked but never throws from this module —
// our own accounting must never be what makes a real user's map fail to
// load; the crawler is the side that has to yield.
export function recordRequest(source, endpoint) {
  rollOverIfNewMonth();

  if (source === SOURCES.CRAWLER) {
    if (persisted.counters[SOURCES.CRAWLER] >= state.crawlerLimit) {
      throw new QuotaExceededError(
        "crawler_limit",
        `crawler limit is ${state.crawlerLimit}, already used ${persisted.counters[SOURCES.CRAWLER]} this month (${persisted.month})`
      );
    }
    const reserveCeiling = state.totalBudget - state.userTrafficReserve;
    if (totalUsed() >= reserveCeiling) {
      throw new QuotaExceededError(
        "user_traffic_reserve",
        `total usage ${totalUsed()} would meet/exceed the reserve ceiling ` +
          `${reserveCeiling} (budget ${state.totalBudget} - reserve ${state.userTrafficReserve})`
      );
    }
  }

  persisted.counters[source] = (persisted.counters[source] ?? 0) + 1;
  persisted.log.push({
    source,
    endpoint,
    at: now().toISOString(),
    crawlerUsed: persisted.counters[SOURCES.CRAWLER],
    userMapUsed: persisted.counters[SOURCES.USER_MAP],
    totalUsed: totalUsed(),
  });
  persist(); // write-through on every accepted request — a killed process must not lose usage history
}

export function getQuotaStatus() {
  rollOverIfNewMonth();

  const crawlerUsed = persisted.counters[SOURCES.CRAWLER];
  const userMapUsed = persisted.counters[SOURCES.USER_MAP];
  const reserveCeiling = state.totalBudget - state.userTrafficReserve;

  return {
    // Top-level fields kept for backward compatibility: before source
    // separation existed, the whole module *was* the crawler's counter, and
    // existing callers (discoveryPilot.js, olaProvider.js) still read these
    // directly. They are exact aliases of `crawler.*` below — not a
    // separate source of truth.
    used: crawlerUsed,
    limit: state.crawlerLimit,
    remaining: Math.max(0, state.crawlerLimit - crawlerUsed),

    month: persisted.month,
    crawler: {
      used: crawlerUsed,
      limit: state.crawlerLimit,
      remaining: Math.max(0, state.crawlerLimit - crawlerUsed),
    },
    userMap: {
      used: userMapUsed,
    },
    total: {
      used: totalUsed(),
      budget: state.totalBudget,
      reserve: state.userTrafficReserve,
      reserveCeiling,
      remainingBeforeReserve: Math.max(0, reserveCeiling - totalUsed()),
    },
  };
}

export function getQuotaLog() {
  rollOverIfNewMonth();
  return [...persisted.log];
}

// Test-only: point persistence at a different file (e.g. a temp path) and
// load whatever state already exists there, so tests never read/write the
// real quota_state.json that actual crawler runs depend on.
export function setQuotaStoragePath(filePath) {
  storagePath = filePath;
  persisted = readStateFile(storagePath) ?? emptyMonthState(monthKey());
  if (!existsSync(storagePath)) persist();
}

// Test-only: reset in-memory + persisted counters/log for the current
// month, without restarting the process. Leaves configured limits as-is —
// tests should call configureQuota() explicitly for the scenario they're
// testing rather than relying on defaults.
export function resetQuota() {
  persisted = emptyMonthState(monthKey());
  persist();
}
