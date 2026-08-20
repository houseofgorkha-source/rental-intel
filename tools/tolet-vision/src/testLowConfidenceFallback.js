// Diagnostic only: offline test of a proposed low-confidence OCR fallback
// against every archived per-tile OCR record available (Google + Ola).
// Reads only already-archived ocr.json/metadata.json files written by prior
// sessions — makes ZERO API requests, runs ZERO new OCR, and touches no
// production code path.
//
// Proposed rule under test:
//   confidence >= 50        -> existing behavior (unchanged)
//   confidence <  50        -> only allowed through if the tile's own text
//                              carries an explicit TO_LET or FOR_RENT signal
//   then: identical scoring/dedup as today (CANDIDATE_SCORE_THRESHOLD, dedupeBoards)
//
// Coverage note: only panoramas archived in the newer per-tile format (an
// ocr.json alongside metadata.json) retain raw sub-floor tiles at all. Older
// pilot-era runs (.data/pilot/**) only ever persisted already-floor-cleared
// candidates (confidence >= 50 by construction), so the fallback is a
// mathematical no-op against them — verified, not assumed, below.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { extractAndScore, hasRentalSignal } from "./rentalScoring.js";
import { dedupeBoards } from "./boardDedup.js";

const CANDIDATE_SCORE_THRESHOLD = 15;
const OCR_CONFIDENCE_FLOOR = 50;
const EXPLICIT_SIGNALS = new Set(["TO_LET", "FOR_RENT"]);

const DATA_DIR = path.resolve(import.meta.dirname, "..", ".data");
const PROVIDER_ROOTS = {
  google: path.join(DATA_DIR, "imagery", "google", "sessions"),
  ola: path.join(DATA_DIR, "imagery", "ola", "sessions"),
};

async function exists(p) {
  try {
    await readFile(p);
    return true;
  } catch {
    return false;
  }
}

async function findPanoramaDirs(sessionsRoot) {
  const out = [];
  let sessionDirs;
  try {
    sessionDirs = await readdir(sessionsRoot, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const sd of sessionDirs) {
    if (!sd.isDirectory()) continue;
    const panoRoot = path.join(sessionsRoot, sd.name, "panoramas");
    let panoDirs;
    try {
      panoDirs = await readdir(panoRoot, { withFileTypes: true });
    } catch {
      continue; // session has no archived panoramas (e.g. errored-out run)
    }
    for (const pd of panoDirs) {
      if (!pd.isDirectory()) continue;
      out.push({ sessionId: sd.name, sourceId: pd.name, dir: path.join(panoRoot, pd.name) });
    }
  }
  return out;
}

// Every raw tile that scores >= threshold at ANY confidence — the full pool
// the fallback rule chooses from. Each entry also carries `passesToday`
// (the current floor >= 50 gate) so before/after is a pure filter, not a
// re-derivation.
async function collectRawCandidates(provider) {
  const panoDirs = await findPanoramaDirs(PROVIDER_ROOTS[provider]);
  const candidates = [];
  const skippedNoOcrJson = [];

  for (const { sessionId, sourceId, dir } of panoDirs) {
    const ocrPath = path.join(dir, "ocr.json");
    const metaPath = path.join(dir, "metadata.json");
    if (!(await exists(ocrPath)) || !(await exists(metaPath))) {
      skippedNoOcrJson.push({ sessionId, sourceId });
      continue;
    }
    const tiles = JSON.parse(await readFile(ocrPath, "utf8"));
    const meta = JSON.parse(await readFile(metaPath, "utf8"));

    for (const t of tiles) {
      const text = (t.text || "").trim();
      if (!text) continue;
      const extracted = extractAndScore(text);
      if (extracted.score < CANDIDATE_SCORE_THRESHOLD) continue;
      // Existing behavior, unchanged by the fallback: a candidate must carry
      // at least one rental signal (TO_LET/FOR_RENT/RENT/BHK), not just a
      // phone number or a generic broker-ish word. See googleComparisonTest.js
      // / discoveryPilotHybrid.js — both gate on this identically.
      if (!hasRentalSignal(extracted.signals)) continue;

      const hasExplicitSignal = extracted.signals.some((s) => EXPLICIT_SIGNALS.has(s));
      candidates.push({
        provider,
        sessionId,
        sourceId,
        latitude: meta.latitude,
        longitude: meta.longitude,
        tile: t.tile,
        tileIndex: t.tileIndex,
        ocrText: text,
        ocrConfidence: t.confidence,
        ...extracted,
        passesFloor: t.confidence >= OCR_CONFIDENCE_FLOOR,
        hasExplicitSignal,
      });
    }
  }

  return { candidates, panoramaCount: panoDirs.length, skippedNoOcrJson };
}

function summarize(provider, candidates) {
  const before = candidates.filter((c) => c.passesFloor);
  const after = candidates.filter((c) => c.passesFloor || c.hasExplicitSignal);
  const newlyRecovered = candidates.filter((c) => !c.passesFloor && c.hasExplicitSignal);
  const stillDroppedList = candidates.filter((c) => !c.passesFloor && !c.hasExplicitSignal);

  const boardsBefore = dedupeBoards(before);
  const boardsAfter = dedupeBoards(after);
  const boardKeysBefore = new Set(boardsBefore.map((b) => b.key));
  const newBoardKeys = boardsAfter.filter((b) => !boardKeysBefore.has(b.key));

  return {
    provider,
    rawCandidatePool: candidates.length,
    candidatesBefore: before.length,
    candidatesAfter: after.length,
    boardsBefore: boardsBefore.length,
    boardsAfter: boardsAfter.length,
    newlyRecoveredTiles: newlyRecovered,
    newBoardsFromRecovery: newBoardKeys,
    stillDroppedBelowFloorNoSignal: stillDroppedList,
  };
}

async function main() {
  const googleRaw = await collectRawCandidates("google");
  const olaRaw = await collectRawCandidates("ola");

  const googleSummary = summarize("google", googleRaw.candidates);
  const olaSummary = summarize("ola", olaRaw.candidates);

  console.log("=== Coverage ===");
  console.log(
    `google: ${googleRaw.panoramaCount} archived panoramas, ${googleRaw.skippedNoOcrJson.length} skipped (no ocr.json/metadata.json)`
  );
  console.log(
    `ola: ${olaRaw.panoramaCount} archived panoramas, ${olaRaw.skippedNoOcrJson.length} skipped (no ocr.json/metadata.json)`
  );

  for (const s of [googleSummary, olaSummary]) {
    console.log(`\n=== ${s.provider.toUpperCase()} ===`);
    console.log(`raw candidate pool (score >= ${CANDIDATE_SCORE_THRESHOLD}, any confidence): ${s.rawCandidatePool}`);
    console.log(`candidates before (existing floor >= 50): ${s.candidatesBefore}`);
    console.log(`candidates after (fallback rule applied): ${s.candidatesAfter}`);
    console.log(`unique boards before: ${s.boardsBefore}`);
    console.log(`unique boards after: ${s.boardsAfter}`);
    console.log(
      `still dropped (confidence < 50, no explicit TO_LET/FOR_RENT): ${s.stillDroppedBelowFloorNoSignal.length}`
    );
    for (const c of s.stillDroppedBelowFloorNoSignal) {
      console.log(
        `  - ${c.sourceId} tile${c.tileIndex} conf=${c.ocrConfidence.toFixed(1)} score=${c.score} signals=[${c.signals.join(",")}] phone=${c.phone ?? "-"} text="${c.ocrText.replace(/\n/g, " / ").slice(0, 80)}"`
      );
    }
    console.log(`\nnewly recovered tiles (${s.newlyRecoveredTiles.length}):`);
    for (const c of s.newlyRecoveredTiles) {
      console.log(
        `  - ${c.sourceId} tile${c.tileIndex} (${c.tile.x},${c.tile.y},${c.tile.w}x${c.tile.h}) conf=${c.ocrConfidence.toFixed(1)} score=${c.score} signals=[${c.signals.join(",")}] phone=${c.phone ?? "-"} text="${c.ocrText.replace(/\n/g, " / ").slice(0, 80)}"`
      );
    }
    console.log(`\nnew board keys surfaced by recovery (${s.newBoardsFromRecovery.length}):`);
    for (const b of s.newBoardsFromRecovery) {
      console.log(`  - ${b.key} (phone=${b.phone ?? "-"}, observations=${b.observationCount})`);
    }
  }

  const fs = await import("node:fs/promises");
  const outPath = path.join(DATA_DIR, "low_confidence_fallback_test.json");
  await fs.writeFile(
    outPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        rule: {
          floor: OCR_CONFIDENCE_FLOOR,
          candidateScoreThreshold: CANDIDATE_SCORE_THRESHOLD,
          fallbackRequiresSignals: [...EXPLICIT_SIGNALS],
        },
        coverage: {
          google: { panoramaCount: googleRaw.panoramaCount, skipped: googleRaw.skippedNoOcrJson },
          ola: { panoramaCount: olaRaw.panoramaCount, skipped: olaRaw.skippedNoOcrJson },
        },
        google: googleSummary,
        ola: olaSummary,
      },
      null,
      2
    )
  );
  console.log(`\n[fallback-test] wrote ${outPath}`);
  console.log("[fallback-test] API requests used: 0");
}

main().catch((err) => {
  console.error("[fallback-test] failed:", err);
  process.exitCode = 1;
});
