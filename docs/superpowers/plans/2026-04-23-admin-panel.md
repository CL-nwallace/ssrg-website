# SSRG Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin` area — magic-link auth gated by `admin_emails`, events CRUD, media CRUD, and an append-only audit log — behind Next.js Server Actions and Supabase RLS.

**Architecture:** Next.js App Router Server Actions call the existing `@supabase/ssr` server client so every admin mutation is authorized by the admin's JWT against the RLS policies from migration `0001_initial.sql`. `middleware.ts` refreshes the Supabase session for `/admin/**`; a `requireAdmin()` helper re-verifies on the server (defense in depth). Playwright e2e tests mint sessions directly through the Supabase admin API to avoid email round-trips.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@supabase/ssr`, TipTap (starter-kit + link), Tailwind, Playwright, `sanitize-html`.

**Spec:** [docs/superpowers/specs/2026-04-23-admin-panel-design.md](../specs/2026-04-23-admin-panel-design.md).

---

## Execution order

Task numbers reflect logical grouping, but execute in this order so each task has its dependencies in place: **1 → 2 → 3 → 5 → 9 → 4 → 6 → 7 → 10 → 11 → 8 → 12 → 13 → 14 → 15 → 16 → 17 → 18**. (Tasks 9 and 10 are moved earlier because Task 7 and Task 8 depend on them.)

## Conventions

- Every mutation Server Action returns `{ ok: true, ... } | { ok: false, error: string }`.
- Every mutation Server Action calls `requireAdmin()` at the top and writes an `admin_audit_log` row before returning success.
- Commit message style follows the existing repo — short imperative subject + optional body (see `git log`).
- Import aliases use `@/...` per `tsconfig.json`.
- Use `force-dynamic` on admin routes (they are user-specific and not cacheable).
- Do NOT add the service-role key to the Vercel project. It lives only in `.env.local` + CI secrets.

---

## Task 1: Migration 0002 — audit log + add Nico's email

**Files:**
- Create: `supabase/migrations/0002_admin_audit_and_emails.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_admin_audit_and_emails.sql`:

```sql
-- SSRG admin audit log + additional admin email.
-- Append-only log of every admin mutation with before/after snapshots.

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,
  action text not null check (action in ('create','update','delete','login')),
  entity_type text not null check (entity_type in ('event','media','auth')),
  entity_id text,
  snapshot jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_admin_read on public.admin_audit_log;
create policy admin_audit_log_admin_read on public.admin_audit_log
  for select
  using ((auth.jwt() ->> 'email') in (select email from public.admin_emails));

drop policy if exists admin_audit_log_admin_insert on public.admin_audit_log;
create policy admin_audit_log_admin_insert on public.admin_audit_log
  for insert
  with check ((auth.jwt() ->> 'email') in (select email from public.admin_emails));

-- No update/delete policies → append-only from the app.

insert into public.admin_emails (email)
values ('nickwallibe@gmail.com')
on conflict (email) do nothing;
```

- [ ] **Step 2: Apply the migration**

Run:

```bash
npx supabase db push
```

Expected: migration `0002_admin_audit_and_emails` reports as applied.

- [ ] **Step 3: Verify the table + email**

Run:

```bash
npx supabase db query "select email from public.admin_emails order by email;" --linked
npx supabase db query "select count(*) from public.admin_audit_log;" --linked
```

Expected: `admin_emails` includes `nickwallibe@gmail.com`, `sally@...`, `james@...`; count on audit log returns `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_admin_audit_and_emails.sql
git commit -m "Add admin_audit_log table and seed Nico's admin email"
```

---

## Task 2: Supabase middleware client helper

**Files:**
- Create: `lib/supabase/middleware.ts`

- [ ] **Step 1: Create the middleware Supabase client**

Write `lib/supabase/middleware.ts`:

```ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  return { supabase, response };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/middleware.ts
git commit -m "Add Supabase middleware client helper"
```

---

## Task 3: `requireAdmin()` server guard

**Files:**
- Create: `lib/admin/require-admin.ts`

- [ ] **Step 1: Write the helper**

Write `lib/admin/require-admin.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/require-admin.ts
git commit -m "Add requireAdmin server guard"
```

---

## Task 4: `middleware.ts` — /admin session refresh + allowlist gate

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write middleware**

Write `middleware.ts` at the repo root:

```ts
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
```

- [ ] **Step 2: Typecheck + build**

Run:

```bash
npx tsc --noEmit && npm run build
```

Expected: clean.

- [ ] **Step 3: Manual smoke test**

Run `npm run dev` in a separate terminal, then:

```bash
curl -sI http://localhost:3000/admin
```

Expected: 307 redirect with `location: /admin/login`. (The `/admin/login` route doesn't exist yet — Task 5 adds it. Visiting the redirected URL will 404 for now; that's fine.)

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "Gate /admin routes with Supabase session + allowlist middleware"
```

---

## Task 5: Admin-session Playwright helper

**Files:**
- Create: `app/api/test/admin-session/route.ts` (test-only endpoint, gated)
- Create: `e2e/helpers/admin-session.ts`
- Modify: `.env.example` (add `TEST_AUTH_SECRET`)

Strategy: the `@supabase/ssr` cookie format varies across versions, so instead of crafting cookies in JS we add a **test-only** Next.js route that signs in via `supabase.auth.signInWithPassword` server-side and lets the existing server client write the canonical cookie. The route requires a matching `x-test-auth-secret` header and refuses to run when `process.env.TEST_AUTH_SECRET` is unset. The service-role key bypasses production email verification flows when we pre-create the auth user.

- [ ] **Step 1: Add the test-only sign-in route**

Create `app/api/test/admin-session/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const secret = process.env.TEST_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  if (request.headers.get("x-test-auth-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Add `TEST_AUTH_SECRET` to `.env.example` and `.env.local`**

Append to `.env.example`:

```
TEST_AUTH_SECRET=
```

Add a real value to `.env.local` (gitignored):

```bash
printf "\nTEST_AUTH_SECRET=$(openssl rand -hex 16)\n" >> .env.local
```

- [ ] **Step 3: Write the helper**

Write `e2e/helpers/admin-session.ts`:

```ts
import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.TEST_AUTH_SECRET;
  if (!url || !key || !secret) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TEST_AUTH_SECRET must be set in .env.local for e2e tests.",
    );
  }
  return { url, key, secret };
}

/**
 * Create/update a Supabase auth user with a known password.
 * Uses the service-role key — NEVER run against production data.
 */
export async function ensureAuthUser(email: string, password: string): Promise<void> {
  const { url, key } = requireEnv();
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: listed } = await admin.auth.admin.listUsers();
  const existing = listed?.users.find((u) => u.email === email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return;
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
}

/**
 * Plant a real Supabase session cookie on the Playwright context by hitting
 * the test-only /api/test/admin-session endpoint. That endpoint runs the
 * canonical @supabase/ssr cookie-setting code, so the cookie format matches
 * what the app reads.
 */
export async function planAdminSession(
  context: BrowserContext,
  email: string,
  password: string,
): Promise<void> {
  const { secret } = requireEnv();
  const baseURL = "http://localhost:3000";
  const response = await context.request.post(
    `${baseURL}/api/test/admin-session`,
    {
      headers: { "x-test-auth-secret": secret, "content-type": "application/json" },
      data: { email, password },
    },
  );
  if (!response.ok()) {
    throw new Error(
      `Test sign-in failed: ${response.status()} ${await response.text()}`,
    );
  }
}

/**
 * Ensure the email is in admin_emails, set up the auth user, and plant the session.
 */
export async function signInAsAdmin(
  context: BrowserContext,
  email: string,
): Promise<void> {
  const password = "Test-Admin-Password-1!";
  await ensureAuthUser(email, password);
  await planAdminSession(context, email, password);
}

/**
 * Set up a user but DO NOT add them to admin_emails. Caller is responsible
 * for ensuring the email is not in the allowlist if the test depends on that.
 */
export async function signInAsNonAdmin(
  context: BrowserContext,
  email: string,
): Promise<void> {
  const password = "Test-NonAdmin-Password-1!";
  await ensureAuthUser(email, password);
  await planAdminSession(context, email, password);
}

/**
 * Service-role Supabase client for test setup / teardown.
 */
export function serviceClient() {
  const { url, key } = requireEnv();
  return createClient(url, key, { auth: { persistSession: false } });
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/test e2e/helpers/admin-session.ts .env.example
git commit -m "Add test-only admin-session endpoint and Playwright helper"
```

---

## Task 6: /admin/login — email form + signInWithOtp action

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/login/actions.ts`
- Test: `e2e/admin-auth.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/admin-auth.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signInAsNonAdmin, serviceClient } from "./helpers/admin-session";

test.describe("Admin auth", () => {
  test("unauthenticated /admin redirects to /admin/login", async ({ page }) => {
    const response = await page.goto("/admin");
    expect(page.url()).toContain("/admin/login");
    expect(response?.status()).toBeLessThan(500);
  });

  test("login page renders email input", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("submitting a valid email shows the check-your-email message", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/email/i).fill("nickwallibe@gmail.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });

  test("non-admin email is redirected to login with error", async ({ page, context }) => {
    // Ensure the non-admin email is NOT in admin_emails.
    const admin = serviceClient();
    await admin.from("admin_emails").delete().eq("email", "notadmin@example.com");
    await signInAsNonAdmin(context, "notadmin@example.com");
    await page.goto("/admin");
    expect(page.url()).toContain("/admin/login");
    expect(page.url()).toContain("error=not_authorized");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx playwright test e2e/admin-auth.spec.ts --project=desktop`
Expected: failures for the login-page tests (no route) — redirect test may already pass from middleware.

- [ ] **Step 3: Write the action**

Create `app/admin/login/actions.ts`:

```ts
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
```

Note: `NEXT_PUBLIC_SITE_URL` should be set per environment. Fallback to `localhost:3000` keeps dev working without config.

- [ ] **Step 4: Write the page**

Create `app/admin/login/page.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signInWithMagicLink } from "./actions";

export const dynamic = "force-dynamic";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 w-full rounded bg-black px-4 py-3 text-white font-medium disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send magic link"}
    </button>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const [state, formAction] = useFormState(signInWithMagicLink, null);
  const notAuthorized = searchParams.error === "not_authorized";

  if (state?.ok) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-serif mb-4">Check your email</h1>
          <p className="text-text-secondary">
            We sent a magic link. Click it to finish signing in.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form action={formAction} className="max-w-md w-full">
        <h1 className="text-2xl font-serif mb-2">SSRG admin</h1>
        <p className="text-text-secondary mb-6">
          Sign in with the email the board has on file.
        </p>

        {notAuthorized && (
          <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
            That email is not on the admin list. Contact the board if this looks
            wrong.
          </p>
        )}

        {state && !state.ok && (
          <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
            {state.error}
          </p>
        )}

        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoFocus
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <SubmitButton />
      </form>
    </main>
  );
}
```

- [ ] **Step 5: Run the e2e tests to confirm they pass (except the non-admin one, which needs callback route)**

Run: `npx playwright test e2e/admin-auth.spec.ts --project=desktop -g "login page renders|check-your-email|unauthenticated"`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add app/admin/login/page.tsx app/admin/login/actions.ts e2e/admin-auth.spec.ts
git commit -m "Add /admin/login magic-link page"
```

---

## Task 7: /admin/auth/callback route handler

**Files:**
- Create: `app/admin/auth/callback/route.ts`

The callback also writes a `login` audit row for accepted admins. To keep task ordering clean, **execute Task 9 (audit helper) before Task 7**. The plan below assumes `lib/admin/audit.ts` is already in place.

- [ ] **Step 1: Write the route handler**

Create `app/admin/auth/callback/route.ts`:

```ts
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
    return NextResponse.redirect(
      new URL("/admin/login?error=exchange_failed", origin),
    );
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Run the non-admin e2e test**

Run: `npx playwright test e2e/admin-auth.spec.ts --project=desktop -g "non-admin"`
Expected: pass. (The middleware catches the non-allowlisted user and redirects with `error=not_authorized`.)

- [ ] **Step 4: Commit**

```bash
git add app/admin/auth/callback/route.ts
git commit -m "Add /admin/auth/callback code-exchange route"
```

---

## Task 8: Admin layout + dashboard + logout

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/logout/route.ts`
- Create: `app/admin/error.tsx`
- Test: extend `e2e/admin-auth.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/admin-auth.spec.ts`:

```ts
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";

test.describe("Admin layout", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin
      .from("admin_emails")
      .upsert({ email: "nickwallibe@gmail.com" });
  });

  test("admin can access /admin and sees their email", async ({ page, context }) => {
    await signInAsAdmin(context, "nickwallibe@gmail.com");
    await page.goto("/admin");
    await expect(page.getByText("nickwallibe@gmail.com")).toBeVisible();
    await expect(page.getByRole("link", { name: /events/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /media/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /audit/i })).toBeVisible();
  });

  test("logout returns the admin to /admin/login", async ({ page, context }) => {
    await signInAsAdmin(context, "nickwallibe@gmail.com");
    await page.goto("/admin");
    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL("**/admin/login");
  });
});
```

Move the pre-existing `import ... from "./helpers/admin-session"` to the top of the file if duplicated.

- [ ] **Step 2: Verify the tests fail**

Run: `npx playwright test e2e/admin-auth.spec.ts --project=desktop -g "Admin layout"`
Expected: failures (layout and dashboard don't exist).

- [ ] **Step 3: Write the logout route handler**

Create `app/admin/logout/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", request.nextUrl.origin));
}
```

- [ ] **Step 4: Write the error boundary**

Create `app/admin/error.tsx`:

```tsx
"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <h1 className="text-2xl font-serif mb-2">Something went wrong</h1>
        <p className="text-text-secondary mb-6">{error.message}</p>
        <button
          onClick={reset}
          className="rounded bg-black px-4 py-2 text-white font-medium"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Restructure under route groups, then write the protected layout**

Next.js route groups (folders named in parens) share a layout without affecting URLs. Group login + callback under `(public)`, and dashboard/events/media/audit under `(protected)`, so only the protected group gets the admin chrome + `requireAdmin()`.

Move the existing files:

```bash
mkdir -p app/admin/\(public\) app/admin/\(protected\)
git mv app/admin/login app/admin/\(public\)/login
git mv app/admin/auth app/admin/\(public\)/auth
```

Final structure:

```
app/admin/
  (public)/
    login/
      page.tsx
      actions.ts
    auth/
      callback/
        route.ts
  (protected)/
    layout.tsx   ← this task
    page.tsx     ← this task
    events/...   ← later tasks
    media/...
    audit/...
  logout/
    route.ts     ← this task, shared
```

Write `app/admin/(protected)/layout.tsx`:

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { email } = await requireAdmin();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-gray-200 p-6 flex flex-col">
        <h1 className="text-lg font-serif mb-6">SSRG admin</h1>
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/admin/events" className="hover:underline">Events</Link>
          <Link href="/admin/media" className="hover:underline">Media</Link>
          <Link href="/admin/audit" className="hover:underline">Audit log</Link>
        </nav>
        <div className="mt-auto text-sm">
          <p className="text-text-secondary mb-2">{email}</p>
          <form action="/admin/logout" method="post">
            <button type="submit" className="text-red-700 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 6: Write the dashboard page**

Create `app/admin/(protected)/page.tsx`:

```tsx
export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl font-serif mb-4">Dashboard</h2>
      <p className="text-text-secondary">
        Use the sidebar to manage events, media galleries, and review the audit
        log.
      </p>
    </div>
  );
}
```

- [ ] **Step 7: Run the e2e tests**

Run: `npx playwright test e2e/admin-auth.spec.ts --project=desktop`
Expected: all admin-auth tests pass.

- [ ] **Step 8: Commit**

```bash
git add app/admin e2e/admin-auth.spec.ts
git commit -m "Add admin layout, dashboard, logout, and error boundary"
```

---

## Task 9: Audit log helper

**Files:**
- Create: `lib/admin/audit.ts`

- [ ] **Step 1: Write the helper**

```ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuditAction = "create" | "update" | "delete" | "login";
export type AuditEntity = "event" | "media" | "auth";

export type LogAuditInput = {
  adminEmail: string;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string | null;
  snapshot?: unknown;
};

export async function logAudit(input: LogAuditInput): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    admin_email: input.adminEmail,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    snapshot: input.snapshot ?? null,
  });
  if (error) {
    // Audit failure should not block the user action; log to server console so
    // we can investigate. Swallow it intentionally.
    console.error("Failed to write audit log:", error.message, input);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/audit.ts
git commit -m "Add logAudit helper"
```

---

## Task 10: TipTap editor + cover image input components

**Files:**
- Modify: `package.json` (add TipTap deps)
- Create: `components/admin/TiptapEditor.tsx`
- Create: `components/admin/CoverImageInput.tsx`

- [ ] **Step 1: Install TipTap**

Run:

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

Expected: dependencies added, no errors.

- [ ] **Step 2: Write the TipTap editor component**

Create `components/admin/TiptapEditor.tsx`:

```tsx
"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";

type Props = {
  name: string;
  initialHtml?: string;
};

export default function TiptapEditor({ name, initialHtml = "" }: Props) {
  const [html, setHtml] = useState(initialHtml);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
    ],
    content: initialHtml,
    immediatelyRender: false,
    onUpdate({ editor }) {
      setHtml(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[200px] rounded border border-gray-300 px-3 py-2 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    return () => {
      editor?.destroy();
    };
  }, [editor]);

  if (!editor) {
    return <div className="h-[240px] rounded border border-gray-300" />;
  }

  const buttonClass = (active: boolean) =>
    `px-2 py-1 text-sm rounded ${active ? "bg-black text-white" : "bg-gray-100"}`;

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={buttonClass(editor.isActive("bold"))}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={buttonClass(editor.isActive("italic"))}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={buttonClass(editor.isActive("heading", { level: 2 }))}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={buttonClass(editor.isActive("heading", { level: 3 }))}>H3</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={buttonClass(editor.isActive("bulletList"))}>•</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={buttonClass(editor.isActive("orderedList"))}>1.</button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
            else editor.chain().focus().unsetLink().run();
          }}
          className={buttonClass(editor.isActive("link"))}
        >
          link
        </button>
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
```

- [ ] **Step 3: Write the cover image input**

Create `components/admin/CoverImageInput.tsx`:

```tsx
"use client";

import { useState } from "react";

type Props = {
  name: string;
  initialUrl?: string | null;
};

export default function CoverImageInput({ name, initialUrl }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl ?? null);

  return (
    <div>
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Cover preview"
          className="mb-2 h-40 w-full rounded object-cover"
        />
      )}
      <input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setPreviewUrl(URL.createObjectURL(file));
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/admin
git commit -m "Add TipTap editor and cover image input components"
```

---

## Task 11: File upload + image-validation helper

**Files:**
- Create: `lib/admin/uploads.ts`

- [ ] **Step 1: Write the helper**

```ts
export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

export type ValidatedImage = {
  file: File;
  extension: "jpg" | "png" | "webp";
};

export function validateImage(file: File | null): ValidatedImage | { error: string } {
  if (!file || file.size === 0) {
    return { error: "No file uploaded." };
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { error: "Image must be JPEG, PNG, or WebP." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: "Image must be 8 MB or smaller." };
  }

  const extension =
    file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  return { file, extension };
}

export function uuidFilename(ext: string): string {
  return `${crypto.randomUUID()}.${ext}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/uploads.ts
git commit -m "Add image validation + filename helpers"
```

---

## Task 12: Events list page

**Files:**
- Create: `app/admin/(protected)/events/page.tsx`
- Test: `e2e/admin-events.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/admin-events.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Admin events list", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test("events list shows seeded events with status badges", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto("/admin/events");

    await expect(page.locator("h2")).toContainText(/events/i);
    await expect(page.getByText("LA to Las Vegas")).toBeVisible();
    await expect(page.getByRole("link", { name: /new event/i })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx playwright test e2e/admin-events.spec.ts --project=desktop`
Expected: failure (route doesn't exist).

- [ ] **Step 3: Write the page**

Create `app/admin/(protected)/events/page.tsx`:

```tsx
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  event_date: string;
  price_cents: number;
  status: "draft" | "published";
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function AdminEventsPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, event_date, price_cents, status")
    .order("event_date", { ascending: true });
  const rows: Row[] = data ?? [];

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-serif">Events</h2>
        <Link
          href="/admin/events/new"
          className="rounded bg-black px-4 py-2 text-white text-sm"
        >
          New event
        </Link>
      </header>

      <table className="w-full text-sm">
        <thead className="border-b border-gray-200">
          <tr className="text-left">
            <th className="py-2">Title</th>
            <th className="py-2">Date</th>
            <th className="py-2">Price</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="py-3">{r.title}</td>
              <td className="py-3">{new Date(r.event_date).toLocaleDateString()}</td>
              <td className="py-3">{priceFormatter.format(r.price_cents / 100)}</td>
              <td className="py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    r.status === "published"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {r.status}
                </span>
              </td>
              <td className="py-3 text-right">
                <Link href={`/admin/events/${r.id}`} className="underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-text-muted">
                No events yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run e2e tests**

Run: `npx playwright test e2e/admin-events.spec.ts --project=desktop`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add app/admin e2e/admin-events.spec.ts
git commit -m "Add /admin/events list page"
```

---

## Task 13: Create event — form + action

**Files:**
- Create: `app/admin/(protected)/events/new/page.tsx`
- Create: `app/admin/(protected)/events/actions.ts`
- Test: extend `e2e/admin-events.spec.ts`

Task 14 covers editing and publishing; this task only creates a draft and verifies it stays off the public page.

- [ ] **Step 1: Write the failing e2e test**

Append to `e2e/admin-events.spec.ts`:

```ts
import path from "node:path";

test.describe("Create event", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test("create draft event — hidden from public /events", async ({ page, context }) => {
    const uniqueTitle = `Draft Test ${Date.now()}`;
    await signInAsAdmin(context, ADMIN_EMAIL);

    await page.goto("/admin/events/new");
    await page.getByLabel(/title/i).fill(uniqueTitle);
    await page.getByLabel(/date/i).fill("2030-06-15T09:00");
    await page.getByLabel(/price/i).fill("500.00");
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Short description.");
    await page.getByLabel(/cover image/i).setInputFiles(
      path.join(__dirname, "fixtures", "sample.jpg"),
    );
    await page.getByRole("button", { name: /create/i }).click();
    await page.waitForURL("**/admin/events");

    await page.goto("/events");
    await expect(page.getByText(uniqueTitle)).toHaveCount(0);

    const admin = serviceClient();
    await admin.from("events").delete().ilike("title", uniqueTitle);
  });
});
```

The test depends on `e2e/fixtures/sample.jpg`. Create a small placeholder.

- [ ] **Step 2: Add the fixture**

Create a ~10 KB placeholder:

```bash
mkdir -p e2e/fixtures
curl -sSL "https://picsum.photos/seed/ssrg-test/400/300.jpg" -o e2e/fixtures/sample.jpg
```

Expected: a small JPEG is written. (If curl is unavailable, copy any JPEG ≤ 8 MB into `e2e/fixtures/sample.jpg`.)

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx playwright test e2e/admin-events.spec.ts --project=desktop -g "draft event is hidden"`
Expected: failure.

- [ ] **Step 4: Write the actions file (with `createEvent` only for now — update/delete come in later tasks)**

Create `app/admin/(protected)/events/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAudit } from "@/lib/admin/audit";
import { validateImage, uuidFilename } from "@/lib/admin/uploads";

type ActionResult = { ok: true } | { ok: false; error: string };

function parsePriceCents(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function createEvent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const priceCents = parsePriceCents(formData.get("price_dollars"));
  const descriptionHtml = String(formData.get("description_html") ?? "");
  const status = formData.get("status") === "published" ? "published" : "draft";

  if (!title) return { ok: false, error: "Title is required." };
  if (!eventDate) return { ok: false, error: "Event date is required." };
  if (priceCents === null) return { ok: false, error: "Price is required." };

  // Optional cover
  let coverImagePath: string | null = null;
  const coverFile = formData.get("cover_image") as File | null;
  if (coverFile && coverFile.size > 0) {
    const validated = validateImage(coverFile);
    if ("error" in validated) return { ok: false, error: validated.error };

    const path = `pending/${uuidFilename(validated.extension)}`;
    const { error: uploadError } = await supabase.storage
      .from("event-covers")
      .upload(path, validated.file, { contentType: validated.file.type });
    if (uploadError) return { ok: false, error: uploadError.message };
    coverImagePath = path;
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      event_date: eventDate,
      price_cents: priceCents,
      description_html: descriptionHtml,
      status,
      cover_image_path: coverImagePath,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: email,
    action: "create",
    entityType: "event",
    entityId: data.id,
    snapshot: data,
  });

  revalidatePath("/events");
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
```

- [ ] **Step 5: Write the new-event page**

Create `app/admin/(protected)/events/new/page.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import TiptapEditor from "@/components/admin/TiptapEditor";
import CoverImageInput from "@/components/admin/CoverImageInput";
import { createEvent } from "../actions";

export const dynamic = "force-dynamic";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-white font-medium disabled:opacity-50"
    >
      {pending ? "Creating…" : "Create"}
    </button>
  );
}

export default function NewEventPage() {
  const [state, formAction] = useFormState(createEvent, null);

  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl font-serif mb-6">New event</h2>

      {state && !state.ok && (
        <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}

      <form action={formAction} className="space-y-4" encType="multipart/form-data">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input name="title" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input name="event_date" type="datetime-local" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Price (USD)</span>
          <input name="price_dollars" type="number" min="0" step="0.01" required className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <TiptapEditor name="description_html" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cover image</span>
          <CoverImageInput name="cover_image" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Status</span>
          <select name="status" defaultValue="draft" className="mt-1 w-full rounded border border-gray-300 px-3 py-2">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <SubmitButton />
      </form>
    </div>
  );
}
```

- [ ] **Step 6: Run the test**

Run: `npx playwright test e2e/admin-events.spec.ts --project=desktop -g "create draft"`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add app/admin e2e/admin-events.spec.ts e2e/fixtures
git commit -m "Add create-event form + action"
```

---

## Task 14: Edit + delete + status toggle

**Files:**
- Create: `app/admin/(protected)/events/[id]/page.tsx`
- Modify: `app/admin/(protected)/events/actions.ts` (add `updateEvent`, `deleteEvent`)
- Modify: `app/admin/(protected)/events/page.tsx` (add inline delete form)
- Test: extend `e2e/admin-events.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `e2e/admin-events.spec.ts`:

```ts
test("editing an event's title reflects on public /events", async ({ page, context }) => {
  const admin = serviceClient();
  const baseTitle = `Edit Test ${Date.now()}`;
  const { data: ev } = await admin
    .from("events")
    .insert({
      title: baseTitle,
      event_date: "2030-07-01T09:00:00Z",
      price_cents: 12345,
      status: "published",
    })
    .select("id")
    .single();

  await signInAsAdmin(context, ADMIN_EMAIL);
  await page.goto(`/admin/events/${ev!.id}`);
  const newTitle = `${baseTitle} EDITED`;
  await page.getByLabel(/title/i).fill(newTitle);
  await page.getByRole("button", { name: /save/i }).click();
  await page.waitForURL("**/admin/events");

  await page.goto("/events");
  await expect(page.getByText(newTitle)).toBeVisible();

  await admin.from("events").delete().eq("id", ev!.id);
});

test("deleting an event removes it from /events and logs a delete in audit", async ({ page, context }) => {
  const admin = serviceClient();
  const title = `Delete Test ${Date.now()}`;
  const { data: ev } = await admin
    .from("events")
    .insert({
      title,
      event_date: "2030-08-01T09:00:00Z",
      price_cents: 6789,
      status: "published",
    })
    .select("id")
    .single();

  await signInAsAdmin(context, ADMIN_EMAIL);
  await page.goto("/admin/events");
  const row = page.locator("tr", { hasText: title });
  await row.getByRole("button", { name: /delete/i }).click();
  await page.waitForURL("**/admin/events");

  await page.goto("/events");
  await expect(page.getByText(title)).toHaveCount(0);

  const { data: auditRows } = await admin
    .from("admin_audit_log")
    .select("*")
    .eq("entity_id", ev!.id)
    .eq("action", "delete");
  expect(auditRows?.length ?? 0).toBeGreaterThan(0);
  expect(auditRows![0].snapshot).toMatchObject({ title });
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `npx playwright test e2e/admin-events.spec.ts --project=desktop -g "editing|deleting"`
Expected: failures.

- [ ] **Step 3: Add update + delete actions**

Append to `app/admin/(protected)/events/actions.ts`:

```ts
export async function updateEvent(
  id: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const priceCents = parsePriceCents(formData.get("price_dollars"));
  const descriptionHtml = String(formData.get("description_html") ?? "");
  const status = formData.get("status") === "published" ? "published" : "draft";

  if (!title) return { ok: false, error: "Title is required." };
  if (!eventDate) return { ok: false, error: "Event date is required." };
  if (priceCents === null) return { ok: false, error: "Price is required." };

  const patch: Record<string, unknown> = {
    title,
    event_date: eventDate,
    price_cents: priceCents,
    description_html: descriptionHtml,
    status,
  };

  const coverFile = formData.get("cover_image") as File | null;
  if (coverFile && coverFile.size > 0) {
    const validated = validateImage(coverFile);
    if ("error" in validated) return { ok: false, error: validated.error };
    const path = `${id}/${uuidFilename(validated.extension)}`;
    const { error: uploadError } = await supabase.storage
      .from("event-covers")
      .upload(path, validated.file, { contentType: validated.file.type });
    if (uploadError) return { ok: false, error: uploadError.message };
    patch.cover_image_path = path;
  }

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: email,
    action: "update",
    entityType: "event",
    entityId: id,
    snapshot: data,
  });

  revalidatePath("/events");
  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function deleteEvent(id: string): Promise<void> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    adminEmail: email,
    action: "delete",
    entityType: "event",
    entityId: id,
    snapshot: existing ?? null,
  });

  revalidatePath("/events");
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
```

- [ ] **Step 4: Write the edit page**

Create `app/admin/(protected)/events/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import EditEventForm from "./EditEventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, event_date, price_cents, description_html, cover_image_path, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const coverUrl = data.cover_image_path
    ? `${supabaseUrl}/storage/v1/object/public/event-covers/${data.cover_image_path}`
    : null;

  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl font-serif mb-6">Edit event</h2>
      <EditEventForm event={{ ...data, coverUrl }} />
    </div>
  );
}
```

Create `app/admin/(protected)/events/[id]/EditEventForm.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import TiptapEditor from "@/components/admin/TiptapEditor";
import CoverImageInput from "@/components/admin/CoverImageInput";
import { updateEvent } from "../actions";

type Props = {
  event: {
    id: string;
    title: string;
    event_date: string;
    price_cents: number;
    description_html: string;
    status: "draft" | "published";
    coverUrl: string | null;
  };
};

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-4 py-2 text-white font-medium disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

export default function EditEventForm({ event }: Props) {
  const action = updateEvent.bind(null, event.id);
  const [state, formAction] = useFormState(action, null);

  return (
    <>
      {state && !state.ok && (
        <p className="mb-4 rounded bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <form action={formAction} className="space-y-4" encType="multipart/form-data">
        <label className="block">
          <span className="text-sm font-medium">Title</span>
          <input name="title" defaultValue={event.title} required className="mt-1 w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Date</span>
          <input
            name="event_date"
            type="datetime-local"
            defaultValue={toLocalDateTimeInput(event.event_date)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Price (USD)</span>
          <input
            name="price_dollars"
            type="number"
            min="0"
            step="0.01"
            defaultValue={(event.price_cents / 100).toFixed(2)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Description</span>
          <TiptapEditor name="description_html" initialHtml={event.description_html} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Cover image</span>
          <CoverImageInput name="cover_image" initialUrl={event.coverUrl} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Status</span>
          <select
            name="status"
            defaultValue={event.status}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
        <SubmitButton />
      </form>
    </>
  );
}
```

- [ ] **Step 5: Add the delete button to the list**

Modify `app/admin/(protected)/events/page.tsx` — replace the last `<td>` in each row with a cell that contains BOTH the edit link and a delete form:

```tsx
<td className="py-3 text-right space-x-3">
  <Link href={`/admin/events/${r.id}`} className="underline">
    Edit
  </Link>
  <form action={`/admin/events/${r.id}/delete`} method="post" className="inline">
    <button type="submit" className="text-red-700 underline">
      Delete
    </button>
  </form>
</td>
```

Then create `app/admin/(protected)/events/[id]/delete/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { deleteEvent } from "../../actions";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await deleteEvent(params.id);
  } catch (err) {
    // deleteEvent redirects on success; an error means something else went wrong.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
  // deleteEvent already redirected; this is unreachable, but satisfies types.
  return NextResponse.redirect(new URL("/admin/events", _req.nextUrl.origin));
}
```

- [ ] **Step 6: Run the tests**

Run: `npx playwright test e2e/admin-events.spec.ts --project=desktop`
Expected: all events tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/admin e2e/admin-events.spec.ts
git commit -m "Add edit + delete for events with audit snapshots"
```

---

## Task 15: Media page — upload + delete per category

**Files:**
- Create: `app/admin/(protected)/media/page.tsx`
- Create: `app/admin/(protected)/media/actions.ts`
- Create: `app/admin/(protected)/media/[id]/delete/route.ts`
- Test: `e2e/admin-media.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/admin-media.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import path from "node:path";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Admin media", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test("uploading to a category appears on public /media", async ({ page, context }) => {
    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto("/admin/media");

    // Count current items in Track Events before upload.
    const trackSection = page.locator("section", { hasText: /track events/i });
    await trackSection.scrollIntoViewIfNeeded();
    const before = await trackSection.locator("img").count();

    const trackUpload = trackSection.locator("input[type=file]");
    await trackUpload.setInputFiles(path.join(__dirname, "fixtures", "sample.jpg"));

    // Wait for the form submission to finish (page re-renders).
    await page.waitForLoadState("networkidle");
    const after = await trackSection.locator("img").count();
    expect(after).toBeGreaterThan(before);

    // Public /media: cover for Track Events should load from Supabase Storage.
    await page.goto("/media");
    const trackCover = page.locator('section', { hasText: "Track Events" }).locator("img").first();
    await expect(trackCover).toHaveAttribute("src", /storage\/v1\/object\/public\/media/);

    // Cleanup: remove the most recent media row.
    const admin = serviceClient();
    const { data: recent } = await admin
      .from("media")
      .select("id, storage_path")
      .eq("category", "track")
      .order("created_at", { ascending: false })
      .limit(1);
    if (recent && recent[0]) {
      await admin.storage.from("media").remove([recent[0].storage_path]);
      await admin.from("media").delete().eq("id", recent[0].id);
    }
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx playwright test e2e/admin-media.spec.ts --project=desktop`
Expected: failure.

- [ ] **Step 3: Write the actions**

Create `app/admin/(protected)/media/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAudit } from "@/lib/admin/audit";
import { validateImage, uuidFilename } from "@/lib/admin/uploads";

type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_CATEGORIES = new Set([
  "drives_rallies",
  "track",
  "private_parties",
  "coffee_runs",
]);

export async function uploadMedia(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const category = String(formData.get("category") ?? "");
  if (!VALID_CATEGORIES.has(category)) {
    return { ok: false, error: "Invalid category." };
  }

  const file = formData.get("file") as File | null;
  const validated = validateImage(file);
  if ("error" in validated) return { ok: false, error: validated.error };

  const path = `${category}/${uuidFilename(validated.extension)}`;
  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, validated.file, { contentType: validated.file.type });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error } = await supabase
    .from("media")
    .insert({ category, storage_path: path })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: email,
    action: "create",
    entityType: "media",
    entityId: data.id,
    snapshot: data,
  });

  revalidatePath("/media");
  revalidatePath("/admin/media");
  redirect("/admin/media");
}

export async function deleteMedia(id: string): Promise<void> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("media")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    adminEmail: email,
    action: "delete",
    entityType: "media",
    entityId: id,
    snapshot: existing ?? null,
  });

  revalidatePath("/media");
  revalidatePath("/admin/media");
  redirect("/admin/media");
}
```

- [ ] **Step 4: Write the media page**

Create `app/admin/(protected)/media/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import UploadForm from "./UploadForm";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { slug: "drives_rallies", label: "Drives / Rallies" },
  { slug: "track", label: "Track Events" },
  { slug: "private_parties", label: "Private Parties" },
  { slug: "coffee_runs", label: "Coffee Runs" },
] as const;

type Row = { id: string; category: string; storage_path: string; created_at: string };

export default async function AdminMediaPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("media")
    .select("id, category, storage_path, created_at")
    .order("created_at", { ascending: false });
  const rows: Row[] = data ?? [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <div className="space-y-10">
      <h2 className="text-3xl font-serif">Media</h2>

      {CATEGORIES.map((cat) => {
        const items = rows.filter((r) => r.category === cat.slug);
        return (
          <section key={cat.slug}>
            <h3 className="text-xl font-medium mb-3">{cat.label}</h3>
            <UploadForm category={cat.slug} />
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {items.map((row) => {
                const src = `${supabaseUrl}/storage/v1/object/public/media/${row.storage_path}`;
                return (
                  <div key={row.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-32 w-full rounded object-cover" />
                    <form
                      action={`/admin/media/${row.id}/delete`}
                      method="post"
                      className="absolute top-1 right-1"
                    >
                      <button
                        type="submit"
                        className="rounded bg-black/70 px-2 py-0.5 text-xs text-white"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="col-span-full text-sm text-text-muted">
                  No media in this category yet.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

Create `app/admin/(protected)/media/UploadForm.tsx`:

```tsx
"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadMedia } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
    >
      {pending ? "Uploading…" : "Upload"}
    </button>
  );
}

export default function UploadForm({ category }: { category: string }) {
  const [state, formAction] = useFormState(uploadMedia, null);
  return (
    <form action={formAction} encType="multipart/form-data" className="flex items-center gap-3">
      <input type="hidden" name="category" value={category} />
      <input
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        required
        className="text-sm"
      />
      <SubmitButton />
      {state && !state.ok && (
        <span className="text-sm text-red-700">{state.error}</span>
      )}
    </form>
  );
}
```

- [ ] **Step 5: Delete route**

Create `app/admin/(protected)/media/[id]/delete/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { deleteMedia } from "../../actions";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await deleteMedia(params.id);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
  return NextResponse.redirect(new URL("/admin/media", _req.nextUrl.origin));
}
```

- [ ] **Step 6: Run the tests**

Run: `npx playwright test e2e/admin-media.spec.ts --project=desktop`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add app/admin/(protected)/media e2e/admin-media.spec.ts
git commit -m "Add admin media upload + delete per category"
```

---

## Task 16: Audit log viewer

**Files:**
- Create: `app/admin/(protected)/audit/page.tsx`
- Test: `e2e/admin-audit.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Create `e2e/admin-audit.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { signInAsAdmin, serviceClient } from "./helpers/admin-session";

const ADMIN_EMAIL = "nickwallibe@gmail.com";

test.describe("Audit log", () => {
  test.beforeAll(async () => {
    const admin = serviceClient();
    await admin.from("admin_emails").upsert({ email: ADMIN_EMAIL });
  });

  test("audit page lists recent entries newest-first", async ({ page, context }) => {
    const admin = serviceClient();
    await admin.from("admin_audit_log").insert([
      {
        admin_email: ADMIN_EMAIL,
        action: "create",
        entity_type: "event",
        entity_id: "11111111-1111-1111-1111-111111111111",
        snapshot: { title: "Audit Test A" },
      },
      {
        admin_email: ADMIN_EMAIL,
        action: "update",
        entity_type: "event",
        entity_id: "11111111-1111-1111-1111-111111111111",
        snapshot: { title: "Audit Test A (edited)" },
      },
    ]);

    await signInAsAdmin(context, ADMIN_EMAIL);
    await page.goto("/admin/audit");

    const rows = page.locator('[data-testid="audit-row"]');
    await expect(rows.first()).toContainText(/update/i);
    await expect(rows.nth(1)).toContainText(/create/i);
  });
});
```

- [ ] **Step 2: Write the page**

Create `app/admin/(protected)/audit/page.tsx`:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  snapshot: unknown;
  created_at: string;
};

export default async function AuditPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, admin_email, action, entity_type, entity_id, snapshot, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows: Row[] = data ?? [];

  return (
    <div>
      <h2 className="text-3xl font-serif mb-6">Audit log</h2>
      <p className="text-sm text-text-muted mb-4">
        Showing the most recent 200 entries, newest first.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <details
            key={r.id}
            data-testid="audit-row"
            className="rounded border border-gray-200 p-3 text-sm"
          >
            <summary className="cursor-pointer">
              <span className="font-mono text-xs text-text-muted">
                {new Date(r.created_at).toLocaleString()}
              </span>{" "}
              — {r.admin_email} — <strong>{r.action}</strong> {r.entity_type}
              {r.entity_id ? ` (${r.entity_id.slice(0, 8)}…)` : ""}
            </summary>
            <pre className="mt-3 overflow-x-auto rounded bg-gray-50 p-3 text-xs">
              {JSON.stringify(r.snapshot, null, 2)}
            </pre>
          </details>
        ))}
        {rows.length === 0 && (
          <p className="text-text-muted">No audit entries yet.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the test**

Run: `npx playwright test e2e/admin-audit.spec.ts --project=desktop`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add app/admin/(protected)/audit e2e/admin-audit.spec.ts
git commit -m "Add audit log viewer"
```

---

## Task 17: Configure NEXT_PUBLIC_SITE_URL on Vercel

**Files:**
- Modify: `.env.example` (document `NEXT_PUBLIC_SITE_URL`)

- [ ] **Step 1: Add to `.env.example`**

Append to `.env.example` if missing:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Set on Vercel**

Use the production URL for both production and preview environments (per-preview URLs are future work):

```bash
# Production
printf "https://ssrg-website-nwallace-3136s-projects.vercel.app\n" \
  | npx vercel env add NEXT_PUBLIC_SITE_URL production
# Preview — CLI expects empty string as the branch positional for "all preview branches" (per CLAUDE.md)
printf "https://ssrg-website-nwallace-3136s-projects.vercel.app\n" \
  | npx vercel env add NEXT_PUBLIC_SITE_URL preview ""
# Development
printf "http://localhost:3000\n" \
  | npx vercel env add NEXT_PUBLIC_SITE_URL development
```

Verify:

```bash
npx vercel env ls
```

Expected: `NEXT_PUBLIC_SITE_URL` appears with values in production, preview, and development.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "Document NEXT_PUBLIC_SITE_URL"
```

---

## Task 18: Final verification + deploy

- [ ] **Step 1: Run the full test suite locally**

Run:

```bash
npm run build
npx playwright test
```

Expected: build clean; all e2e tests pass.

- [ ] **Step 2: Deploy a preview**

Run:

```bash
npx vercel deploy
```

Note the preview URL.

- [ ] **Step 3: Manual magic-link verification with all three admins**

On the preview URL:

1. `/admin/login` → enter `nickwallibe@gmail.com` → receive email → click link → lands on `/admin` with sidebar.
2. Log out, repeat with `sally@...`.
3. Log out, repeat with `james@...`.
4. Log out, enter a non-admin email (e.g., `test@example.com`) → receive email → click link → redirected to `/admin/login?error=not_authorized` with the "not on the admin list" notice.

If any step fails, fix and redeploy before continuing.

- [ ] **Step 4: Update project status memory**

Edit `/Users/nico/.claude/projects/-Users-nico-ssrg-website-ssrg-website/memory/project_status.md` — move these items from "Not done" to "Done":

- Supabase admin auth wiring.
- Admin panel UI at `/admin` (events CRUD + media CRUD, TipTap WYSIWYG).

Add a new "Done" line noting the audit log was added.

- [ ] **Step 5: Production deploy**

Once the preview is verified:

```bash
npx vercel deploy --prod
```

- [ ] **Step 6: Final commit**

```bash
git commit --allow-empty -m "Week 2 admin panel complete"
```

---

## Out of scope (tracked for later)

- Deleting orphaned Storage files when events/media rows are removed.
- Audit log filtering / search.
- Admin user management UI (`admin_emails` still managed via migrations).
- Stripe checkout + webhook handler (Week 3-4).
- Per-preview `NEXT_PUBLIC_SITE_URL` derivation from `VERCEL_URL`.
