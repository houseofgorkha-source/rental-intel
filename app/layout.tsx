import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import AccountMenu from "@/components/shared/AccountMenu";
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

  // Unread message count for the Account menu badge — every signed-in user,
  // not just admins/dev-nav, unlike the sample-data queries below. A `head`
  // count query so the badge costs one round trip and no row data.
  let unreadMessageCount = 0;
  if (user) {
    const { count } = await supabase
      .from("property_messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null);
    unreadMessageCount = count ?? 0;
  }

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
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Logo className="pointer-events-auto" />
            {user ? (
              <AccountMenu
                email={user.email ?? "RentalIntel member"}
                isAdmin={isAdmin}
                unreadMessageCount={unreadMessageCount}
                sampleProperty={sampleProperty}
                sampleReview={sampleReview}
                sampleModerationProperty={sampleModerationProperty}
                sampleVerification={sampleVerification}
                sampleOwnProperty={sampleOwnProperty}
              />
            ) : (
              <nav className="pointer-events-auto flex items-center gap-4 text-sm font-medium">
                <Link href="/login" className="text-gray-700 hover:text-blue-600">
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="rounded-full border border-gray-300 bg-white px-4 py-2 text-gray-900 hover:border-blue-600 hover:text-blue-600"
                >
                  Sign Up
                </Link>
              </nav>
            )}
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
