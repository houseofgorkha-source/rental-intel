"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/actions/auth";
import DeveloperNavigationMenu from "@/components/shared/DeveloperNavigationMenu";

type AccountMenuProps = {
  email: string;
  // Dev-nav-only — resolved server-side in app/layout.tsx, only when
  // NEXT_PUBLIC_SHOW_DEV_NAV is set. Always null/undefined otherwise, so
  // these props are inert in production.
  sampleProperty?: { slug: string } | null;
  sampleOwnProperty?: { slug: string } | null;
  sampleReview?: { slug: string; reviewId: string } | null;
};

const SHOW_DEV_NAV = process.env.NEXT_PUBLIC_SHOW_DEV_NAV === "true";

export default function AccountMenu({
  email,
  sampleProperty = null,
  sampleOwnProperty = null,
  sampleReview = null,
}: AccountMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menuRef.current?.removeAttribute("open");

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details ref={menuRef} className="pointer-events-auto relative">
      <summary className="cursor-pointer list-none rounded-full border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:border-blue-600 hover:text-blue-600">
        Account
      </summary>

      <div
        className={`absolute right-0 z-30 mt-3 max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg ${
          SHOW_DEV_NAV ? "w-80" : "w-52"
        }`}
      >
        <p className="truncate px-3 py-2 text-xs text-gray-500">{email}</p>
        <Link
          href="/account"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        >
          My Account
        </Link>
        <Link
          href="/account/properties"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        >
          My Properties
        </Link>
        <Link
          href="/account/reviews"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        >
          My Reviews
        </Link>
        <Link
          href="/add-property"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        >
          Add Property
        </Link>
        <form action={signOut} onSubmit={closeMenu}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
          >
            Logout
          </button>
        </form>

        {SHOW_DEV_NAV && (
          <DeveloperNavigationMenu
            sampleProperty={sampleProperty}
            sampleOwnProperty={sampleOwnProperty}
            sampleReview={sampleReview}
            onNavigate={closeMenu}
          />
        )}
      </div>
    </details>
  );
}
