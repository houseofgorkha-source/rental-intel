"use client";

import { useEffect, useState } from "react";
import Button from "@/components/shared/Button";
import { submitBrokerInterestVote } from "@/app/actions/broker-interest";
import type { BrokerInterestResults } from "@/lib/broker-interest";

const STORAGE_KEY = "rentalintel-broker-interest-vote";

type BrokerInterestSurveyProps = {
  initialResults: BrokerInterestResults;
};

// Originally a pre-build demand signal, when RentalIntel had no broker role
// at all. A real, self-registered broker directory now exists (see
// components/home/BrokerDirectorySection.tsx, migration
// 20260820000000_add_broker_directory.sql) — this poll is kept as a
// post-launch "was this worth building" check rather than removed outright.
// "Have you already voted" is a localStorage flag, not an account — a soft
// courtesy for a casual poll, not something the poll's integrity depends on.
export default function BrokerInterestSurvey({ initialResults }: BrokerInterestSurveyProps) {
  const [results, setResults] = useState(initialResults);
  const [myVote, setMyVote] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "yes") setMyVote(true);
    if (stored === "no") setMyVote(false);
  }, []);

  async function vote(wantsBrokers: boolean) {
    setIsSubmitting(true);
    setError(null);

    const result = await submitBrokerInterestVote(wantsBrokers);
    setIsSubmitting(false);

    if (result.error || !result.results) {
      setError(result.error ?? "Unable to record your response. Please try again.");
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, wantsBrokers ? "yes" : "no");
    setMyVote(wantsBrokers);
    setResults(result.results);
  }

  return (
    <section
      aria-labelledby="broker-interest-heading"
      className="mt-16 rounded-2xl bg-surface p-6 text-center shadow-[0_1px_2px_rgba(14,143,94,0.04)] sm:p-8 lg:mt-24"
    >
      <h2
        id="broker-interest-heading"
        className="text-xl font-medium tracking-[-0.02em] text-foreground sm:text-2xl"
      >
        Is the broker directory above worth keeping?
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
        We just launched a first version, self-registered by brokers — tell
        us if it&apos;s actually useful.
      </p>

      {myVote === null ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="primary" disabled={isSubmitting} onClick={() => vote(true)}>
            Yes, keep it
          </Button>
          <Button variant="secondary" disabled={isSubmitting} onClick={() => vote(false)}>
            No, remove it
          </Button>
        </div>
      ) : (
        <div className="mt-6">
          <p className="text-sm font-medium text-foreground">
            Thanks — you said {myVote ? "yes" : "no"}.
          </p>
          {results.yesPercentage !== null && (
            <p className="mt-1 text-sm text-muted">
              {results.yesPercentage}% of {results.total}{" "}
              {results.total === 1 ? "visitor has" : "visitors have"} said yes so far.
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
