-- Seed data for Week 1 so the public /events and /media pages render real content.
-- Run after 0001_initial.sql. Idempotent: safe to re-run.
-- Prerequisite (manual, dashboard): upload the image files referenced below into the
-- event-covers and media buckets under the paths used here. See CLAUDE.md.

-- Admin email allowlist (confirmed 2026-04-22).
insert into public.admin_emails (email) values
  ('sally@ssrg.com'),
  ('james@ssrg.com')
on conflict (email) do nothing;

-- Events. The "LA to Las Vegas" $3,000 row is load-bearing for e2e/events.spec.ts.
insert into public.events (title, event_date, price_cents, description_html, cover_image_path, status)
select * from (values
  (
    'LA to Las Vegas',
    timestamptz '2026-06-14 09:00:00-07',
    300000,
    '<p>A two-day high-desert run from Los Angeles to the Strip. Curated hotels, private parking, and a Saturday-night dinner reservation for the group.</p>',
    'event-vegas.jpg',
    'published'
  ),
  (
    'Canyon Coffee Run',
    timestamptz '2026-05-10 07:30:00-07',
    0,
    '<p>Early-morning canyon drive ending at a private coffee stop. Free for members; RSVP required so the cafe can staff up.</p>',
    'goal.jpg',
    'published'
  ),
  (
    'Track Day — Willow Springs',
    timestamptz '2026-07-19 08:00:00-07',
    150000,
    '<p>Full-day track rental at Willow Springs International Raceway. Instructor-led run groups, professional photography included.</p>',
    'track-cover.jpg',
    'published'
  )
) as v(title, event_date, price_cents, description_html, cover_image_path, status)
where not exists (select 1 from public.events e where e.title = v.title);

-- One sample photo per gallery category.
insert into public.media (category, storage_path)
select * from (values
  ('drives_rallies', 'drives_rallies/media-rallies.jpg'),
  ('track',         'track/track-cover.jpg'),
  ('private_parties','private_parties/media-private.jpg'),
  ('coffee_runs',   'coffee_runs/media-coffee.jpg')
) as v(category, storage_path)
where not exists (
  select 1 from public.media m where m.category = v.category and m.storage_path = v.storage_path
);
