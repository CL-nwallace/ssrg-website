-- Add a monotonic sequence column to admin_audit_log for deterministic ordering
-- when multiple rows share the same created_at timestamp (e.g. batch inserts in tests).

alter table public.admin_audit_log
  add column if not exists seq bigserial not null;

create index if not exists admin_audit_log_seq_idx
  on public.admin_audit_log (seq desc);
