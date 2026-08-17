"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createReview, updateReview } from "@/app/actions/review";
import StarRating from "./StarRating";
import UseMyLocationButton from "../shared/UseMyLocationButton";
import { isNearArea, type Coordinates } from "@/lib/area-coordinates";
import { AMENITIES } from "@/lib/property-attributes";
import { parseWholeAmount } from "@/lib/property-format";
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
  helperText?: string;
};

function YesNoField({ label, value, onChange, helperText }: YesNoFieldProps) {
  return (
    <fieldset>
      <legend className="mb-3 font-medium text-foreground">{label}</legend>
      {helperText && <p className="-mt-2 mb-3 text-sm text-muted">{helperText}</p>}

      <div className="flex gap-6">
        {(["yes", "no"] as const).map((option) => (
          <label key={option} className="flex items-center text-muted">
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

// The fields an existing review is prefilled from, when editing. Shaped to
// match the form's own state one-to-one rather than the raw DB row, so the
// page fetching this can do its own boolean->YesNoValue mapping once instead
// of this component doing it per field.
export type ExistingReview = {
  id: string;
  overallRating: number;
  wouldRecommend: YesNoValue;
  wouldRentAgain: RentAgainOption | null;
  quickRatings: Record<string, number>;
  ownerRating: number;
  positiveTraits: string[];
  negativeTraits: string[];
  depositTaken: YesNoValue;
  depositAmount: number | null;
  depositMoreThanTwoMonths: YesNoValue;
  depositReturned: YesNoValue;
  depositReturnedOnTime: YesNoValue;
  depositAdditionalDeductions: YesNoValue;
  depositDeductionReason: string;
  depositDeductionAmount: number | null;
  depositExperienceRating: number;
  comment: string;
  isAnonymous: boolean;
  amenities: string[];
};

type ReviewFormProps = {
  propertyId: string;
  propertyArea: string;
  // Present only when amending an existing review — switches the form to
  // update_review instead of create_review and prefills every field. Absent
  // for a brand-new review, which keeps every field at its original blank
  // default.
  existingReview?: ExistingReview;
};

export default function ReviewForm({ propertyId, propertyArea, existingReview }: ReviewFormProps) {
  const isEditing = Boolean(existingReview);

  // A UI trust signal only — never blocks or affects review submission, and
  // the coordinates used to compute it are never sent to createReview or
  // stored anywhere.
  const [isNearProperty, setIsNearProperty] = useState<boolean | null>(null);
  const [overallRating, setOverallRating] = useState(existingReview?.overallRating ?? 0);
  const [wouldRecommend, setWouldRecommend] = useState<YesNoValue>(
    existingReview?.wouldRecommend ?? null,
  );
  const [wouldRentAgain, setWouldRentAgain] = useState<RentAgainOption | null>(
    existingReview?.wouldRentAgain ?? null,
  );
  const [quickRatings, setQuickRatings] = useState<Record<string, number>>(
    existingReview?.quickRatings ?? {},
  );
  const [ownerRating, setOwnerRating] = useState(existingReview?.ownerRating ?? 0);
  const [positiveTraits, setPositiveTraits] = useState<string[]>(
    existingReview?.positiveTraits ?? [],
  );
  const [negativeTraits, setNegativeTraits] = useState<string[]>(
    existingReview?.negativeTraits ?? [],
  );
  const [depositTaken, setDepositTaken] = useState<YesNoValue>(
    existingReview?.depositTaken ?? null,
  );
  const [depositMoreThanTwoMonths, setDepositMoreThanTwoMonths] = useState<YesNoValue>(
    existingReview?.depositMoreThanTwoMonths ?? null,
  );
  const [depositReturned, setDepositReturned] = useState<YesNoValue>(
    existingReview?.depositReturned ?? null,
  );
  const [returnedOnTime, setReturnedOnTime] = useState<YesNoValue>(
    existingReview?.depositReturnedOnTime ?? null,
  );
  const [additionalDeductions, setAdditionalDeductions] = useState<YesNoValue>(
    existingReview?.depositAdditionalDeductions ?? null,
  );
  const [depositAmount, setDepositAmount] = useState(
    existingReview?.depositAmount != null ? String(existingReview.depositAmount) : "",
  );
  const [deductionReason, setDeductionReason] = useState(
    existingReview?.depositDeductionReason ?? "",
  );
  const [deductionAmount, setDeductionAmount] = useState(
    existingReview?.depositDeductionAmount != null
      ? String(existingReview.depositDeductionAmount)
      : "",
  );
  const [depositExperience, setDepositExperience] = useState(
    existingReview?.depositExperienceRating ?? 0,
  );
  const [comment, setComment] = useState(existingReview?.comment ?? "");
  const [isAnonymous, setIsAnonymous] = useState(existingReview?.isAnonymous ?? false);
  const [amenities, setAmenities] = useState<string[]>(existingReview?.amenities ?? []);
  // Collapsed by default for a new review — most reviews don't bother, and
  // the button itself is the affordance. Already open when editing a review
  // that has amenities selected, so nothing already chosen is hidden.
  const [showAmenities, setShowAmenities] = useState((existingReview?.amenities.length ?? 0) > 0);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const toggleAmenity = (amenity: string) => {
    setAmenities((current) =>
      current.includes(amenity)
        ? current.filter((item) => item !== amenity)
        : [...current, amenity],
    );
  };

  const handleSubmit = async () => {
    if (overallRating < 1) {
      setSubmissionError("Please give an overall rating.");
      return;
    }

    setSubmissionError(null);
    setIsSubmitting(true);

    // "Would you recommend?" is no longer required on its own — the star
    // rating above is the one mandatory signal every review platform anchors
    // on. If the reviewer skipped this question, it's derived from the
    // rating they did give rather than blocking submission over a second,
    // largely redundant yes/no.
    const recommendation = wouldRecommend ?? (overallRating >= 3 ? "yes" : "no");

    const fields = {
      overallRating,
      recommendation,
      comment,
      wouldRentAgain,
      quickRatings,
      ownerRating,
      positiveTraits,
      negativeTraits,
      depositTaken,
      depositAmount: parseWholeAmount(depositAmount),
      depositMoreThanTwoMonths,
      depositReturned,
      depositReturnedOnTime: returnedOnTime,
      depositAdditionalDeductions: additionalDeductions,
      // Cleared unless "yes" is the current answer — otherwise toggling this
      // question back to "No" (or leaving it unanswered) after having typed
      // a reason/amount would resubmit stale deduction details that
      // contradict the flag actually being sent.
      depositDeductionReason: additionalDeductions === "yes" ? deductionReason : "",
      depositDeductionAmount: additionalDeductions === "yes" ? parseWholeAmount(deductionAmount) : null,
      depositExperienceRating: depositExperience,
      isAnonymous,
      amenities,
    };

    const result = existingReview
      ? await updateReview({ reviewId: existingReview.id, ...fields })
      : await createReview({ propertyId, ...fields });

    if (!result.reviewId) {
      setSubmissionError(
        result.error ??
          (isEditing
            ? "Unable to save your changes. Please try again."
            : "Unable to publish your review. Please try again."),
      );
      setIsSubmitting(false);
      return;
    }

    if (isEditing) {
      router.push(`${window.location.pathname.replace(/\/review$/, "")}`);
      router.refresh();
    } else {
      router.push(`${window.location.pathname}/success?reviewId=${result.reviewId}`);
    }
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
    <div className="mx-auto max-w-4xl rounded-2xl border border-border-subtle bg-surface p-5 sm:p-8">
      <div className="space-y-10">
        <section>
          <h2 className="text-2xl font-semibold text-foreground">
            Overall Experience
          </h2>

          <div className="mt-6 space-y-6">
            <div>
              <UseMyLocationButton
                label="Confirm you're near this property"
                compact
                onLocated={(coordinates: Coordinates) =>
                  setIsNearProperty(isNearArea(coordinates, propertyArea))
                }
              />
              {isNearProperty && (
                <p className="mt-1.5 text-sm font-medium text-success">
                  ✓ You&apos;re currently near this property.
                </p>
              )}
            </div>

            <StarRating
              label="Overall Rating"
              value={overallRating}
              onChange={setOverallRating}
              required
            />

            <YesNoField
              label="Would you recommend this property? (optional)"
              value={wouldRecommend}
              onChange={setWouldRecommend}
            />

            <fieldset>
              <legend className="mb-3 font-medium text-foreground">
                Would you rent this property again?
              </legend>

              <div className="flex flex-wrap gap-3">
                {rentAgainOptions.map((option) => (
                  <label
                    key={option}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                      wouldRentAgain === option
                        ? "bg-accent text-white"
                        : "border border-border-subtle bg-surface text-muted hover:bg-surface-raised"
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
          <h2 className="text-2xl font-semibold text-foreground">
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
          <h2 className="text-2xl font-semibold text-foreground">
            Owner Behaviour
          </h2>

          <div className="mt-6 space-y-6">
            <StarRating
              label="Overall Owner Rating"
              value={ownerRating}
              onChange={setOwnerRating}
            />

            <div>
              <h3 className="font-medium text-foreground">Positive traits</h3>

              <div className="mt-3 flex flex-wrap gap-3">
                {positiveOwnerTraits.map((trait) => (
                  <label
                    key={trait}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                      positiveTraits.includes(trait)
                        ? "bg-accent text-white"
                        : "border border-border-subtle bg-surface text-muted hover:bg-surface-raised"
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
              <h3 className="font-medium text-foreground">Negative traits</h3>

              <div className="mt-3 flex flex-wrap gap-3">
                {negativeOwnerTraits.map((trait) => (
                  <label
                    key={trait}
                    className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                      negativeTraits.includes(trait)
                        ? "bg-accent text-white"
                        : "border border-border-subtle bg-surface text-muted hover:bg-surface-raised"
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
          <h2 className="text-2xl font-semibold text-foreground">
            Amenities
          </h2>
          <p className="mt-1 text-sm text-muted">
            Confirm which amenities this property actually had during your stay.
          </p>

          {!showAmenities ? (
            <button
              type="button"
              onClick={() => setShowAmenities(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-accent transition hover:border-accent/40 hover:bg-surface-raised"
            >
              + Add Amenities
            </button>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {AMENITIES.map((amenity) => (
                <label
                  key={amenity}
                  className="flex cursor-pointer items-center gap-2 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={amenities.includes(amenity)}
                    onChange={() => toggleAmenity(amenity)}
                    className="accent-blue-600"
                  />
                  {amenity}
                </label>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground">
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
            <div className="mt-6 space-y-6 rounded-2xl border border-border-subtle bg-surface-raised p-6">
              <div>
                <label className="mb-2 block font-medium text-foreground">
                  Total security deposit paid (₹)
                </label>

                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={depositAmount}
                  onChange={(event) => setDepositAmount(event.target.value)}
                  placeholder="For example, 150000"
                  className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-foreground outline-none transition-colors focus:border-accent"
                />
              </div>

              <YesNoField
                label="Was the deposit more than two months' rent?"
                helperText="In Karnataka, rental security deposits are conventionally capped around two months' rent."
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
                label="Were any deductions made beyond what was agreed in your rental agreement?"
                value={additionalDeductions}
                onChange={setAdditionalDeductions}
              />

              {additionalDeductions === "yes" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-medium text-foreground">
                      Deduction reason
                    </label>

                    <input
                      type="text"
                      value={deductionReason}
                      onChange={(event) => setDeductionReason(event.target.value)}
                      placeholder="For example, repair charges"
                      className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-foreground outline-none transition-colors focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-medium text-foreground">
                      Approximate deduction amount
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={deductionAmount}
                      onChange={(event) => setDeductionAmount(event.target.value)}
                      placeholder="Amount in ₹"
                      className="w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-foreground outline-none transition-colors focus:border-accent"
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
          <h2 className="text-2xl font-semibold text-foreground">
            Additional Comments
          </h2>

          <textarea
            rows={6}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Share anything else future tenants should know..."
            className="mt-6 w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-foreground outline-none transition-colors focus:border-accent"
          />

          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-border-subtle bg-surface-raised p-4">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-foreground">
                Post this review anonymously
              </span>
              <span className="mt-1 block text-sm text-muted">
                Your name won&apos;t be shown on this review — it will display
                as &quot;Anonymous&quot; instead. The review, rating and any
                deposit details you shared are still published as usual.
              </span>
            </span>
          </label>
        </section>
      </div>

      {!isEditing && (
        <div className="mt-10 rounded-2xl border border-border-subtle bg-surface-raised p-5">
          <h2 className="font-semibold text-foreground">
            Current Verification Status
          </h2>

          <p className="mt-2 text-muted">⚪ Unverified</p>

          <p className="mt-2 text-sm text-muted">
            You can verify later by uploading supporting documents.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSubmitting}
        aria-busy={isSubmitting}
        className="mt-10 w-full rounded-full bg-accent px-6 py-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:bg-surface-raised disabled:text-muted disabled:hover:bg-surface-raised"
      >
        {isSubmitting
          ? isEditing
            ? "Saving..."
            : "Publishing..."
          : isEditing
            ? "Save Changes"
            : "Publish My Experience"}
      </button>

      {submissionError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {submissionError}
        </p>
      )}
    </div>
  );
}
