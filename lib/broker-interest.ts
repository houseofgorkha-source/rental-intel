export type BrokerInterestResults = {
  total: number;
  yesPercentage: number | null;
};

// Null rather than 0% when nobody has voted yet — 0% would claim "everyone
// who answered said no," which is a different, false statement about zero
// people.
export function summarizeBrokerInterestVotes(votes: boolean[]): BrokerInterestResults {
  const total = votes.length;
  if (total === 0) return { total: 0, yesPercentage: null };

  const yesCount = votes.filter(Boolean).length;
  return { total, yesPercentage: Math.round((yesCount / total) * 100) };
}
