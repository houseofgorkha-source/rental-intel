// Quota accounting for the Ola Maps API, split by traffic source.
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

export const SOURCES = { CRAWLER: "crawler", USER_MAP: "user_map" };

export class QuotaExceededError extends Error {
  constructor(reason, detail) {
    super(`[apiQuota] crawler request blocked (${reason}): ${detail}`);
    this.name = "QuotaExceededError";
    this.reason = reason; // "crawler_limit" | "user_traffic_reserve"
  }
}

const DEFAULTS = {
  crawlerLimit: Number(process.env.OLA_CRAWLER_MONTHLY_LIMIT) || 100,
  totalBudget: Number(process.env.OLA_TOTAL_MONTHLY_BUDGET) || Infinity,
  userTrafficReserve: Number(process.env.OLA_USER_TRAFFIC_RESERVE) || 0,
};

const state = {
  ...DEFAULTS,
  counters: { [SOURCES.CRAWLER]: 0, [SOURCES.USER_MAP]: 0 },
  log: [], // { source, endpoint, at, crawlerUsed, userMapUsed, totalUsed }
};

function totalUsed() {
  return state.counters[SOURCES.CRAWLER] + state.counters[SOURCES.USER_MAP];
}

// Accepts either a plain number (legacy call shape: sets crawlerLimit only,
// budget/reserve stay at their current values — Infinity/0 by default,
// meaning no reserve constraint applies unless explicitly configured) or an
// options object for full control.
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
  if (source === SOURCES.CRAWLER) {
    if (state.counters[SOURCES.CRAWLER] >= state.crawlerLimit) {
      throw new QuotaExceededError(
        "crawler_limit",
        `crawler limit is ${state.crawlerLimit}, already used ${state.counters[SOURCES.CRAWLER]}`
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

  state.counters[source] = (state.counters[source] ?? 0) + 1;
  state.log.push({
    source,
    endpoint,
    at: new Date().toISOString(),
    crawlerUsed: state.counters[SOURCES.CRAWLER],
    userMapUsed: state.counters[SOURCES.USER_MAP],
    totalUsed: totalUsed(),
  });
}

export function getQuotaStatus() {
  const crawlerUsed = state.counters[SOURCES.CRAWLER];
  const userMapUsed = state.counters[SOURCES.USER_MAP];
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
  return [...state.log];
}

// Test-only: reset counters/log without restarting the process. Leaves
// configured limits as-is — tests should call configureQuota() explicitly
// for the scenario they're testing rather than relying on defaults.
export function resetQuota() {
  state.counters = { [SOURCES.CRAWLER]: 0, [SOURCES.USER_MAP]: 0 };
  state.log = [];
}
