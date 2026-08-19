// Pragmatic MVP dedup for the discovery pilot: groups candidate detections
// into "unique boards" so the same physical board seen across overlapping
// panoramas/tiles isn't reported multiple times.
//
// Key choice: exact phone-number match when a candidate has one (the most
// reliable signal a physical board offers), otherwise a rounded-coordinate
// bucket (~11m at 4 decimal places) as a fallback. This is a known-limited
// heuristic, not real geospatial clustering — a board sitting exactly on a
// bucket boundary could split across two groups, and two distinct boards
// within the same ~11m bucket with no phone would incorrectly merge. Good
// enough to report "boards found" for a small pilot; not a substitute for
// the real geospatial dedup described in the original project plan.
function roundCoord(v, decimals = 4) {
  return Number(v.toFixed(decimals));
}

export function dedupeBoards(candidates) {
  const groups = new Map();
  for (const c of candidates) {
    const key = c.phone ? `phone:${c.phone}` : `loc:${roundCoord(c.latitude)},${roundCoord(c.longitude)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const boards = [];
  for (const [key, observations] of groups) {
    observations.sort((a, b) => b.score - a.score);
    const best = observations[0];
    boards.push({
      key,
      dedupMethod: best.phone ? "phone" : "location_bucket",
      phone: best.phone,
      bhk: best.bhk,
      rent: best.rent,
      propertyName: best.propertyName,
      addressHints: best.addressHints,
      agencyName: best.agencyName,
      contactHints: best.contactHints,
      representativeScore: best.score,
      representativeText: best.ocrText,
      observationCount: observations.length,
      observations: observations.map((o) => ({
        sourceId: o.sourceId,
        latitude: o.latitude,
        longitude: o.longitude,
        score: o.score,
        ocrConfidence: o.ocrConfidence,
        cropImage: o.cropImage,
      })),
    });
  }

  boards.sort((a, b) => b.representativeScore - a.representativeScore);
  return boards;
}
