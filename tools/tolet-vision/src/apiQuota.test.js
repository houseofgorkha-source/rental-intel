import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  SOURCES,
  configureQuota,
  recordRequest,
  getQuotaStatus,
  getQuotaLog,
  resetQuota,
  setQuotaStoragePath,
  _setNowForTests,
  QuotaExceededError,
} from "./apiQuota.js";

// Redirect persistence at a throwaway temp file for the whole test file —
// these tests must never read or write the real quota_state.json that
// actual crawler runs depend on.
const TEST_STORAGE_PATH = path.join(os.tmpdir(), `tolet-vision-quota-test-${process.pid}.json`);
setQuotaStoragePath(TEST_STORAGE_PATH);

// Every test resets state AND explicitly configures the scenario it needs —
// never relies on defaults/env vars, so tests stay deterministic regardless
// of what's in .env.
function fresh(config) {
  _setNowForTests(null); // real clock unless a test explicitly overrides it
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

// --- Persistence across runs ---------------------------------------------

test("persistence: usage survives reloading state from disk (simulates a process restart)", () => {
  fresh({ crawlerLimit: 100 });
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "imageDownload");
  recordRequest(SOURCES.USER_MAP, "tile");

  // A real restart re-imports the module, which reads this same file from
  // disk at load time. Re-pointing at the identical path exercises that
  // exact read path without needing a second process.
  setQuotaStoragePath(TEST_STORAGE_PATH);

  const status = getQuotaStatus();
  assert.equal(status.crawler.used, 2);
  assert.equal(status.userMap.used, 1);
  assert.equal(getQuotaLog().length, 3);
});

test("persistence: the on-disk file contains timestamp, endpoint, source, and running totals per request", () => {
  fresh();
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.USER_MAP, "tile");

  const onDisk = JSON.parse(readFileSync(TEST_STORAGE_PATH, "utf8"));
  assert.equal(onDisk.log.length, 2);
  for (const entry of onDisk.log) {
    assert.equal(typeof entry.at, "string");
    assert.ok(!Number.isNaN(Date.parse(entry.at)));
    assert.equal(typeof entry.endpoint, "string");
    assert.ok(Object.values(SOURCES).includes(entry.source));
    assert.equal(typeof entry.totalUsed, "number");
  }
  assert.equal(onDisk.counters[SOURCES.CRAWLER], 1);
  assert.equal(onDisk.counters[SOURCES.USER_MAP], 1);
});

test("persistence: a crawler limit reached in an earlier run is still enforced after reload", () => {
  fresh({ crawlerLimit: 3 });
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "metadata");

  // Simulate the process exiting and a new one starting: re-read from disk.
  // configureQuota must be called again too, since limits are policy (not
  // persisted) and a real new process would set them again from env/args.
  setQuotaStoragePath(TEST_STORAGE_PATH);
  configureQuota({ crawlerLimit: 3 });

  assert.throws(() => recordRequest(SOURCES.CRAWLER, "metadata"), QuotaExceededError);
});

// --- Monthly reset ---------------------------------------------------------

test("monthly reset: usage carries over within the same month across multiple recordRequest calls", () => {
  fresh({ crawlerLimit: 100 });
  _setNowForTests(() => new Date("2031-03-10T12:00:00Z"));
  recordRequest(SOURCES.CRAWLER, "metadata");
  _setNowForTests(() => new Date("2031-03-25T23:59:00Z"));
  recordRequest(SOURCES.CRAWLER, "metadata");

  assert.equal(getQuotaStatus().crawler.used, 2);
  assert.equal(getQuotaStatus().month, "2031-03");
});

test("monthly reset: usage resets to zero automatically when the calendar month rolls over", () => {
  fresh({ crawlerLimit: 100 });
  _setNowForTests(() => new Date("2031-04-30T23:00:00Z"));
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "metadata");
  assert.equal(getQuotaStatus().crawler.used, 2);

  _setNowForTests(() => new Date("2031-05-01T00:05:00Z"));
  assert.equal(getQuotaStatus().crawler.used, 0); // rollover happens on read too, not just on write
  assert.equal(getQuotaStatus().month, "2031-05");

  recordRequest(SOURCES.CRAWLER, "metadata");
  assert.equal(getQuotaStatus().crawler.used, 1);
});

test("monthly reset: the previous month's final usage is archived, not discarded", () => {
  fresh({ crawlerLimit: 100 });
  _setNowForTests(() => new Date("2031-06-15T00:00:00Z"));
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.USER_MAP, "tile");

  _setNowForTests(() => new Date("2031-07-01T00:00:00Z"));
  recordRequest(SOURCES.CRAWLER, "metadata"); // triggers the rollover

  // Archive dir is derived from the (redirected, tmpdir) storage path's
  // directory — never the real .data/quota_archive/. See archiveDir() in
  // apiQuota.js.
  const archivePath = path.join(path.dirname(TEST_STORAGE_PATH), "quota_archive", "2031-06.json");
  const archived = JSON.parse(readFileSync(archivePath, "utf8"));
  assert.equal(archived.month, "2031-06");
  assert.equal(archived.counters[SOURCES.CRAWLER], 2);
  assert.equal(archived.counters[SOURCES.USER_MAP], 1);
  assert.equal(archived.log.length, 3);

  rmSync(archivePath, { force: true });
});

test("monthly reset: the crawler limit applies to the new month's usage, not the old month's", () => {
  fresh({ crawlerLimit: 2 });
  _setNowForTests(() => new Date("2031-08-01T00:00:00Z"));
  recordRequest(SOURCES.CRAWLER, "metadata");
  recordRequest(SOURCES.CRAWLER, "metadata");
  assert.throws(() => recordRequest(SOURCES.CRAWLER, "metadata"), QuotaExceededError);

  _setNowForTests(() => new Date("2031-09-01T00:00:00Z"));
  // Same crawlerLimit=2, but it's a new month — must not still be exhausted.
  assert.doesNotThrow(() => recordRequest(SOURCES.CRAWLER, "metadata"));
  assert.equal(getQuotaStatus().crawler.used, 1);
});

after(() => {
  _setNowForTests(null);
  rmSync(TEST_STORAGE_PATH, { force: true });
  rmSync(path.join(path.dirname(TEST_STORAGE_PATH), "quota_archive"), { recursive: true, force: true });
});
