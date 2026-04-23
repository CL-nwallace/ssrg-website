import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AdminContext = {
  email: string;
};

export async function requireAdmin(): Promise<AdminContext> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    redirect("/admin/login");
  }

  const { data, error } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (error || !data) {
    await supabase.auth.signOut();
    redirect("/admin/login?error=not_authorized");
  }

  return { email: user.email };
}
