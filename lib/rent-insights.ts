export type RentDataProperty = {
  area: string;
  askingRent: number | null;
};

export type AreaRentInsight = {
  // The most common original casing seen for this area, not a forced
  // canonical form — "Whitefield" and "whitefield" merge into whichever
  // spelling showed up more often, rather than the app inventing its own.
  area: string;
  averageRent: number;
  sampleSize: number;
};

// Below this many properties, an area's "typical rent" isn't a market
// signal — it's one or two owners' asking prices dressed up as a stat. Never
// shown, not shown with a caveat: the property page already treats a
// missing figure as "not answered", not something worth a disclaimer.
export const MIN_RENT_SAMPLE_SIZE = 3;

// Groups by a normalized key (trimmed, lowercased) so "Whitefield" and
// "whitefield" count as the same area — genuinely different spellings
// ("whitehield") are NOT fuzzy-matched together; that's a data-entry
// problem in the original submission, not something this function should
// paper over by guessing at intent.
export function aggregateRentByArea(properties: RentDataProperty[]): AreaRentInsight[] {
  type AreaBucket = { rents: number[]; displayNameCounts: Map<string, number> };
  const byKey = new Map<string, AreaBucket>();

  for (const property of properties) {
    if (property.askingRent === null) continue;

    const trimmedArea = property.area.trim();
    if (!trimmedArea) continue;

    const key = trimmedArea.toLowerCase();
    const entry: AreaBucket = byKey.get(key) ?? { rents: [], displayNameCounts: new Map() };
    entry.rents.push(property.askingRent);
    entry.displayNameCounts.set(trimmedArea, (entry.displayNameCounts.get(trimmedArea) ?? 0) + 1);
    byKey.set(key, entry);
  }

  const insights: AreaRentInsight[] = [];
  for (const { rents, displayNameCounts } of byKey.values()) {
    if (rents.length < MIN_RENT_SAMPLE_SIZE) continue;

    const [mostCommonDisplayName] = Array.from(displayNameCounts.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];

    insights.push({
      area: mostCommonDisplayName,
      averageRent: Math.round(rents.reduce((total, rent) => total + rent, 0) / rents.length),
      sampleSize: rents.length,
    });
  }

  return insights.sort((a, b) => b.sampleSize - a.sampleSize);
}
