import { redirect } from "next/navigation";
import ProfileForm from "@/components/account/ProfileForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <ProfileForm
      displayName={profile?.display_name ?? ""}
      email={user.email ?? ""}
    />
  );
}
