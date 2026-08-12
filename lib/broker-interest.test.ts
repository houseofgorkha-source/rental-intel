import { describe, expect, it } from "vitest";
import { summarizeBrokerInterestVotes } from "./broker-interest";

describe("summarizeBrokerInterestVotes", () => {
  it("returns null percentage when nobody has voted", () => {
    expect(summarizeBrokerInterestVotes([])).toEqual({ total: 0, yesPercentage: null });
  });

  it("computes the yes percentage", () => {
    expect(summarizeBrokerInterestVotes([true, true, false, true])).toEqual({
      total: 4,
      yesPercentage: 75,
    });
  });

  it("rounds to the nearest whole percent", () => {
    expect(summarizeBrokerInterestVotes([true, false, false])).toEqual({
      total: 3,
      yesPercentage: 33,
    });
  });

  it("handles an all-no result without claiming 0% is 'nobody voted'", () => {
    expect(summarizeBrokerInterestVotes([false, false])).toEqual({
      total: 2,
      yesPercentage: 0,
    });
  });
});
