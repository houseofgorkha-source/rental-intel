type TrustBadgeProps = {
  type: "community" | "verified" | "tenant";
};

export default function TrustBadge({ type }: TrustBadgeProps) {
  if (type === "tenant") {
    return (
      <span className="inline-flex items-center rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success ring-1 ring-inset ring-success/30">
        🏠 Verified Tenant
      </span>
    );
  }

  if (type === "verified") {
    return (
      <span className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent ring-1 ring-inset ring-accent/30">
        🟢 Verified User
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-surface-raised px-3 py-1 text-sm font-medium text-muted ring-1 ring-inset ring-border-subtle">
      👤 Community Member
    </span>
  );
}