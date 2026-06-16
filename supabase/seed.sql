-- Seed data for Week 1 so the public /events and /media pages render real content.
-- Run after 0001_initial.sql. Idempotent: safe to re-run.
-- Prerequisite (manual, dashboard): upload the image files referenced below into the
-- event-covers and media buckets under the paths used here. See CLAUDE.md.

-- Admin email allowlist (domain corrected 2026-05-29 from @ssrg.com to @ssrgofficial.com).
insert into public.admin_emails (email) values
  ('sally@ssrgofficial.com'),
  ('james@ssrgofficial.com')
on conflict (email) do nothing;

-- Events. Sample content only; e2e specs seed their own rows (admins curate these freely).
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

-- Monterey Rally 2026: first event on the registration template (added 2026-06-11).
-- The config shape must match RegistrationConfig in lib/registration/config.ts.
insert into public.events
  (title, event_date, price_cents, description_html, cover_image_path, status,
   registration_deadline, registration_config)
select
  'Monterey Rally 2026',
  timestamptz '2026-08-14 09:00:00-07',
  59900,
  '<p>Three days of driving, dinners, and Car Week. Base registration is per car and includes Thursday and Saturday lunch for driver and passenger.</p>',
  null,
  'published',
  timestamptz '2026-08-13 23:59:00-07',
  '{
    "meals": [
      {
        "key": "thursday_lunch",
        "label": "Thursday Lunch",
        "note": "Message us if you have dietary restrictions.",
        "options": ["Fish & Chips", "Cheese Burger", "Burger (no cheese)", "Caesar Salad", "Pork Taco"]
      }
    ],
    "addons": [
      { "key": "thursday_dinner", "label": "Thursday Dinner", "price_cents": 19900, "max_qty": 2 }
    ],
    "car_options": [
      { "make": "Aston Martin", "models": ["All models"] },
      { "make": "Audi", "models": ["R8"] },
      { "make": "Bugatti", "models": ["All models"] },
      { "make": "Chevrolet", "models": ["C8 Z06", "C8 ZR1"] },
      { "make": "Ferrari", "models": ["All models"] },
      { "make": "Koenigsegg", "models": ["All models"] },
      { "make": "Lamborghini", "models": ["All models"] },
      { "make": "Lotus", "models": ["All models"] },
      { "make": "McLaren", "models": ["All models"] },
      { "make": "Mercedes Benz", "models": ["AMG GTR/GTS/GTC", "AMG McLaren"] },
      { "make": "Pagani", "models": ["All models"] },
      { "make": "Porsche", "models": ["718 GTS/GT4/GT4RS", "991.1/991.2", "GT3/3RS/Turbo/Turbo S/GTS", "All 992 models", "918"] }
    ],
    "shirt_sizes": ["XS", "SML", "MED", "LRG", "XL", "XXL", "3XL"],
    "dietary_options": ["Vegan", "Vegetarian", "No Dairy", "Gluten Free"],
    "passenger_enabled": true,
    "waiver_text": "PLACEHOLDER WAIVER — final liability text pending from the club. By checking the box you acknowledge that motorsport and group-drive activities carry inherent risk and you release SSRG, its organizers, and venues from liability for injury or property damage arising from participation."
  }'::jsonb
-- ilike: an admin already created this event by hand as "MONTEREY Rally 2026";
-- the case-insensitive check stops the seed from ever duplicating it.
where not exists (select 1 from public.events e where e.title ilike 'Monterey Rally 2026');
