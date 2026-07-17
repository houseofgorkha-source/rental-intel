type TrustBadgeProps = {
  type: "community" | "verified" | "tenant";
};

export default function TrustBadge({ type }: TrustBadgeProps) {
  if (type === "tenant") {
    return (
      <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
        🏠 Verified Tenant
      </span>
    );
  }

  if (type === "verified") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
        🟢 Verified User
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
      👤 Community Member
    </span>
  );
}