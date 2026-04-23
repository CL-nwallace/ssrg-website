# SSRG Admin Panel — Design Spec

**Date:** 2026-04-23
**Phase:** Week 2 (admin panel build per `SSRG-Website-Action-Plan.md`)
**Scope:** Admin authentication, events CRUD, media CRUD, audit log.

## Goal

Replace the Wix admin experience with a Next.js `/admin` area that lets three admins (Sally, James, Nico) manage events and gallery media, gated by the existing `admin_emails` allowlist. Every mutation is recorded in an append-only audit log with before/after snapshots.

## Non-goals

- Admin user management UI (`admin_emails` managed via SQL migrations).
- Deleting orphaned Storage files when rows are removed (tracked as future work).
- Stripe integration (Week 3-4).
- DNS cutover (blocked on GoDaddy access).
- Audit log filtering or search.
- Recurring events, capacity limits, waitlists.

## Architecture

### Routes (under `app/admin/`)

| Path | Purpose |
|---|---|
| `/admin/login` | Magic-link request form |
| `/admin/auth/callback` | Code-exchange route handler, sets session cookie |
| `/admin` | Dashboard landing (links to sections + logout) |
| `/admin/events` | Events list |
| `/admin/events/new` | Create event |
| `/admin/events/[id]` | Edit event |
| `/admin/media` | Per-category media manager |
| `/admin/audit` | Reverse-chronological audit log |

### Auth

- **Method:** Supabase email OTP (magic link). No passwords.
- **Allowlist:** `public.admin_emails` table (already exists with `sally@...`, `james@...`; migration adds `nickwallibe@gmail.com`).
- **Session refresh:** `middleware.ts` at repo root runs only on `/admin/**`. Uses `@supabase/ssr` middleware client to refresh the cookie and redirect when the user is missing a session or not in the allowlist.
- **Defense-in-depth:** `lib/admin/require-admin.ts` re-checks session + allowlist server-side in `app/admin/layout.tsx` and at the top of every Server Action. Middleware alone is not treated as a security boundary.
- **RLS is the real gate.** All data reads and writes from admin pages go through the admin's JWT; the existing RLS policies in `supabase/migrations/0001_initial.sql` enforce access. The app never uses the service-role key at request time.

### Data writes

- **Next.js Server Actions** invoked from admin forms, reusing `createSupabaseServerClient()`.
- Every mutation writes an audit log row via `lib/admin/audit.ts` before returning.
- On success, actions call `revalidatePath('/events')` or `/media` so public pages reflect the change, then redirect.

### File uploads

- Server Action receives `FormData` including the file.
- Uploads via the admin JWT to Supabase Storage (`event-covers/<event-id>/<uuid>.<ext>` or `media/<category>/<uuid>.<ext>`).
- Validation: MIME in `{image/jpeg, image/png, image/webp}`; size ≤ 8 MB.
- Storage policies from `0001_initial.sql` already restrict writes to admins.
- Deletion leaves orphan files; cleanup is future work.

## Components & units

### New files

| File | Role |
|---|---|
| `middleware.ts` | `/admin/**` session refresh + allowlist gate |
| `lib/supabase/middleware.ts` | Creates the middleware Supabase client (distinct cookie API vs server client) |
| `lib/admin/require-admin.ts` | Server-side auth guard; returns admin email or redirects |
| `lib/admin/audit.ts` | `logAudit({ action, entity_type, entity_id, snapshot })` helper |
| `app/admin/layout.tsx` | Shared chrome: sidebar nav, logout; calls `requireAdmin()` |
| `app/admin/login/page.tsx` | Email input form |
| `app/admin/login/actions.ts` | `signInWithOtp` server action |
| `app/admin/auth/callback/route.ts` | Exchanges OTP code for session, redirects to `/admin` |
| `app/admin/page.tsx` | Dashboard landing |
| `app/admin/events/page.tsx` | Events list |
| `app/admin/events/new/page.tsx` | Create form |
| `app/admin/events/[id]/page.tsx` | Edit form |
| `app/admin/events/actions.ts` | `createEvent`, `updateEvent`, `deleteEvent`, `setEventStatus` |
| `app/admin/media/page.tsx` | Four category sections, upload + delete UI |
| `app/admin/media/actions.ts` | `uploadMedia`, `deleteMedia` |
| `app/admin/audit/page.tsx` | Reverse-chron list of audit rows |
| `app/admin/error.tsx` | Error boundary for unexpected Server Action errors |
| `components/admin/TiptapEditor.tsx` | Client component, toolbar, writes HTML into hidden input |
| `components/admin/CoverImageInput.tsx` | Client component, file picker + preview |
| `supabase/migrations/0002_admin_audit_and_emails.sql` | Audit table + Nico's email |
| `e2e/admin.spec.ts` | Playwright tests for admin flows |
| `e2e/helpers/admin-session.ts` | Test helper that mints a Supabase session via service-role key |

### Dependencies

- Runtime: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`.
- Test-only: nothing new — reuse `@supabase/supabase-js` with service-role key via env var.

### Env vars

- `SUPABASE_SERVICE_ROLE_KEY` — added to `.env.local` (and CI secrets when/if CI lands). **Not** added to Vercel runtime — only needed by the e2e helper.

## Data flow

### Login (happy path)

1. `/admin/*` → middleware sees no session → redirect to `/admin/login`.
2. Admin submits email → action calls `supabase.auth.signInWithOtp({ email, emailRedirectTo: '<origin>/admin/auth/callback' })`. UI renders "Check your email."
3. Admin clicks link → `/admin/auth/callback?code=...` exchanges code, cookies set, redirects to `/admin`.
4. Layout's `requireAdmin()` verifies email ∈ `admin_emails`. If not, sign out + redirect to `/admin/login?error=not_authorized`.
5. Log audit row with `action='login'`, `entity_type='auth'`.

### Event edit (happy path)

1. Form submits → `updateEvent(id, FormData)` action.
2. Action fetches the current row (for audit snapshot).
3. If a new cover file is present: upload to Storage; on success, set `cover_image_path` to the new key.
4. `supabase.from('events').update({...}).eq('id', id)` — RLS gates on the admin JWT.
5. `logAudit({ action: 'update', entity_type: 'event', entity_id: id, snapshot: newRow })`.
6. `revalidatePath('/events')` + `revalidatePath('/admin/events')`, redirect to list.

### Media upload

1. Action validates MIME + size.
2. Uploads file to `media/<category>/<uuid>.<ext>`.
3. Inserts `public.media` row with the storage path.
4. Audit log.
5. `revalidatePath('/media')`.

### Delete (events or media)

- Posted with `confirm=yes` hidden field from a dedicated "Delete" button — no JS dialog.
- Capture the row as `snapshot`, then hard-delete.
- Storage file is orphaned (see non-goals).
- Audit log entry reflects the deletion with the pre-delete snapshot.

## Error handling

- Server Actions return `{ ok: true } | { ok: false, error: string }`. Forms display the error above the submit button.
- Uncaught exceptions bubble to `app/admin/error.tsx`.
- No toast infrastructure.

## Migration `0002_admin_audit_and_emails.sql`

```sql
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

## Testing

### Playwright e2e (extends `e2e/`)

`e2e/helpers/admin-session.ts` uses `SUPABASE_SERVICE_ROLE_KEY` with `auth.admin.generateLink({ type: 'magiclink', email })`, extracts the token, and plants the Supabase session cookie on the Playwright browser context. No email round-trip.

Covered flows:

1. Unauthenticated `/admin` → redirect to `/admin/login`.
2. Session for an email not in `admin_emails` → redirect with `error=not_authorized`.
3. Create draft event → not on public `/events`; toggle to published → appears.
4. Edit event title → public `/events` reflects the new title (covers `revalidatePath`).
5. Delete event → removed from `/events` and audit log shows the deletion with snapshot.
6. Upload media to a category → appears as cover on public `/media`.
7. Audit log page renders entries reverse-chronologically.

No unit tests. Server Actions are thin glue; e2e covers behavior.

### Manual verification

Real magic-link round trip in the preview deploy using Nico's, Sally's, and James's addresses before calling the phase done. E2E does not exercise the email send itself.

## Rollout order

Build in this order so nothing ships half-working:

1. Migration + `admin_emails` row + Supabase middleware helper + `requireAdmin()`.
2. `/admin/login` + callback + layout stub that renders "Hello, <email>." Verify end-to-end in preview.
3. Events CRUD with TipTap + cover upload + audit logging.
4. Media uploader + audit logging.
5. Audit log page.
6. Playwright e2e.
7. Final preview deploy + manual three-admin magic-link verification.

## Open risks

- **TipTap bundle size.** Only loaded on `/admin/**`, so public Lighthouse scores are unaffected; verify after integration.
- **Magic-link email deliverability.** Supabase's default sender can land in spam. If that bites us, add a Resend provider later; not in scope for this spec.
- **Orphaned Storage files.** Accepted; future work.
