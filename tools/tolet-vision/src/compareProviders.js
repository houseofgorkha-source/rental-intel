// Generates the Google-vs-Ola comparison report for the 50-panorama
// Tiles test. Read-only against the Ola registry (panoramaRegistry.js's
// loadRegistry(), never saved to) and the Google session's own
// discovery_results.json under the new archive
// (.data/imagery/google/sessions/<sessionId>/). Writes only into that
// same session directory — never touches Ola's pipeline output or
// Supabase. Defaults to the most recently created Google session; pass a
// session ID as argv[2] to target a specific one.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRegistry } from "./panoramaRegistry.js";
import { sessionsDir, sessionDir } from "./archive/paths.js";

const OLA_REQUESTS_PER_PANORAMA_ESTIMATE = 3; // see discoveryPilotHybrid.js's resolveByPoint/resolveById

function average(nums) {
  const valid = nums.filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function boardRepresentativeObservation(board) {
  return [...board.observations].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
}

async function resolveSessionId() {
  const explicit = process.argv[2];
  if (explicit) return explicit;

  const dir = sessionsDir("google");
  const entries = await readdir(dir, { withFileTypes: true });
  const candidates = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    try {
      const m = JSON.parse(await readFile(path.join(dir, e.name, "manifest.json"), "utf8"));
      candidates.push({ sessionId: e.name, startTime: m.startTime });
    } catch {
      /* skip unreadable session */
    }
  }
  if (candidates.length === 0) throw new Error("[compareProviders] no Google sessions found under .data/imagery/google/sessions/");
  candidates.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  return candidates[0].sessionId;
}

async function main() {
  const sessionId = await resolveSessionId();
  const dir = sessionDir("google", sessionId);
  const results = JSON.parse(await readFile(path.join(dir, "discovery_results.json"), "utf8"));
  const registry = await loadRegistry(); // read-only reference

  const { summary, pointResults } = results;
  const boardHitPoints = pointResults.filter((r) => r.type === "board_hit");
  const coverageOnlyPoints = pointResults.filter((r) => r.type === "coverage_only");

  const olaCoverageSuccessRate = 1; // by construction — see note below
  const totalPoints = summary.totalPoints;
  const googleCoverageSuccessRate = summary.resolvedPoints / totalPoints;

  const googleAllTileConfidence = average(pointResults.flatMap((r) => r.tileConfidences ?? []));
  const olaAcceptedCandidateConfidence = average(
    boardHitPoints
      .map((r) => registry.seenBoards[r.olaBoardKey])
      .filter(Boolean)
      .map((board) => boardRepresentativeObservation(board)?.ocrConfidence)
  );

  const googleCandidateCount = summary.candidateCount;
  const googleUniqueBoardCount = summary.uniqueBoardCount;
  const olaCandidateCount = boardHitPoints.length;
  const olaUniqueBoardCount = boardHitPoints.length;

  const olaBoardsPer1000 = (olaUniqueBoardCount / totalPoints) * 1000;
  const googleBoardsPer1000 = summary.resolvedPoints > 0 ? (googleUniqueBoardCount / summary.resolvedPoints) * 1000 : null;

  const olaEquivalentRequests = totalPoints * OLA_REQUESTS_PER_PANORAMA_ESTIMATE;
  const googleTotalCalls = (summary.apiUsage?.billableRequests ?? 0) + (summary.apiUsage?.nonBillableRequests ?? 0);
  const googleTileRequests = summary.apiUsage?.requestsBySource?.tile ?? 0;
  const googleMetadataRequests = summary.apiUsage?.requestsBySource?.metadata ?? 0;

  const googleFoundOlaMissed = coverageOnlyPoints
    .filter((r) => (r.candidates?.length ?? 0) > 0)
    .map((r) => ({ requestedLatitude: r.requestedLatitude, requestedLongitude: r.requestedLongitude, olaSourceId: r.olaSourceId, googlePanoId: r.panoId, googleCandidateCount: r.candidates.length, googleBestScore: Math.max(...r.candidates.map((c) => c.score)) }));

  const olaFoundGoogleMissed = boardHitPoints
    .filter((r) => r.outcome !== "resolved" || (r.candidates?.length ?? 0) === 0)
    .map((r) => ({ requestedLatitude: r.requestedLatitude, requestedLongitude: r.requestedLongitude, olaBoardKey: r.olaBoardKey, olaPhone: r.olaPhone, olaSourceId: r.olaSourceId, googleOutcome: r.outcome, tilesSucceeded: r.reconstruction?.tilesSucceeded ?? 0, tilesRequested: r.reconstruction?.tilesRequested ?? 0 }));

  const report = {
    generatedAt: new Date().toISOString(),
    googleSessionId: sessionId,
    inputPoints: totalPoints,
    coverageSuccess: { ola: olaCoverageSuccessRate, google: googleCoverageSuccessRate, note: "Ola's rate is 1.0 by construction (all points are drawn from Ola's own already-resolved coverage) — not a real-world Ola coverage-success measurement." },
    imageQuality: { googleMeanTileOcrConfidence: googleAllTileConfidence, olaMeanAcceptedCandidateOcrConfidence: olaAcceptedCandidateConfidence, note: "Not like-for-like — Google's figure covers every OCR'd tile from the reconstructed panorama; Ola's only covers already-accepted candidates (the registry never stored sub-threshold OCR confidence)." },
    ocrDetections: { google: googleCandidateCount, ola: olaCandidateCount },
    genuineBoards: { google: googleUniqueBoardCount, ola: olaUniqueBoardCount },
    boardsPer1000Panoramas: { google: googleBoardsPer1000, ola: olaBoardsPer1000 },
    panoramaReconstruction: { resolvedPoints: summary.resolvedPoints, tileRequests: googleTileRequests, metadataRequests: googleMetadataRequests },
    apiCallsAndCost: {
      google: { totalCalls: googleTotalCalls, billableRequests: summary.apiUsage?.billableRequests ?? 0, nonBillableRequests: summary.apiUsage?.nonBillableRequests ?? 0, estimatedCostUsd: 0, note: "Session/metadata calls are free; tile calls fall within Google's published 100,000/month free allowance for this SKU." },
      ola: { equivalentRequestsEstimate: olaEquivalentRequests, note: "These points were reused from Ola's existing captures, not fetched fresh — this is an estimate of what resolving them from scratch would cost, at ~3 requests/panorama." },
    },
    boardsGoogleFindsOlaMisses: googleFoundOlaMissed,
    boardsOlaFindsGoogleMisses: olaFoundGoogleMissed,
    crossProviderCaveat: "Coordinate-matched points are not guaranteed to be the same physical capture — different vehicles/passes/dates. Treat per-point 'misses' as leads to spot-check, not confirmed errors.",
  };

  const reportJsonPath = path.join(dir, "comparison_report.json");
  const reportMdPath = path.join(dir, "comparison_report.md");
  await writeFile(reportJsonPath, JSON.stringify(report, null, 2));

  const md = `# Google Tiles vs. Ola — comparison test

Session: ${sessionId}
Generated: ${report.generatedAt}
Input points: ${report.inputPoints} (${boardHitPoints.length} board_hit, ${coverageOnlyPoints.length} coverage_only)

**Cross-provider caveat:** ${report.crossProviderCaveat}

## Coverage success
- Ola: ${(olaCoverageSuccessRate * 100).toFixed(0)}% (by construction — see note)
- Google: ${(googleCoverageSuccessRate * 100).toFixed(1)}% (${summary.resolvedPoints}/${totalPoints} resolved; ${summary.noCoveragePoints} no_coverage, ${summary.metadataFailedPoints} metadata_failed, ${summary.errorPoints} error)

## Image quality (OCR legibility proxy)
- Google mean tile OCR confidence (all tiles): ${googleAllTileConfidence?.toFixed(1) ?? "N/A"}
- Ola mean OCR confidence (accepted candidates only): ${olaAcceptedCandidateConfidence?.toFixed(1) ?? "N/A"}

## OCR detections
- Google: ${googleCandidateCount}
- Ola: ${olaCandidateCount} (by construction, one per board_hit point)

## Genuine To-Let boards
- Google: ${googleUniqueBoardCount}
- Ola: ${olaUniqueBoardCount}

## Boards per 1,000 panoramas (resolved-panorama basis)
- Google: ${googleBoardsPer1000?.toFixed(1) ?? "N/A"}
- Ola: ${olaBoardsPer1000.toFixed(1)}

## Panorama reconstruction
- Resolved points: ${summary.resolvedPoints}/${totalPoints}
- Metadata requests: ${googleMetadataRequests} (free)
- Tile requests: ${googleTileRequests} (billable, within free allowance)

## API calls / cost
- Google: ${googleTotalCalls} total calls, **$0** (session+metadata free; tiles within the 100k/month free allowance)
- Ola: ~${olaEquivalentRequests} requests *(estimated equivalent cost — points were reused from existing captures, not fetched fresh)*

## Boards Google finds that Ola misses (${googleFoundOlaMissed.length})
${googleFoundOlaMissed.length === 0 ? "None." : googleFoundOlaMissed.map((b) => `- ${b.requestedLatitude}, ${b.requestedLongitude} — Google pano ${b.googlePanoId}, ${b.googleCandidateCount} candidate(s), best score ${b.googleBestScore}`).join("\n")}

## Boards Ola finds that Google misses (${olaFoundGoogleMissed.length})
${olaFoundGoogleMissed.length === 0 ? "None." : olaFoundGoogleMissed.map((b) => `- ${b.requestedLatitude}, ${b.requestedLongitude} — Ola board ${b.olaBoardKey}${b.olaPhone ? ` (${b.olaPhone})` : ""}, Google outcome: ${b.googleOutcome} (${b.tilesSucceeded}/${b.tilesRequested} tiles)`).join("\n")}
`;
  await writeFile(reportMdPath, md);

  console.log(md);
  console.log(`\nFull report: ${reportJsonPath}\nMarkdown: ${reportMdPath}`);
}

main().catch((err) => {
  console.error("[compareProviders] failed:", err);
  process.exitCode = 1;
});
