import Link from "next/link";

// Mirrors the hero's two-column pattern per CLAUDE.md §10 — same rounded-2xl
// #f6f6f4 panel on the page's #fbfbfa background, no borders — but flipped,
// so the tinted panel sits on the left and the copy on the right. A server
// component with no state: it's three links, not a second submission flow.
const roles = [
  {
    href: "/add-property?as=owner",
    icon: "🏠",
    title: "I own this property",
    description: "List it for rent with your asking rent and deposit.",
  },
  {
    href: "/add-property?as=tenant",
    icon: "🔑",
    title: "I live or lived here",
    description: "Share your experience and verify your stay.",
  },
  {
    href: "/add-property?as=helper",
    icon: "🤝",
    title: "I'm helping someone",
    description: "Add a property on an owner's or tenant's behalf.",
  },
];

export default function ListYourPropertySection() {
  return (
    <section
      aria-labelledby="list-your-property-heading"
      className="mt-16 lg:mt-24"
    >
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
        {/* DOM order is heading-first so it reads as a proper section
            heading on mobile (single-column stack) instead of the role
            cards appearing with no heading above them. `lg:order-last`
            below puts it back on the right at `lg`+, restoring the
            original "tinted panel left, copy right" desktop layout — the
            panel needs no matching `lg:order-first` since it keeps its
            default order (0), which already sorts before `order-last`. */}
        <div className="max-w-md lg:order-last">
          <h2
            id="list-your-property-heading"
            className="text-3xl font-medium tracking-[-0.035em] text-foreground sm:text-4xl"
          >
            List your <span className="text-accent">property.</span>
          </h2>
          <p className="mt-4 text-sm leading-6 text-muted sm:text-base sm:leading-7">
            Whether you own it, live in it, or are adding it for someone else —
            start by telling us your connection to the property. It goes live
            as soon as you submit it.
          </p>
        </div>

        {/* The tinted panel, mirroring the hero's right-hand panel. */}
        <div className="rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgba(14,143,94,0.04)] sm:p-6">
          {/* All three in one row at every width, including mobile — cards
              go compact (centered icon+title, description hidden) below
              `sm` purely because there isn't room for the full card at a
              third of a phone's width; `sm`+ is untouched from before. */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {roles.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                // Visible accent-green border + shadow at rest on mobile
                // (touch has no hover to reveal an accent border with) so
                // these read clearly as tappable cards; desktop keeps the
                // original hover-reveal treatment unchanged (transparent at
                // rest, accent border only on hover).
                className="flex flex-col items-center rounded-xl border-2 border-accent bg-surface p-4 text-center shadow-[0_1px_2px_rgba(14,143,94,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_-20px_rgba(14,143,94,0.5)] sm:border sm:border-transparent sm:p-5 sm:text-left sm:shadow-none sm:hover:border-accent/60"
              >
                <span className="text-2xl" aria-hidden="true">
                  {role.icon}
                </span>
                <span className="mt-2 text-sm font-medium leading-tight text-foreground sm:mt-3 sm:leading-normal">
                  {role.title}
                </span>
                <span className="mt-1.5 hidden text-sm leading-6 text-muted sm:block">
                  {role.description}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
