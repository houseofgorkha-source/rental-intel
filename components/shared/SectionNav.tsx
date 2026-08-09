"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavSection = { href: string; label: string };

// The pill nav used by the account area and the admin workspace. It was
// written for /account and generalised — not duplicated — when /admin needed
// the same control, so the two surfaces cannot drift apart visually.
export default function SectionNav({
  sections,
  label,
}: {
  sections: NavSection[];
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="flex flex-wrap gap-2">
      {sections.map((section) => {
        const isActive = pathname === section.href;

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "border-accent bg-accent text-white shadow-[0_6px_18px_-6px_rgba(14,143,94,0.6)]"
                : "border-border-subtle bg-surface text-muted hover:-translate-y-0.5 hover:border-accent hover:text-accent"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
