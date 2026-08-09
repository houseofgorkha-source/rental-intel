import { redirect } from "next/navigation";
import AccountSectionNav from "@/components/account/AccountSectionNav";
import { createClient } from "@/lib/supabase/server";

// One auth gate and one nav for the whole account area, using the same
// per-page getUser() + redirect pattern the rest of the app uses (proxy.ts
// only refreshes the session, it never guards routes).
export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  return (
    <main className="min-h-screen bg-background pb-20 pt-28">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
          Your account
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.035em] text-foreground sm:text-4xl">
          {user.email}
        </h1>

        <div className="mt-7">
          <AccountSectionNav />
        </div>

        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}
