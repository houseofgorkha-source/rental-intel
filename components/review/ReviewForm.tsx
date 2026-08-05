"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReview } from "@/app/actions/review";
import StarRating from "./StarRating";
import {
  negativeOwnerTraits,
  positiveOwnerTraits,
  quickRatingCategories,
  rentAgainOptions,
  type RentAgainOption,
} from "./reviewCategories";

type YesNoValue = "yes" | "no" | null;

type YesNoFieldProps = {
  label: string;
  value: YesNoValue;
  onChange: (value: YesNoValue) => void;
};

function YesNoField({ label, value, onChange }: YesNoFieldProps) {
  return (
    <fieldset>
      <legend className="mb-3 font-medium text-gray-900">{label}</legend>

      <div className="flex gap-6">
        {(["yes", "no"] as const).map((option) => (
          <label key={option} className="flex items-center text-gray-700">
            <input
              type="radio"
              name={label}
              checked={value === option}
              onChange={() => onChange(option)}
              className="mr-2"
            />
            {option === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type ReviewFormProps = {
  propertyId: string;
};

export default function ReviewForm({ propertyId }: ReviewFormProps) {
  const [overallRating, setOverallRating] = useState(0);
  const [wouldRecommend, setWouldRecommend] = useState<YesNoValue>(null);
  const [wouldRentAgain, setWouldRentAgain] = useState<RentAgainOption | null>(
    null,
  );
  const [quickRatings, setQuickRatings] = useState<Record<string, number>>({});
  const [ownerRating, setOwnerRating] = useState(0);
  const [positiveTraits, setPositiveTraits] = useState<string[]>([]);
  const [negativeTraits, setNegativeTraits] = useState<string[]>([]);
  const [depositTaken, setDepositTaken] = useState<YesNoValue>(null);
  const [depositMoreThanTwoMonths, setDepositMoreThanTwoMonths] =
    useState<YesNoValue>(null);
  const [depositReturned, setDepositReturned] = useState<YesNoValue>(null);
  const [returnedOnTime, setReturnedOnTime] = useState<YesNoValue>(null);
  const [additionalDeductions, setAdditionalDeductions] =
    useState<YesNoValue>(null);
  const [depositMonths, setDepositMonths] = useState("");
  const [deductionReason, setDeductionReason] = useState("");
  const [deductionAmount, setDeductionAmount] = useState("");
  const [depositExperience, setDepositExperience] = useState(0);
  const [comment, setComment] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!wouldRecommend) {
      setSubmissionError("Please say whether you would recommend this property.");
      return;
    }

    setSubmissionError(null);
    setIsSubmitting(true);

    const result = await createReview({
      propertyId,
      overallRating,
      recommendation: wouldRecommend,
      comment,
      wouldRentAgain,
      quickRatings,
      ownerRating,
      positiveTraits,
      negativeTraits,
      depositTaken,
      depositMonths: depositMonths.trim() ? Number(depositMonths) : null,
      depositMoreThanTwoMonths,
      depositReturned,
      depositReturnedOnTime: returnedOnTime,
      depositAdditionalDeductions: additionalDeductions,
      depositDeductionReason: deductionReason,
      depositDeductionAmount: deductionAmount.trim() ? Number(deductionAmount) : null,
      depositExperienceRating: depositExperience,
    });

    if (!result.reviewId) {
      setSubmissionError(result.error ?? "Unable to publish your review. Please try again.");
      setIsSubmitting(false);
      return;
    }

    router.push(`${window.location.pathname}/success?reviewId=${result.reviewId}`);
  };

  const toggleTrait = (
    trait: string,
    setTraits: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setTraits((currentTraits) =>
      currentTraits.includes(trait)
        ? currentTraits.filter((item) => item !== trait)
        : [...currentTraits, trait],
    );
  };

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-8">
      <div className="space-y-10">
        <section>
          <h2 className="text-2xl font-semibold text-gray-900">
            Overall Experience
          </h2>

          <div className="mt-6 space-y-6">
            <StarRating
              label="Overall Rating"
              value={overallRating}
              onChange={setOverallRating}
            />

            <YesNoField
              label="Would you recommend this property?"
              value={wouldRecommend}
              onChange={setWouldRecommend}
            />

            <fieldset>
              <legend className="mb-3 font-medium text-gray-900">
                Would you rent this property again?
              </legend>

              <div className="flex flex-wrap gap-3">
                {rentAgainOptions.map((option) => (
                  <label
                    key={option}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                      wouldRentAgain === option
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="would-rent-again"
                      value={option}
                      checked={wouldRentAgain === option}
                      onChange={() => setWouldRentAgain(option)}
                      className="sr-only"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900">
            Quick Ratings
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {quickRatingCategories.map((category) => (
              <StarRating
                key={category.id}
                label={category.label}
                value={quickRatings[category.id] ?? 0}
                onChange={(value) =>
                  setQuickRatings((currentRatings) => ({
                    ...currentRatings,
                    [category.id]: value,
                  }))
                }
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900">
            Owner Behaviour
          </h2>

          <div className="mt-6 space-y-6">
            <StarRating
              label="Overall Owner Rating"
              value={ownerRating}
              onChange={setOwnerRating}
            />

            <div>
              <h3 className="font-medium text-gray-900">Positive traits</h3>

              <div className="mt-3 flex flex-wrap gap-3">
                {positiveOwnerTraits.map((trait) => (
                  <label
                    key={trait}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                      positiveTraits.includes(trait)
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={positiveTraits.includes(trait)}
                      onChange={() => toggleTrait(trait, setPositiveTraits)}
                      className="sr-only"
                    />
                    {trait}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900">Negative traits</h3>

              <div className="mt-3 flex flex-wrap gap-3">
                {negativeOwnerTraits.map((trait) => (
                  <label
                    key={trait}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                      negativeTraits.includes(trait)
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={negativeTraits.includes(trait)}
                      onChange={() => toggleTrait(trait, setNegativeTraits)}
                      className="sr-only"
                    />
                    {trait}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900">
            Security Deposit
          </h2>

          <div className="mt-6">
            <YesNoField
              label="Was a security deposit taken?"
              value={depositTaken}
              onChange={setDepositTaken}
            />
          </div>

          {depositTaken === "yes" && (
            <div className="mt-6 space-y-6 rounded-2xl border border-gray-200 bg-gray-50 p-6">
              <div>
                <label className="mb-2 block font-medium text-gray-900">
                  Deposit amount (months of rent)
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={depositMonths}
                  onChange={(event) => setDepositMonths(event.target.value)}
                  placeholder="For example, 2"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
                />
              </div>

              <YesNoField
                label="Was the deposit more than two months' rent?"
                value={depositMoreThanTwoMonths}
                onChange={setDepositMoreThanTwoMonths}
              />

              <YesNoField
                label="Was the deposit returned?"
                value={depositReturned}
                onChange={setDepositReturned}
              />

              <YesNoField
                label="Was it returned within the agreed timeline?"
                value={returnedOnTime}
                onChange={setReturnedOnTime}
              />

              <YesNoField
                label="Were additional deductions made?"
                value={additionalDeductions}
                onChange={setAdditionalDeductions}
              />

              {additionalDeductions === "yes" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-medium text-gray-900">
                      Deduction reason
                    </label>

                    <input
                      type="text"
                      value={deductionReason}
                      onChange={(event) => setDeductionReason(event.target.value)}
                      placeholder="For example, repair charges"
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-medium text-gray-900">
                      Approximate deduction amount
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={deductionAmount}
                      onChange={(event) => setDeductionAmount(event.target.value)}
                      placeholder="Amount in ₹"
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
                    />
                  </div>
                </div>
              )}

              <StarRating
                label="Overall deposit experience"
                value={depositExperience}
                onChange={setDepositExperience}
              />
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-gray-900">
            Additional Comments
          </h2>

          <textarea
            rows={6}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share anything else future tenants should know..."
            className="mt-6 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition-colors focus:border-blue-600"
          />
        </section>
      </div>

      <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <h2 className="font-semibold text-gray-900">
          Current Verification Status
        </h2>

        <p className="mt-2 text-gray-700">⚪ Unverified</p>

        <p className="mt-2 text-sm text-gray-600">
          You can verify later by uploading supporting documents.
        </p>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="mt-10 w-full rounded-full bg-blue-600 px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
      >
        {isSubmitting ? "Publishing..." : "Publish My Experience"}
      </button>

      {submissionError && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {submissionError}
        </p>
      )}
    </div>
  );
}
