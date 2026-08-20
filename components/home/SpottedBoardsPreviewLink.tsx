import Link from "next/link";

// Dev-only pointer to /spotted-boards-preview — a technical preview of the
// tolet-vision pipeline's automated board detection, not the crowdsourced
// SpottedBoardsSection above it. Rendering is gated by the caller
// (app/page.tsx checks NEXT_PUBLIC_SHOW_DEV_NAV, the same flag
// DeveloperNavigationMenu.tsx uses) so this never appears off-flag.
export default function SpottedBoardsPreviewLink() {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border-subtle bg-surface-raised/60 p-4 text-sm sm:p-5">
      <p className="text-muted">
        <span className="font-medium text-foreground">Dev preview:</span> boards found automatically by scanning
        Street View imagery (tolet-vision pipeline).
      </p>
      <Link
        href="/spotted-boards-preview"
        className="shrink-0 rounded-full border border-accent px-4 py-2 font-medium text-accent transition hover:bg-accent hover:text-white"
      >
        View detections →
      </Link>
    </div>
  );
}
