import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // Allow the login page and auth callback through without gating.
  if (pathname === "/admin/login" || pathname.startsWith("/admin/auth/")) {
    const { response } = createSupabaseMiddlewareClient(request);
    return response;
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.redirect(new URL("/admin/login", origin));
  }

  const { data } = await supabase
    .from("admin_emails")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (!data) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/admin/login?error=not_authorized", origin),
    );
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
