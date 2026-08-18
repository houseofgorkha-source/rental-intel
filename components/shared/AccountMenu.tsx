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
      {/* Plain text at rest — no pill/border/background — matching the
          logged-out Login/Sign up control; the lift + color animation
          still shows on hover/press. */}
      <summary className="cursor-pointer list-none text-sm font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-accent">
        Account
      </summary>

      <div
        className={`absolute right-0 z-30 mt-3 max-h-[80vh] overflow-y-auto rounded-xl border border-border-subtle bg-surface p-2 shadow-2xl shadow-black/40 ${
          showDevNav ? "w-80" : "w-52"
        }`}
      >
        <p className="truncate px-3 py-2 text-xs text-muted">{email}</p>
        <Link
          href="/account"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-raised hover:text-accent"
        >
          My Account
        </Link>
        <Link
          href="/account/properties"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-raised hover:text-accent"
        >
          My Properties
        </Link>
        <Link
          href="/account/reviews"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-raised hover:text-accent"
        >
          My Reviews
        </Link>
        <Link
          href="/add-property"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-raised hover:text-accent"
        >
          Add Property
        </Link>
        <div className="my-1 border-t border-border-subtle" />
        <Link
          href="/brokers"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-raised hover:text-accent"
        >
          Browse Brokers
        </Link>
        <Link
          href="/add-broker"
          onClick={closeMenu}
          className="block rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-raised hover:text-accent"
        >
          List as a Broker
        </Link>
        {isAdmin && (
          <>
            <div className="my-1 border-t border-border-subtle" />
            <Link
              href="/admin"
              onClick={closeMenu}
              className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-raised hover:text-accent"
            >
              Moderation
            </Link>
            <div className="my-1 border-t border-border-subtle" />
          </>
        )}
        <form action={signOut} onSubmit={closeMenu}>
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-danger/10 hover:text-danger"
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
