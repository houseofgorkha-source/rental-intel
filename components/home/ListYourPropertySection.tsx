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
        {/* Left: the tinted panel, mirroring the hero's right-hand panel. */}
        <div className="rounded-2xl bg-[#f6f6f4] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {roles.map((role) => (
              <Link
                key={role.href}
                href={role.href}
                className="flex flex-col rounded-xl bg-white p-5 transition hover:shadow-[0_18px_45px_-30px_rgba(15,23,42,0.45)]"
              >
                <span className="text-2xl" aria-hidden="true">
                  {role.icon}
                </span>
                <span className="mt-3 text-sm font-medium text-slate-950">
                  {role.title}
                </span>
                <span className="mt-1.5 text-sm leading-6 text-slate-600">
                  {role.description}
                </span>
                <span className="mt-3 text-sm font-medium text-blue-600">
                  Continue →
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Right: plain-background copy, pixel-aligned to the panel. */}
        <div className="max-w-md lg:order-last">
          <h2
            id="list-your-property-heading"
            className="text-3xl font-medium tracking-[-0.035em] text-slate-950 sm:text-4xl"
          >
            List your <span className="text-blue-600">property.</span>
          </h2>
          <p className="mt-4 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Whether you own it, live in it, or are adding it for someone else —
            start by telling us your connection to the property. Every
            submission is reviewed before it goes live.
          </p>
        </div>
      </div>
    </section>
  );
}
