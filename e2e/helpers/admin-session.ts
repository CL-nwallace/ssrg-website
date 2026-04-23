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
