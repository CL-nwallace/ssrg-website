import { serviceClient } from "./admin-session";

export type RegistrationRow = {
  id: string;
  event_id: string;
  stripe_session_id: string | null;
  email: string;
  name: string;
  car_make_model: string;
  instagram_handle: string | null;
  amount_paid_cents: number;
  created_at: string;
};

/**
 * Insert a published test event via the service-role client. Returns its id.
 * Caller is responsible for calling deleteTestEvent at the end of the test.
 */
export async function seedTestEvent(args: {
  title: string;
  price_cents: number;
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
 * `registrations.event_id` is ON DELETE RESTRICT, so registrations must go first.
 */
export async function deleteTestEvent(eventId: string): Promise<void> {
  const supabase = serviceClient();
  await supabase.from("registrations").delete().eq("event_id", eventId);
  await supabase.from("events").delete().eq("id", eventId);
}

/**
 * Poll until at least one registrations row exists for the given event.
 * Returns the most recent one. Throws on timeout.
 */
export async function waitForRegistration(
  eventId: string,
  opts: { timeoutMs?: number } = {},
): Promise<RegistrationRow> {
  const timeout = opts.timeoutMs ?? 15_000;
  const start = Date.now();
  const supabase = serviceClient();
  while (Date.now() - start < timeout) {
    const { data } = await supabase
      .from("registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as RegistrationRow;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `waitForRegistration: timed out after ${timeout}ms for event ${eventId}`,
  );
}

/**
 * One-shot lookup by Stripe session id. Returns null if no row.
 */
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
 * Count of registration rows for an event. Used to assert idempotency.
 */
export async function countRegistrations(eventId: string): Promise<number> {
  const supabase = serviceClient();
  const { count } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  return count ?? 0;
}
