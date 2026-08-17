import Link from "next/link";

type OwnReview = {
  id: string;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  // What backs a "verified" status, e.g. "Rental agreement and Rent receipt".
  // Only ever meaningful when verification_status === "verified"; null
  // otherwise. Same disclosure ReviewCard shows publicly, kept in sync here
  // rather than a second wording.
  verifiedVia: string | null;
} | null;

type ContributionStatusCardsProps = {
  propertySlug: string;
  propertyStatus: "pending" | "published" | "rejected";
  submittedAs: "owner" | "tenant" | "helper" | null;
  isAvailable: boolean;
  ownReview: OwnReview;
  // Whether the CURRENT VIEWER is the person who submitted this property —
  // not a fact about the property itself. The owner/helper restrictions
  // below describe why THAT PERSON specifically can't review it (they listed
  // it commercially, or they never lived there); they say nothing about
  // anyone else looking at the same page, who should always get the normal
  // write/edit review flow. See the RLS policy this mirrors: it blocks only
  // `submitted_as = 'owner' and created_by = auth.uid()`, not every reviewer.
  isContributor: boolean;
};

function StatusCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">{label}</p>
      <div className="mt-1.5 text-sm">{children}</div>
    </div>
  );
}

function PropertyStatusCard({ propertyStatus }: { propertyStatus: string }) {
  return (
    <StatusCard label="Property">
      {propertyStatus === "published" ? (
        <span className="font-medium text-success">✅ Published</span>
      ) : propertyStatus === "rejected" ? (
        <span className="font-medium text-red-700">❌ Not Approved</span>
      ) : (
        <span className="font-medium text-warning">⏳ Pending Approval</span>
      )}
    </StatusCard>
  );
}

const actionLinkClass =
  "font-medium text-accent underline decoration-accent/40 underline-offset-4 transition hover:text-accent-hover hover:decoration-accent";

// The property page's permanent, always-visible dashboard for the current
// viewer's own contribution to this property. Never hidden behind a click —
// showing the whole workflow up front is a deliberate product decision
// (CLAUDE.md §25).
//
// Which cards appear depends on how THIS VIEWER themselves related to the
// property (`submitted_as`, but only when `isContributor` is also true),
// because the three roles have genuinely different workflows — not because
// the UI is being decorative:
//   owner  -> property + listing management. An owner cannot review the
//             property they themselves listed (enforced in RLS, not just
//             here) — everyone else viewing that same property still gets
//             the normal review flow below.
//   helper -> property only, for the person who added it. Someone who added
//             a property on another person's behalf has no first-hand
//             experience to review — again, only for that specific person.
//   tenant / legacy(null) / any non-contributor visitor -> the original
//             three cards, unchanged.
export default function ContributionStatusCards({
  propertySlug,
  propertyStatus,
  submittedAs,
  isAvailable,
  ownReview,
  isContributor,
}: ContributionStatusCardsProps) {
  if (isContributor && submittedAs === "owner") {
    return (
      <>
        <PropertyStatusCard propertyStatus={propertyStatus} />

        {/* No "Manage listing" action. A property record has no amendment
            flow at all — its columns are unreachable through the Data API by
            design, so that a review can never end up attached to a property
            that has since been rewritten. The state is still shown, because
            it is real; it just isn't editable by anyone. */}
        <StatusCard label="Listing">
          <p className="font-medium text-muted">
            {isAvailable ? "🟢 Available for rent" : "⚪ Not currently available"}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">
            Listing details are fixed once submitted.
          </p>
        </StatusCard>

        <StatusCard label="Review">
          <p className="text-xs leading-5 text-muted">
            Owners can&apos;t review their own property. Reviews come from people
            who have lived here.
          </p>
        </StatusCard>
      </>
    );
  }

  if (isContributor && submittedAs === "helper") {
    return (
      <>
        <PropertyStatusCard propertyStatus={propertyStatus} />

        <StatusCard label="Review">
          <p className="text-xs leading-5 text-muted">
            Thanks for adding this property. Reviews can only be written by
            someone who has lived here.
          </p>
        </StatusCard>
      </>
    );
  }

  return (
    <>
      <PropertyStatusCard propertyStatus={propertyStatus} />

      <StatusCard label="Review">
        {!ownReview ? (
          <Link href={`/property/${propertySlug}/review`} className={actionLinkClass}>
            Write Review →
          </Link>
        ) : (
          <>
            {propertyStatus === "published" ? (
              <span className="font-medium text-success">✅ Review Published</span>
            ) : (
              <span className="font-medium text-warning">⏳ Review Pending Approval</span>
            )}
            <div className="mt-1.5">
              <Link href={`/property/${propertySlug}/review`} className={actionLinkClass}>
                Edit Review →
              </Link>
            </div>
          </>
        )}
      </StatusCard>

      {/* Adding a property requires no verification of any kind -- this card
          used to render unconditionally, showing "Verify My Stay" (disabled,
          "write a review first") the instant Add Property finished, before
          a review even existed to verify. That read as Add Property itself
          demanding verification, which it never has and still doesn't:
          submission succeeds regardless of this card. Stay verification is
          real and untouched here -- it only becomes relevant, and only
          appears, once there is an actual review to attach it to. */}
      {ownReview && (
        <StatusCard label="Stay Verification">
          {ownReview.verification_status === "verified" ? (
            <>
              <span className="font-medium text-success">✅ Verified Tenant</span>
              {ownReview.verifiedVia && (
                <p className="mt-1 text-xs text-muted">Verified via {ownReview.verifiedVia}</p>
              )}
            </>
          ) : ownReview.verification_status === "pending" ? (
            <span className="font-medium text-warning">⏳ Verification Pending</span>
          ) : ownReview.verification_status === "rejected" ? (
            <span className="font-medium text-red-700">❌ Verification Rejected</span>
          ) : (
            <Link
              href={`/property/${propertySlug}/review/verify?reviewId=${ownReview.id}`}
              className={actionLinkClass}
            >
              Verify My Stay →
            </Link>
          )}
        </StatusCard>
      )}
    </>
  );
}
