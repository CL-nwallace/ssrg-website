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
