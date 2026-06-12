-- 0005_registration_template.sql
-- Templatized event registration (spec: docs/superpowers/specs/2026-06-11-event-registration-template-design.md).
-- events: per-event registration settings. registrations: pending->paid lifecycle
-- with structured registrant fields; legacy columns (name, car_make_model,
-- instagram_handle) stay for historical rows but are no longer written.

alter table public.events
  add column if not exists registration_deadline timestamptz,
  add column if not exists registration_config jsonb;

alter table public.registrations
  alter column name drop not null,
  alter column car_make_model drop not null,
  alter column amount_paid_cents drop not null;

alter table public.registrations
  add column if not exists status text not null default 'pending',
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists shirt_size text,
  add column if not exists car_make text,
  add column if not exists car_model text,
  add column if not exists has_passenger boolean,
  add column if not exists passenger_first_name text,
  add column if not exists passenger_last_name text,
  add column if not exists passenger_shirt_size text,
  add column if not exists answers jsonb not null default '{}'::jsonb,
  add column if not exists waiver_accepted_at timestamptz;

alter table public.registrations
  drop constraint if exists registrations_status_check;
alter table public.registrations
  add constraint registrations_status_check check (status in ('pending', 'paid'));

-- Every pre-existing row was inserted by the webhook after payment.
update public.registrations set status = 'paid' where stripe_session_id is not null;

create index if not exists registrations_event_status_idx
  on public.registrations (event_id, status);
