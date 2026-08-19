import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SOURCES,
  configureQuota,
  recordRequest,
  getQuotaStatus,
  getQuotaLog,
  resetQuota,
  QuotaExceededError,
} from "./apiQuota.js";

// Every test resets state AND explicitly configures the scenario it needs —
// never relies on defaults/env vars, so tests stay deterministic regardless
// of what's in .env.
function fresh(config) {
  resetQuota();
  configureQuota({ crawlerLimit: Infinity, totalBudget: Infinity, userTrafficReserve: 0, ...config });
}

test("crawler limit: hard-stops exactly at the configured crawler limit", () => {
  fresh({ crawlerLimit: 3 });
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "metadata");
  assert.throws(() => recordRequest(SOURCES.CRAWLER, "metadata"), QuotaExceededError);
  assert.equal(getQuotaStatus().crawler.used, 3);
});

test("crawler limit: the error identifies the reason as crawler_limit", () => {
  fresh({ crawlerLimit: 1 });
  recordRequest(SOURCES.CRAWLER, "metadata");
  try {
    recordRequest(SOURCES.CRAWLER, "metadata");
    assert.fail("expected QuotaExceededError");
  } catch (err) {
    assert.ok(err instanceof QuotaExceededError);
    assert.equal(err.reason, "crawler_limit");
  }
});

test("reserve protection: crawler is stopped by the reserve before its own limit is reached", () => {
  // Crawler's own limit is generous (50), but total budget is 10 with a
  // reserve of 4 for user traffic — so the crawler must stop at 6, not 50.
  fresh({ crawlerLimit: 50, totalBudget: 10, userTrafficReserve: 4 });
  for (let i = 0; i < 6; i++) recordRequest(SOURCES.CRAWLER, "metadata");
  try {
    recordRequest(SOURCES.CRAWLER, "metadata");
    assert.fail("expected QuotaExceededError from the reserve, not the crawler limit");
  } catch (err) {
    assert.ok(err instanceof QuotaExceededError);
    assert.equal(err.reason, "user_traffic_reserve");
  }
  assert.equal(getQuotaStatus().crawler.used, 6);
});

test("reserve protection: user_map usage tightens the crawler's effective ceiling", () => {
  // Budget 10, reserve 2 -> ceiling 8. If user_map has already used 5, the
  // crawler can only take 3 more before hitting the shared ceiling.
  fresh({ crawlerLimit: Infinity, totalBudget: 10, userTrafficReserve: 2 });
  for (let i = 0; i < 5; i++) recordRequest(SOURCES.USER_MAP, "tile");
  for (let i = 0; i < 3; i++) recordRequest(SOURCES.CRAWLER, "metadata");
  assert.throws(() => recordRequest(SOURCES.CRAWLER, "metadata"), QuotaExceededError);
  assert.equal(getQuotaStatus().total.used, 8);
});

test("reserve protection: user_map requests are never blocked, even past the total budget", () => {
  fresh({ crawlerLimit: Infinity, totalBudget: 2, userTrafficReserve: 0 });
  // Our own accounting must never be the reason a real user's map fails.
  for (let i = 0; i < 10; i++) {
    assert.doesNotThrow(() => recordRequest(SOURCES.USER_MAP, "tile"));
  }
  assert.equal(getQuotaStatus().userMap.used, 10);
});

test("source-separated counters: crawler and user_map are tracked independently", () => {
  fresh();
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "imageDownload");
  recordRequest(SOURCES.USER_MAP, "tile");

  const status = getQuotaStatus();
  assert.equal(status.crawler.used, 2);
  assert.equal(status.userMap.used, 1);
  // Legacy top-level fields are aliases of crawler.*, not a third counter.
  assert.equal(status.used, status.crawler.used);
});

test("total counter: always equals crawler.used + userMap.used", () => {
  fresh();
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.USER_MAP, "tile");
  recordRequest(SOURCES.USER_MAP, "tile");
  recordRequest(SOURCES.CRAWLER, "imageDownload");
  recordRequest(SOURCES.CRAWLER, "metadata");

  const status = getQuotaStatus();
  assert.equal(status.total.used, status.crawler.used + status.userMap.used);
  assert.equal(status.total.used, 5);
});

test("hard stop before request: a blocked call does not increment any counter or log entry", () => {
  fresh({ crawlerLimit: 2 });
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "metadata");
  const beforeStatus = getQuotaStatus();
  const beforeLogLength = getQuotaLog().length;

  assert.throws(() => recordRequest(SOURCES.CRAWLER, "metadata"), QuotaExceededError);

  assert.equal(getQuotaStatus().crawler.used, beforeStatus.crawler.used);
  assert.equal(getQuotaLog().length, beforeLogLength);
});

test("endpoint + source are recorded per request in the audit log", () => {
  fresh();
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.USER_MAP, "tile");

  const log = getQuotaLog();
  assert.equal(log.length, 2);
  assert.equal(log[0].source, SOURCES.CRAWLER);
  assert.equal(log[0].endpoint, "metadata");
  assert.equal(log[1].source, SOURCES.USER_MAP);
  assert.equal(log[1].endpoint, "tile");
});

test("configureQuota accepts the legacy plain-number call shape (crawlerLimit only)", () => {
  resetQuota();
  configureQuota(5); // legacy shape used by discoveryPilot.js
  for (let i = 0; i < 5; i++) recordRequest(SOURCES.CRAWLER, "metadata");
  assert.throws(() => recordRequest(SOURCES.CRAWLER, "metadata"), QuotaExceededError);
});
