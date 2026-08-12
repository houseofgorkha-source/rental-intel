"use server";

import { createClient } from "@/lib/supabase/server";
import { summarizeBrokerInterestVotes, type BrokerInterestResults } from "@/lib/broker-interest";

type SubmitVoteResult = {
  error?: string;
  results?: BrokerInterestResults;
};

// Open to signed-out visitors on purpose — this is a public opinion poll,
// not account data, and requiring an account would just measure "how many
// signed-in users noticed this" instead of what it's actually trying to
// measure.
export async function submitBrokerInterestVote(
  wantsBrokers: boolean,
): Promise<SubmitVoteResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("broker_interest_votes")
    .insert({ wants_brokers: wantsBrokers });

  if (error) {
    return { error: "Unable to record your response. Please try again." };
  }

  return { results: await getBrokerInterestResults() };
}

export async function getBrokerInterestResults(): Promise<BrokerInterestResults> {
  const supabase = await createClient();
  const { data } = await supabase.from("broker_interest_votes").select("wants_brokers");
  return summarizeBrokerInterestVotes((data ?? []).map((row) => row.wants_brokers));
}
