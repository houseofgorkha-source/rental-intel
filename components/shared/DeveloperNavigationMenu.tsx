"use client";

type DevRoute = {
  label: string;
  route: string;
  href: string | null;
  kind: "page" | "route";
  badge?: "WIP" | "Context Required" | "System Route";
};

type DevSection = {
  title: string;
  routes: DevRoute[];
};

type DeveloperNavigationMenuProps = {
  sampleProperty: { slug: string } | null;
  sampleReview: { slug: string; reviewId: string } | null;
  onNavigate: () => void;
};

// Single source of truth for every route in the app, for the dev-only
// navigation menu appended to AccountMenu. Dynamic ([slug]) routes are
// resolved to a real, working link using data fetched once in app/layout.tsx
// (a real published property's slug, and the current user's own most recent
// review, since /review/success and /review/verify only work for a review
// the logged-in user actually owns) — disabled with a badge when nothing
// real exists to link to, never a fake/dead link.
export default function DeveloperNavigationMenu({
  sampleProperty,
  sampleReview,
  onNavigate,
}: DeveloperNavigationMenuProps) {
  const propertyHref = sampleProperty ? `/property/${sampleProperty.slug}` : null;
  const reviewFormHref = sampleProperty ? `/property/${sampleProperty.slug}/review` : null;
  const reviewSuccessHref = sampleReview
    ? `/property/${sampleReview.slug}/review/success?reviewId=${sampleReview.reviewId}`
    : null;
  const reviewVerifyHref = sampleReview
    ? `/property/${sampleReview.slug}/review/verify?reviewId=${sampleReview.reviewId}`
    : null;

  const sections: DevSection[] = [
    {
      title: "Discovery",
      routes: [
        { label: "Home", route: "/", href: "/", kind: "page" },
        { label: "Search Properties", route: "/property", href: "/property", kind: "page" },
        {
          label: "Property Details",
          route: "/property/[slug]",
          href: propertyHref,
          kind: "page",
          badge: propertyHref ? undefined : "Context Required",
        },
      ],
    },
    {
      title: "Community",
      routes: [
        { label: "Add Property", route: "/add-property", href: "/add-property", kind: "page" },
        {
          label: "Review Property",
          route: "/property/[slug]/review",
          href: reviewFormHref,
          kind: "page",
          badge: reviewFormHref ? undefined : "Context Required",
        },
        {
          label: "Review Success",
          route: "/property/[slug]/review/success",
          href: reviewSuccessHref,
          kind: "page",
          badge: reviewSuccessHref ? undefined : "Context Required",
        },
        {
          label: "Review Verification",
          route: "/property/[slug]/review/verify",
          href: reviewVerifyHref,
          kind: "page",
          badge: reviewVerifyHref ? undefined : "Context Required",
        },
      ],
    },
    {
      title: "Account",
      routes: [
        { label: "Login", route: "/login", href: "/login", kind: "page" },
        { label: "Signup", route: "/signup", href: "/signup", kind: "page" },
      ],
    },
    {
      title: "Developer",
      routes: [
        {
          label: "Auth Callback",
          route: "/auth/callback",
          href: null,
          kind: "route",
          badge: "System Route",
        },
      ],
    },
  ];

  return (
    <div className="mt-1 border-t border-gray-100 pt-2">
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Pages
      </p>

      {sections.map((section) => (
        <div key={section.title} className="mt-1">
          <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-400">
            {section.title}
          </p>
          {section.routes.map((item) => (
            <DevRouteItem key={item.route} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DevRouteItem({ item, onNavigate }: { item: DevRoute; onNavigate: () => void }) {
  const badgeClass =
    item.kind === "route"
      ? "bg-gray-100 text-gray-500"
      : "bg-blue-50 text-blue-600";

  const content = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-gray-700">{item.label}</span>
        <span className="truncate font-mono text-[11px] text-gray-400">{item.route}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${badgeClass}`}>
          {item.kind}
        </span>
        {item.badge && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-600">
            {item.badge}
          </span>
        )}
      </span>
    </>
  );

  if (!item.href) {
    return (
      <div className="flex cursor-not-allowed items-center justify-between gap-2 rounded-lg px-3 py-2 opacity-50">
        {content}
      </div>
    );
  }

  return (
    <a
      href={item.href}
      onClick={onNavigate}
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-blue-50"
    >
      {content}
    </a>
  );
}
