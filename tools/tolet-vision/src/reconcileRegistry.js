// Read-only reconciliation report: compares a completed run's
// contribution to panoramaRegistry.js against everything already known,
// so "how many boards did this run actually add" is answered precisely
// instead of by naive per-run summation (which would double-count any
// board more than one run happened to find).
//
// Makes no API calls and writes nothing except the report itself — safe to
// run any time, against any state of the registry.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRegistry, registryStats } from "./panoramaRegistry.js";

const OUT_PATH = path.resolve(import.meta.dirname, "..", ".data", "pilot", "registry", "reconciliation_report.json");

// Which source(s) count as "the run under review" vs "everything else
// already known" — the only thing that changes between report runs.
const RUN_SOURCES = new Set(["bfs_cluster"]);

async function main() {
  const registry = await loadRegistry();
  const boards = Object.values(registry.seenBoards);

  const genuinelyNew = [];
  const previouslyKnownReconfirmed = [];
  const priorOnlyNotRefound = [];

  for (const board of boards) {
    const sources = new Set(board.observations.map((o) => o.source));
    const hasRunSource = [...sources].some((s) => RUN_SOURCES.has(s));
    const hasPriorSource = [...sources].some((s) => !RUN_SOURCES.has(s));

    if (hasRunSource && hasPriorSource) previouslyKnownReconfirmed.push(board);
    else if (hasRunSource) genuinelyNew.push(board);
    else priorOnlyNotRefound.push(board);
  }

  const totalObservations = boards.reduce((s, b) => s + b.observations.length, 0);
  const runObservations = boards.reduce(
    (s, b) => s + b.observations.filter((o) => RUN_SOURCES.has(o.source)).length,
    0
  );
  const duplicateObservations = totalObservations - boards.length; // every observation beyond a board's first

  const stats = registryStats(registry);

  const report = {
    generatedAt: new Date().toISOString(),
    runSourcesReviewed: [...RUN_SOURCES],
    uniqueGlobalBoards: stats.boardCount,
    uniqueGlobalImageIds: stats.imageIdCount,
    genuinelyNewBoards: genuinelyNew.length,
    previouslyKnownBoardsReconfirmed: previouslyKnownReconfirmed.length,
    priorBoardsNotRefoundByThisRun: priorOnlyNotRefound.length,
    totalObservationsAcrossAllBoards: totalObservations,
    observationsFromThisRun: runObservations,
    duplicateObservations,
    detail: {
      genuinelyNew: genuinelyNew.map(summarize),
      previouslyKnownReconfirmed: previouslyKnownReconfirmed.map(summarize),
      priorOnlyNotRefound: priorOnlyNotRefound.map(summarize),
    },
  };

  await writeFile(OUT_PATH, JSON.stringify(report, null, 2));

  console.log("=== Registry reconciliation ===");
  console.log(`sources reviewed as "this run": ${[...RUN_SOURCES].join(", ")}`);
  console.log(`unique global boards (all runs, deduped): ${report.uniqueGlobalBoards}`);
  console.log(`unique global imageIds (all runs, deduped): ${report.uniqueGlobalImageIds}`);
  console.log(`genuinely new boards (found only by this run): ${report.genuinelyNewBoards}`);
  console.log(`previously known boards, reconfirmed by this run: ${report.previouslyKnownBoardsReconfirmed}`);
  console.log(`prior boards NOT re-found by this run (outside its ground): ${report.priorBoardsNotRefoundByThisRun}`);
  console.log(`total observations across all boards: ${report.totalObservationsAcrossAllBoards} (this run: ${report.observationsFromThisRun})`);
  console.log(`duplicate observations (same board seen more than once, any run): ${report.duplicateObservations}`);
  console.log(`report written: ${OUT_PATH}`);
}

function summarize(board) {
  return {
    key: board.key,
    phone: board.phone,
    observationCount: board.observations.length,
    sources: [...new Set(board.observations.map((o) => o.source))],
    localities: [...new Set(board.observations.map((o) => o.locality))],
  };
}

main().catch((err) => {
  console.error("[reconcile] failed:", err);
  process.exitCode = 1;
});
