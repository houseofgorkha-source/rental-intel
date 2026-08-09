"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/actions/auth";
import DeveloperNavigationMenu from "@/components/shared/DeveloperNavigationMenu";

type AccountMenuProps = {
  email: string;
  // Whether to offer the moderation link. Presentation only: /admin gates
  // itself server-side and every table behind it is filtered by RLS, so
  // forging this prop would reveal a link to a page that 404s.
  isAdmin?: boolean;
  // Unread property_messages addressed to this user. Presentation only, same
  // as isAdmin above — /account/messages re-derives its own contents from
  // RLS regardless of what this number says.
  unreadMessageCount?: number;
  // Dev-nav-only — resolved server-side in app/layout.tsx, only when
  // NEXT_PUBLIC_SHOW_DEV_NAV is set. Always null/undefined otherwise, so
  // these props are inert in production.
  sampleProperty?: { slug: string } | null;
  sampleReview?: { slug: string; reviewId: string } | null;
  sampleModerationProperty?: { slug: string } | null;
  sampleVerification?: { id: string } | null;
  sampleOwnProperty?: { slug: string } | null;
};

const SHOW_DEV_NAV = process.env.NEXT_PUBLIC_SHOW_DEV_NAV === "true";

export default function AccountMenu({
  email,
  isAdmin = false,
  unreadMessageCount = 0,
  sampleProperty = null,
  sampleReview = null,
  sampleModerationProperty = null,
  sampleVerification = null,
  sampleOwnProperty = null,
}: AccountMenuProps) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const closeMenu = () => menuRef.current?.removeAttribute("open");

  // The feature flag alone was not enough: with it on, every signed-in user
  // saw the whole route list. It is a developer tool (CLAUDE.md §24), so it
  // now also requires the same administrator check the Moderation link uses.
  // An ordinary account sees only its own five entries.
  const showDevNav = SHOW_DEV_NAV && isAdmin;

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
        {unreadMessageCount > 0 && (
          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
            {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
          </span>
        )}
      </summary>

      <div
        className={`absolute right-0 z-30 mt-3 max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg ${
          showDevNav ? "w-80" : "w-52"
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
          href="/account/messages"
          onClick={closeMenu}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        >
          Messages
          {unreadMessageCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
              {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
            </span>
          )}
        </Link>
        <Link
          href="/add-property"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
        >
          Add Property
        </Link>
        {isAdmin && (
          <>
            <div className="my-1 border-t border-gray-100" />
            <Link
              href="/admin"
              onClick={closeMenu}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-blue-50 hover:text-blue-600"
            >
              Moderation
            </Link>
            <div className="my-1 border-t border-gray-100" />
          </>
        )}
        <form action={signOut} onSubmit={closeMenu}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600"
          >
            Logout
          </button>
        </form>

        {showDevNav && (
          <DeveloperNavigationMenu
            sampleProperty={sampleProperty}
            sampleReview={sampleReview}
            sampleModerationProperty={sampleModerationProperty}
            sampleVerification={sampleVerification}
            sampleOwnProperty={sampleOwnProperty}
            onNavigate={closeMenu}
          />
        )}
      </div>
    </details>
  );
}
