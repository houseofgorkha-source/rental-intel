"use client";

type DevRoute = {
  label: string;
  route: string;
  href: string | null;
  kind: "page" | "route";
  badge?: "WIP" | "Context Required" | "System Route" | "Admin Only";
};

type DevSection = {
  title: string;
  routes: DevRoute[];
};

type DeveloperNavigationMenuProps = {
  sampleProperty: { slug: string } | null;
  sampleReview: { slug: string; reviewId: string } | null;
  // Admin-only samples: these routes are unreachable for anyone who isn't an
  // administrator, so they resolve to null for everyone else.
  sampleModerationProperty: { slug: string } | null;
  sampleVerification: { id: string } | null;
  // The signed-in user's own most recent property, for the edit route — which
  // is scoped to its creator and 404s for anyone else's.
  sampleOwnProperty: { slug: string } | null;
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
  sampleModerationProperty,
  sampleVerification,
  sampleOwnProperty,
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
        { label: "Find a Property to Review", route: "/review", href: "/review", kind: "page" },
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
          label: "Add Property (Owner)",
          route: "/add-property?as=owner",
          href: "/add-property?as=owner",
          kind: "page",
        },
        {
          label: "Add Property (Tenant)",
          route: "/add-property?as=tenant",
          href: "/add-property?as=tenant",
          kind: "page",
        },
        {
          label: "Add Property (Helper)",
          route: "/add-property?as=helper",
          href: "/add-property?as=helper",
          kind: "page",
        },
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
        { label: "Account Overview", route: "/account", href: "/account", kind: "page" },
        {
          label: "My Properties",
          route: "/account/properties",
          href: "/account/properties",
          kind: "page",
        },
        {
          label: "Edit Property",
          route: "/account/properties/[slug]/edit",
          // Scoped to a property this user created — the route 404s for
          // anyone else's, so linking a stranger's slug would be a dead link
          // dressed up as a working one.
          href: sampleOwnProperty
            ? `/account/properties/${sampleOwnProperty.slug}/edit`
            : null,
          kind: "page",
          badge: sampleOwnProperty ? undefined : "Context Required",
        },
        { label: "My Reviews", route: "/account/reviews", href: "/account/reviews", kind: "page" },
        { label: "Saved", route: "/account/wishlist", href: "/account/wishlist", kind: "page" },
        { label: "Messages", route: "/account/messages", href: "/account/messages", kind: "page" },
        {
          label: "My Verifications",
          route: "/account/verifications",
          href: "/account/verifications",
          kind: "page",
        },
        { label: "Profile", route: "/account/profile", href: "/account/profile", kind: "page" },
        { label: "Login", route: "/login", href: "/login", kind: "page" },
        { label: "Signup", route: "/signup", href: "/signup", kind: "page" },
      ],
    },
    {
      title: "Moderation",
      routes: [
        // The three list routes are always linked: an administrator lands on
        // the queue, and anyone else gets the 404 the route itself returns —
        // which is the accurate outcome, not a broken link.
        { label: "Moderation Queue", route: "/admin", href: "/admin", kind: "page" },
        { label: "Moderate Properties", route: "/admin/properties", href: "/admin/properties", kind: "page" },
        {
          label: "Inspect Submission",
          route: "/admin/properties/[slug]",
          href: sampleModerationProperty
            ? `/admin/properties/${sampleModerationProperty.slug}`
            : null,
          kind: "page",
          badge: sampleModerationProperty ? undefined : "Admin Only",
        },
        {
          label: "Moderate Verifications",
          route: "/admin/verifications",
          href: "/admin/verifications",
          kind: "page",
        },
        {
          label: "Inspect Verification",
          route: "/admin/verifications/[id]",
          href: sampleVerification ? `/admin/verifications/${sampleVerification.id}` : null,
          kind: "page",
          badge: sampleVerification ? undefined : "Admin Only",
        },
        { label: "Inspect Reviews", route: "/admin/reviews", href: "/admin/reviews", kind: "page" },
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
    <div className="mt-1 border-t border-border-subtle pt-2">
      <p className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        Pages
      </p>

      {sections.map((section) => (
        <div key={section.title} className="mt-1">
          <p className="px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
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
      ? "bg-surface-raised text-muted"
      : "bg-accent/10 text-accent";

  const content = (
    <>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-foreground">{item.label}</span>
        <span className="truncate font-mono text-[11px] text-muted">{item.route}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${badgeClass}`}>
          {item.kind}
        </span>
        {item.badge && (
          <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-warning">
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
      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-colors hover:bg-surface-raised"
    >
      {content}
    </a>
  );
}
