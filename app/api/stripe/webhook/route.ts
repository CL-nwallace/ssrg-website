import Stripe from "stripe";
import { stripeServer } from "@/lib/stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

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
  const registrationId = session.metadata?.registration_id;
  if (!registrationId) {
    console.error("stripe webhook: session has no metadata.registration_id", session.id);
    return new Response("Missing registration_id metadata", { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: registration, error: regErr } = await supabase
    .from("registrations")
    .select("id, status")
    .eq("id", registrationId)
    .maybeSingle();
  if (regErr) {
    console.error("stripe webhook: failed to load registration", regErr);
    return new Response("Internal error", { status: 500 });
  }
  if (!registration) {
    console.error("stripe webhook: registration not found", {
      sessionId: session.id,
      registrationId,
    });
    return new Response("Registration not found", { status: 400 });
  }
  // Duplicate delivery of an already-processed session.
  if (registration.status === "paid") {
    return new Response("ok", { status: 200 });
  }

  const expected = Number(session.metadata?.amount_expected_cents ?? NaN);
  if (!Number.isFinite(expected) || (session.amount_total ?? -1) !== expected) {
    console.error("stripe webhook: amount_total mismatch", {
      sessionId: session.id,
      expected,
      actual: session.amount_total,
    });
    return new Response("Amount mismatch", { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("registrations")
    .update({
      status: "paid",
      amount_paid_cents: session.amount_total ?? 0,
      stripe_session_id: session.id,
    })
    .eq("id", registrationId);
  if (updateErr) {
    console.error("stripe webhook: update failed", updateErr);
    return new Response("Update failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
