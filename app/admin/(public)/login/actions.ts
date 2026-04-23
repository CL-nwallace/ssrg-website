"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

type SignInResult = { ok: true } | { ok: false; error: string };

export async function signInWithMagicLink(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email." };
  }

  const supabase = createSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/admin/auth/callback` },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
