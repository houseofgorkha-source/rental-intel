"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/account", label: "Overview" },
  { href: "/account/properties", label: "My Properties" },
  { href: "/account/reviews", label: "My Reviews" },
  { href: "/account/verifications", label: "Verifications" },
  { href: "/account/profile", label: "Profile" },
];

// The account area's only chrome. Every section page renders its own heading
// and content and nothing else — no repeated wrappers, no per-section nav.
export default function AccountSectionNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account sections" className="flex flex-wrap gap-2">
      {sections.map((section) => {
        const isActive = pathname === section.href;

        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              isActive
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-600"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
