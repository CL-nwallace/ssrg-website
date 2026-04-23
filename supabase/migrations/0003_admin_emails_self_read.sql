-- Allow authenticated users to read their own row in admin_emails.
-- The middleware and requireAdmin() use the anon/user Supabase client and need
-- to check whether the authenticated user's email is in the allowlist.
-- Without this policy, RLS silently returns no rows, causing valid admins to
-- be rejected with error=not_authorized.

drop policy if exists admin_emails_self_read on public.admin_emails;
create policy admin_emails_self_read on public.admin_emails
  for select
  using (email = (auth.jwt() ->> 'email'));
