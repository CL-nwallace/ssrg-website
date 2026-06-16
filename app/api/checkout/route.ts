import { NextResponse } from "next/server";
import { stripeServer } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { effectiveConfig } from "@/lib/registration/config";
import { validateSubmission } from "@/lib/registration/validate";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  if (!eventId) {
    return NextResponse.json({ error: "Missing event_id." }, { status: 400 });
  }

  // Service role: registrations is default-deny under RLS and this route
  // must insert the pending row.
  const supabase = createSupabaseServiceClient();
  const { data: event, error } = await supabase
    .from("events")
    .select(
      "id, title, price_cents, event_date, status, registration_deadline, registration_config",
    )
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("checkout: failed to load event", error);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  // Deadline is enforced here, not just in the UI — a form loaded before the
  // deadline but submitted after must be rejected.
  const closesAt = new Date(event.registration_deadline ?? event.event_date);
  if (closesAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Registration for this event has closed." },
      { status: 410 },
    );
  }

  const config = effectiveConfig(event.registration_config);
  const result = validateSubmission(config, event.price_cents, event.title, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { row, lineItems, totalCents } = result.value;

  const { data: registration, error: insertErr } = await supabase
    .from("registrations")
    .insert({
      event_id: event.id,
      status: "pending",
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      shirt_size: row.shirt_size,
      car_make: row.car_make,
      car_model: row.car_model,
      has_passenger: row.has_passenger,
      passenger_first_name: row.passenger_first_name,
      passenger_last_name: row.passenger_last_name,
      passenger_shirt_size: row.passenger_shirt_size,
      answers: row.answers,
      waiver_accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertErr || !registration) {
    console.error("checkout: failed to insert pending registration", insertErr);
    return NextResponse.json({ error: "Internal error." }, { status: 500 });
  }

  const fallbackOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const requestOrigin = request.headers.get("origin");
  const allowedOrigins = new Set([
    fallbackOrigin,
    "http://localhost:3000",
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
  ]);
  const origin =
    requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : fallbackOrigin;

  let session;
  try {
    session = await stripeServer().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems.map((li) => ({
        quantity: li.quantity,
        price_data: {
          currency: "usd",
          unit_amount: li.unit_amount_cents,
          product_data: { name: li.label },
        },
      })),
      billing_address_collection: "required",
      customer_email: row.email,
      metadata: {
        event_id: event.id,
        registration_id: registration.id,
        amount_expected_cents: String(totalCents),
      },
      success_url: `${origin}/events/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/events/${event.id}/register`,
    });
  } catch (err) {
    console.error("checkout: Stripe session creation failed", err);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }

  if (!session.url) {
    console.error("checkout: Stripe returned a session without a url");
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }

  const { error: sessionWriteErr } = await supabase
    .from("registrations")
    .update({ stripe_session_id: session.id })
    .eq("id", registration.id);
  if (sessionWriteErr) {
    console.error("checkout: failed to write back stripe_session_id", sessionWriteErr);
  }

  return NextResponse.json({ url: session.url });
}
