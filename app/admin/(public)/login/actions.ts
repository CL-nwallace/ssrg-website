"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SignInResult = { ok: true } | { ok: false; error: string };

function requestOrigin(): string {
  // Derive the origin from the current request so every deploy (preview,
  // production, localhost) sends magic-link emails that redirect back to
  // itself, not to a stale Site URL env var.
  const h = headers();
  const host = h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function signInWithMagicLink(
  _prev: SignInResult | null,
  formData: FormData,
): Promise<SignInResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${requestOrigin()}/admin/auth/callback` },
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
