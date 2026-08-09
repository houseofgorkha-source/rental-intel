import Link from "next/link";

type OwnReview = {
  id: string;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
} | null;

type ContributionStatusCardsProps = {
  propertySlug: string;
  propertyStatus: "pending" | "published" | "rejected";
  submittedAs: "owner" | "tenant" | "helper" | null;
  isAvailable: boolean;
  ownReview: OwnReview;
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
// Which cards appear depends on how the submitter described their
// relationship to the property (`submitted_as`), because the three roles have
// genuinely different workflows — not because the UI is being decorative:
//   owner  -> property + listing management. Owners cannot review their own
//             property (enforced in RLS, not just here).
//   helper -> property only. Someone adding a property on another person's
//             behalf has no first-hand experience to review.
//   tenant / legacy(null) -> the original three cards, unchanged.
export default function ContributionStatusCards({
  propertySlug,
  propertyStatus,
  submittedAs,
  isAvailable,
  ownReview,
}: ContributionStatusCardsProps) {
  if (submittedAs === "owner") {
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

  if (submittedAs === "helper") {
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
        ) : propertyStatus === "published" ? (
          <span className="font-medium text-success">✅ Review Published</span>
        ) : (
          <span className="font-medium text-warning">⏳ Review Pending Approval</span>
        )}
      </StatusCard>

      <StatusCard label="Stay Verification">
        {!ownReview ? (
          <div className="text-muted">
            <span className="font-medium text-muted">Verify My Stay</span>
            <p className="mt-1 text-xs leading-5">
              Write a review first. Verification is available after you&apos;ve submitted a review.
            </p>
          </div>
        ) : ownReview.verification_status === "verified" ? (
          <span className="font-medium text-success">✅ Verified Tenant</span>
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
    </>
  );
}
