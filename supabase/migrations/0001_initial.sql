-- SSRG initial schema: events, media, registrations, admin_emails + RLS + Storage buckets.
-- Applied via Supabase SQL Editor (or `supabase db push` if the CLI is wired up later).

-- =========================================================================
-- Tables
-- =========================================================================

create table if not exists public.admin_emails (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date timestamptz not null,
  price_cents integer not null check (price_cents >= 0),
  description_html text not null default '',
  cover_image_path text,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_status_event_date_idx
  on public.events (status, event_date);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('drives_rallies','track','private_parties','coffee_runs')),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists media_category_created_at_idx
  on public.media (category, created_at desc);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  stripe_session_id text unique,
  email text not null,
  name text not null,
  car_make_model text not null,
  instagram_handle text,
  amount_paid_cents integer not null check (amount_paid_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists registrations_event_id_idx
  on public.registrations (event_id);

-- =========================================================================
-- updated_at trigger for events
-- =========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

-- =========================================================================
-- RLS
-- =========================================================================

alter table public.admin_emails enable row level security;
alter table public.events enable row level security;
alter table public.media enable row level security;
alter table public.registrations enable row level security;

-- admin_emails: no public access. Service role bypasses RLS, so it can still manage rows.
-- (No policies created → default deny.)

-- Helper predicate used in multiple policies: is the current JWT's email in admin_emails?
-- Using auth.jwt() is safe at read time in Supabase.

-- events
drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select
  using (status = 'published');

drop policy if exists events_admin_all on public.events;
create policy events_admin_all on public.events
  for all
  using ((auth.jwt() ->> 'email') in (select email from public.admin_emails))
  with check ((auth.jwt() ->> 'email') in (select email from public.admin_emails));

-- media
drop policy if exists media_public_read on public.media;
create policy media_public_read on public.media
  for select
  using (true);

drop policy if exists media_admin_all on public.media;
create policy media_admin_all on public.media
  for all
  using ((auth.jwt() ->> 'email') in (select email from public.admin_emails))
  with check ((auth.jwt() ->> 'email') in (select email from public.admin_emails));

-- registrations: no anon/auth access. Service role only (Stripe webhook).

-- =========================================================================
-- Storage buckets + policies
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('event-covers', 'event-covers', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Public read is implicit for public buckets, but Supabase still evaluates policies
-- for authenticated operations. Admin-only writes:
drop policy if exists storage_event_covers_admin_write on storage.objects;
create policy storage_event_covers_admin_write on storage.objects
  for all
  using (
    bucket_id = 'event-covers'
    and (auth.jwt() ->> 'email') in (select email from public.admin_emails)
  )
  with check (
    bucket_id = 'event-covers'
    and (auth.jwt() ->> 'email') in (select email from public.admin_emails)
  );

drop policy if exists storage_media_admin_write on storage.objects;
create policy storage_media_admin_write on storage.objects
  for all
  using (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admin_emails)
  )
  with check (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admin_emails)
  );
