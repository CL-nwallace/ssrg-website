"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/admin/audit";

type SignInResult = { ok: false; error: string };

export async function signInWithPassword(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email.", ok: false };
  }
  if (!password) {
    return { error: "Enter your password.", ok: false };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, ok: false };
  }

  // Verify allowlist before considering this a successful admin sign-in.
  // Middleware will also re-check on the redirect, but catching it here gives
  // a cleaner error state and avoids an audit row for a session we'll kill.
  const { data: allowed } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    return { error: "That email is not on the admin list.", ok: false };
  }

  await logAudit({
    adminEmail: email,
    action: "login",
    entityType: "auth",
    entityId: null,
  });

  redirect("/admin");
}
