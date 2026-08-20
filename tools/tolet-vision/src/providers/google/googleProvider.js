// Google Street View Tiles implementation of the imagery-provider
// boundary (see ../../imageryProvider.js), for the isolated Google-vs-Ola
// comparison test. Session -> metadata -> tile reconstruction, per the
// approved plan — not the Street View Static API.
//
// Like the old Static-API version, there is no `links` neighbour-graph
// here, so crawlPanoramas() still throws — only point-based resolution.
//
// Logs every session/metadata/tile call directly into the archive's
// request ledger (archive/requestLedger.js) — never apiQuota.js (that
// module is Ola-only; see its own header comment). `archiveSessionId` is
// threaded through explicitly rather than held as module state, since
// unlike the Ola hybrid script this provider has no single always-one-
// session-per-process assumption baked into its callers.
import { createSession, getMetadata } from "./googleClient.js";
import { reconstructPanorama } from "./panoramaReconstruction.js";
import { appendRequest } from "../../archive/requestLedger.js";
import { panoramaTilesDir } from "../../archive/paths.js";

export const PROVIDER_NAME = "google";
export const DEFAULT_ZOOM = Number(process.env.GOOGLE_TILE_ZOOM) || 3;

let cachedSession = null;

async function logged(archiveSessionId, purpose, panoramaId, billable, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    await appendRequest("google", archiveSessionId, {
      endpoint: purpose,
      purpose,
      panoramaId,
      success: !!result?.ok,
      httpStatus: result?.status ?? null,
      latencyMs: Date.now() - start,
      billable,
      quotaCategory: billable ? "google_streetview_tiles" : "google_streetview_free",
    });
    return result;
  } catch (err) {
    await appendRequest("google", archiveSessionId, {
      endpoint: purpose,
      purpose,
      panoramaId,
      success: false,
      httpStatus: null,
      latencyMs: Date.now() - start,
      billable,
      quotaCategory: billable ? "google_streetview_tiles" : "google_streetview_free",
    });
    throw err;
  }
}

// Created once per process and reused for every subsequent call (2-week
// TTL) — matches how the session token is meant to be used, and avoids
// spending a (free, but pointless) createSession call per point.
export async function ensureSession(archiveSessionId) {
  if (cachedSession) return cachedSession;
  const res = await logged(archiveSessionId, "createSession", null, false, () => createSession());
  if (!res.ok || !res.body?.session) {
    throw new Error(`[googleProvider] createSession failed: HTTP ${res.status} ${JSON.stringify(res.body)}`);
  }
  cachedSession = res.body.session;
  return cachedSession;
}

export async function crawlPanoramas() {
  throw new Error(
    "[googleProvider] crawlPanoramas() is not supported — Google Street View has no links " +
      "neighbour-graph. Use resolvePanoramaAtPoint({ lat, lon }) for point-based lookups."
  );
}

// Returns one of:
//   { outcome: "no_coverage" | "metadata_failed", status }
//   { outcome: "resolved", panoId, latitude, longitude, captureDate,
//     imageBytes, reconstruction: { zoom, cols, rows, tilesRequested, tilesSucceeded } }
export async function resolvePanoramaAtPoint({ lat, lon }, { zoom = DEFAULT_ZOOM, archiveSessionId } = {}) {
  const session = await ensureSession(archiveSessionId);
  const meta = await logged(archiveSessionId, "metadata", null, false, () => getMetadata({ session, lat, lon }));
  if (!meta.ok || !meta.body?.panoId) {
    return { outcome: meta.ok ? "no_coverage" : "metadata_failed", status: meta.body?.error?.status ?? meta.status };
  }
  const m = meta.body;

  // Now that panoId is known, the raw tiles get their own subdirectory
  // under this panorama's archive folder — preserved alongside the
  // reconstructed panorama.jpg, per the archive spec.
  const tilesDir = archiveSessionId ? panoramaTilesDir("google", archiveSessionId, m.panoId) : null;
  const recon = await reconstructPanorama({ session, metadata: m, zoom, archiveSessionId, logTile: logged, tilesDir });

  return {
    outcome: "resolved",
    panoId: m.panoId,
    latitude: m.lat,
    longitude: m.lng,
    captureDate: m.date ?? null,
    imageBytes: recon.imageBytes,
    reconstruction: {
      zoom: recon.zoom,
      cols: recon.cols,
      rows: recon.rows,
      tilesRequested: recon.tilesRequested,
      tilesSucceeded: recon.tilesSucceeded,
    },
  };
}
