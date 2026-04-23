import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/admin/audit";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/admin/login", origin));
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback exchange failed:", {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    const redirectUrl = new URL("/admin/login", origin);
    redirectUrl.searchParams.set("error", "exchange_failed");
    redirectUrl.searchParams.set("message", error.message);
    return NextResponse.redirect(redirectUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    const { data: allowed } = await supabase
      .from("admin_emails")
      .select("email")
      .eq("email", user.email)
      .maybeSingle();
    if (allowed) {
      await logAudit({
        adminEmail: user.email,
        action: "login",
        entityType: "auth",
        entityId: null,
      });
    }
  }

  return NextResponse.redirect(new URL("/admin", origin));
}
