import { notFound, redirect } from "next/navigation";
import AdminSectionNav from "@/components/admin/AdminSectionNav";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/admin";

// One gate for the whole moderation area, using the same per-route
// getUser() pattern the rest of the app uses (proxy.ts refreshes the session,
// it never guards routes).
//
// Two different refusals on purpose:
//   * signed out            -> /login, because an administrator arriving on a
//                              cold browser needs a way in.
//   * signed in, not admin  -> notFound(), because there is nothing here for
//                              them and a 403 page would only confirm the
//                              area exists.
// Neither is the security boundary. Every query inside this area is filtered
// by RLS gated on public.is_admin(), so a non-admin who reached these pages
// anyway would see empty lists and be unable to change anything.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");
  if (!(await isAdminUser(supabase, user.id))) notFound();

  return (
    <main className="min-h-screen bg-[#fbfbfa] pb-20 pt-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              RentalIntel moderation
            </p>
            <h1 className="mt-3 text-3xl font-medium tracking-[-0.035em] text-slate-950 sm:text-4xl">
              Review what people submitted
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Signed in as <span className="font-medium text-slate-700">{user.email}</span>
          </p>
        </div>

        <div className="mt-7">
          <AdminSectionNav />
        </div>

        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}
