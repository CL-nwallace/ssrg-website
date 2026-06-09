import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripeServer } from "@/lib/stripe";

export const dynamic = "force-dynamic";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripeServer().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("stripe webhook: signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const eventId = session.metadata?.event_id;
  if (!eventId) {
    console.error("stripe webhook: session has no metadata.event_id", session.id);
    return new Response("Missing event_id metadata", { status: 400 });
  }

  const supabase = serviceClient();

  const { data: eventRow, error: eventErr } = await supabase
    .from("events")
    .select("id, price_cents")
    .eq("id", eventId)
    .maybeSingle();
  if (eventErr) {
    console.error("stripe webhook: failed to load event", eventErr);
    return new Response("Internal error", { status: 500 });
  }
  if (!eventRow) {
    console.error("stripe webhook: event not found", { sessionId: session.id, eventId });
    return new Response("Event not found", { status: 400 });
  }
  if ((session.amount_total ?? -1) !== eventRow.price_cents) {
    console.error("stripe webhook: amount_total mismatch", {
      sessionId: session.id,
      expected: eventRow.price_cents,
      actual: session.amount_total,
    });
    return new Response("Amount mismatch", { status: 400 });
  }

  const car =
    session.custom_fields?.find((f) => f.key === "car_make_model")?.text?.value ?? "";
  const igRaw =
    session.custom_fields?.find((f) => f.key === "instagram_handle")?.text?.value;
  const ig = igRaw && igRaw.length > 0 ? igRaw : null;

  const email = session.customer_details?.email ?? "";
  const name = session.customer_details?.name ?? "";
  if (!email || !name || !car) {
    console.error("stripe webhook: missing required customer fields", {
      sessionId: session.id,
      hasEmail: !!email,
      hasName: !!name,
      hasCar: !!car,
    });
    return new Response("Missing required fields", { status: 400 });
  }

  const { error: insertErr } = await supabase.from("registrations").insert({
    event_id: eventId,
    stripe_session_id: session.id,
    email,
    name,
    car_make_model: car,
    instagram_handle: ig,
    amount_paid_cents: session.amount_total ?? 0,
  });

  // 23505 = unique_violation on stripe_session_id; treat duplicate deliveries as success.
  if (insertErr && insertErr.code !== "23505") {
    console.error("stripe webhook: insert failed", insertErr);
    return new Response("Insert failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
