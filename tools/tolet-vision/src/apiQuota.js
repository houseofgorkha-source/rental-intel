// Hard request-budget enforcement for the Ola Maps Street View API.
// Single choke point: every real HTTP call in providers/ola/olaClient.js
// goes through recordRequest() first, so the limit is enforced no matter
// which script (crawler, pilot, ad-hoc probe) is making the calls — it
// can't be accidentally bypassed by a caller forgetting to check it.

export class QuotaExceededError extends Error {
  constructor(limit) {
    super(`[apiQuota] request limit reached (${limit}) — stopping before making another API call.`);
    this.name = "QuotaExceededError";
    this.limit = limit;
  }
}

const state = {
  limit: Number(process.env.OLA_API_REQUEST_LIMIT) || 100,
  used: 0,
  log: [], // { kind, at, used } — one entry per accepted request, for auditing
};

export function configureQuota(limit) {
  state.limit = limit;
}

export function recordRequest(kind) {
  if (state.used >= state.limit) {
    throw new QuotaExceededError(state.limit);
  }
  state.used += 1;
  state.log.push({ kind, at: new Date().toISOString(), used: state.used });
}

export function getQuotaStatus() {
  return { limit: state.limit, used: state.used, remaining: Math.max(0, state.limit - state.used) };
}

export function getQuotaLog() {
  return [...state.log];
}

// Test-only: reset counters without restarting the process.
export function resetQuota() {
  state.used = 0;
  state.log = [];
}
