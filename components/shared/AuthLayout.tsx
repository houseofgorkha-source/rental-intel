import { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({
  children,
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-background">
      {/* `pt-28` reserves the same clearance every other page uses below the
          absolutely-positioned header (see CLAUDE.md's convention) — without
          it, `items-center` can vertically center the card right underneath
          the header on a short mobile viewport, letting the two touch.
          Padding still lets the card center within the remaining space on
          taller screens. px-4 (was px-6) on mobile so the card — and the
          input fields inside it — get more usable width; sm:px-6 unchanged. */}
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-4 pb-10 pt-28 sm:px-6">
        {children}
      </div>
    </main>
  );
}