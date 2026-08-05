import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import AccountMenu from "@/components/shared/AccountMenu";
import Logo from "@/components/shared/Logo";
import { createClient } from "@/lib/supabase/server";
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
              <AccountMenu email={user.email ?? "RentalIntel member"} />
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
