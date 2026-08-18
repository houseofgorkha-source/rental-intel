import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import AccountMenu from "@/components/shared/AccountMenu";
import ChatWidget from "@/components/shared/ChatWidget";
import Logo from "@/components/shared/Logo";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";
import { one } from "@/lib/embedded";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = "RentalIntel — Know it before you rent it.";
const siteDescription =
  "Rental-intelligence for Bangalore renters. Real tenant reviews, evidence-backed verification, and rental history that stays with the property.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    siteName: "RentalIntel",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: siteTitle,
    description: siteDescription,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Decides whether the Account menu offers a way into moderation. Not a
  // security check — /admin gates itself and every query behind it is filtered
  // by RLS — so this only avoids showing a link that would 404.
  const isAdmin = user ? await isAdminUser(supabase, user.id) : false;

  // Only queried when the dev nav flag is on AND the viewer is an
  // administrator — the same condition AccountMenu now uses to render it.
  // Without the isAdmin half, an ordinary account paid for these queries to
  // populate a menu it can no longer see. Zero extra DB calls in production,
  // where the flag is off. Resolves real, clickable examples for the dynamic
  // routes in the dev nav rather than dead placeholder text.
  const devNavEnabled = process.env.NEXT_PUBLIC_SHOW_DEV_NAV === "true" && isAdmin;
  let sampleProperty: { slug: string } | null = null;
  let sampleReview: { slug: string; reviewId: string } | null = null;
  let sampleModerationProperty: { slug: string } | null = null;
  let sampleVerification: { id: string } | null = null;
  let sampleOwnProperty: { slug: string } | null = null;

  if (devNavEnabled && user) {
    const [
      { data: property },
      { data: moderationProperty },
      { data: verification },
      { data: ownProperty },
    ] = await Promise.all([
        supabase
          .from("properties")
          .select("slug")
          .eq("status", "published")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("properties")
          .select("slug")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("review_verifications")
          .select("id")
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Scoped to this user: /account/properties/[slug]/edit only resolves
        // for a property they created.
        supabase
          .from("properties")
          .select("slug")
          .eq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
    sampleProperty = property;
    sampleModerationProperty = moderationProperty;
    sampleVerification = verification;
    sampleOwnProperty = ownProperty;

    // Separate: /review/success and /review/verify only work for a review the
    // signed-in user actually owns, so this one is scoped to them.
    const { data: review } = await supabase
      .from("reviews")
      .select("id, properties!inner(slug)")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const propertySlug = one(review?.properties)?.slug;
    if (review && propertySlug) {
      sampleReview = { slug: propertySlug, reviewId: review.id };
    }
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} scroll-thin h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col">
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 px-6 py-5">
          <div className="mx-auto flex max-w-6xl items-baseline justify-between">
            <Logo className="pointer-events-auto" />
            {user ? (
              <AccountMenu
                email={user.email ?? "RentalIntel member"}
                isAdmin={isAdmin}
                sampleProperty={sampleProperty}
                sampleReview={sampleReview}
                sampleModerationProperty={sampleModerationProperty}
                sampleVerification={sampleVerification}
                sampleOwnProperty={sampleOwnProperty}
              />
            ) : (
              // One combined action, not separate Login/Sign Up links — /login
              // itself offers a "Create Account" path onward, so a single
              // entry point covers both without a second route or component.
              // Plain text at rest (no pill/border/background) — the lift +
              // color animation only shows on hover/press, matching
              // AccountMenu's own hover treatment minus its persistent chrome.
              // Alignment with the logo no longer depends on matching box
              // height either way, since the header aligns by text baseline.
              <Link
                href="/login"
                className="pointer-events-auto text-sm font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:text-accent"
              >
                Login / Sign up
              </Link>
            )}
          </div>
        </header>
        {children}
        <ChatWidget isSignedIn={Boolean(user)} />
      </body>
    </html>
  );
}
