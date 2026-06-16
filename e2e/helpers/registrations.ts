import { serviceClient } from "./admin-session";

export type RegistrationRow = {
  id: string;
  event_id: string;
  stripe_session_id: string | null;
  status: "pending" | "paid";
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  shirt_size: string | null;
  car_make: string | null;
  car_model: string | null;
  has_passenger: boolean | null;
  passenger_first_name: string | null;
  passenger_last_name: string | null;
  passenger_shirt_size: string | null;
  answers: {
    instagram?: string | null;
    facebook?: string | null;
    passenger_social?: string | null;
    dietary?: { driver?: string[]; passenger?: string[] };
    meals?: Record<string, { driver?: string; passenger?: string }>;
    addons?: Record<string, number>;
  };
  waiver_accepted_at: string | null;
  amount_paid_cents: number | null;
  created_at: string;
};

/**
 * Insert a published test event via the service-role client. Returns its id.
 * registration_config defaults to null, which the app treats as the Monterey
 * template (effectiveConfig fallback). Caller must call deleteTestEvent.
 */
export async function seedTestEvent(args: {
  title: string;
  price_cents: number;
  registration_deadline?: string;
  registration_config?: unknown;
}): Promise<string> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: args.title,
      event_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      price_cents: args.price_cents,
      description_html: "<p>Test event (created by e2e helper).</p>",
      status: "published",
      registration_deadline: args.registration_deadline ?? null,
      registration_config: args.registration_config ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("seedTestEvent: insert returned no row");
  }
  return data.id;
}

/**
 * Delete a test event and all its registrations. Run in test teardown.
 * `registrations.event_id` is ON DELETE RESTRICT, so registrations go first.
 */
export async function deleteTestEvent(eventId: string): Promise<void> {
  const supabase = serviceClient();
  await supabase.from("registrations").delete().eq("event_id", eventId);
  await supabase.from("events").delete().eq("id", eventId);
}

/**
 * Insert a pending registration row directly (simulating what /api/checkout
 * does before redirecting to Stripe). Returns the row id.
 */
export async function insertPendingRegistration(
  eventId: string,
  overrides: Partial<Record<string, unknown>> = {},
): Promise<string> {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("registrations")
    .insert({
      event_id: eventId,
      status: "pending",
      email: "pending@example.com",
      first_name: "Pending",
      last_name: "Buyer",
      shirt_size: "LRG",
      car_make: "Porsche",
      car_model: "918",
      has_passenger: false,
      answers: { meals: { thursday_lunch: { driver: "Pork Taco" } }, addons: {} },
      waiver_accepted_at: new Date().toISOString(),
      ...overrides,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("insertPendingRegistration: insert returned no row");
  }
  return data.id;
}

/** One-shot lookup by row id. */
export async function getRegistrationById(id: string): Promise<RegistrationRow | null> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as RegistrationRow | null) ?? null;
}

/** One-shot lookup by Stripe session id. Returns null if no row. */
export async function getRegistrationBySessionId(
  sessionId: string,
): Promise<RegistrationRow | null> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("registrations")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();
  return (data as RegistrationRow | null) ?? null;
}

/**
 * Poll until at least one registrations row exists for the given event,
 * optionally filtered by status. Returns the most recent one.
 */
export async function waitForRegistration(
  eventId: string,
  opts: { timeoutMs?: number; status?: "pending" | "paid" } = {},
): Promise<RegistrationRow> {
  const timeout = opts.timeoutMs ?? 15_000;
  const start = Date.now();
  const supabase = serviceClient();
  while (Date.now() - start < timeout) {
    let query = supabase
      .from("registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (opts.status) query = query.eq("status", opts.status);
    const { data } = await query.maybeSingle();
    if (data) return data as RegistrationRow;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `waitForRegistration: timed out after ${timeout}ms for event ${eventId}`,
  );
}

/** Count of registration rows for an event. Used to assert idempotency. */
export async function countRegistrations(eventId: string): Promise<number> {
  const supabase = serviceClient();
  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}
