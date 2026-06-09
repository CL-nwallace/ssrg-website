import { NextResponse } from "next/server";
import { stripeServer } from "@/lib/stripe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const form = await request.formData();
  const eventId = String(form.get("event_id") ?? "");
  if (!eventId) {
    return new Response("Missing event_id", { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const { data: event, error } = await supabase
    .from("events")
    .select("id, title, price_cents, event_date, status")
    .eq("id", eventId)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    console.error("checkout: failed to load event", error);
    return new Response("Internal error", { status: 500 });
  }
  if (!event) {
    return new Response("Event not found", { status: 404 });
  }

  const origin =
    request.headers.get("origin") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const session = await stripeServer().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: event.price_cents,
          product_data: {
            name: event.title,
            description: `Event date: ${event.event_date}`,
          },
        },
      },
    ],
    custom_fields: [
      {
        key: "car_make_model",
        label: { type: "custom", custom: "Car make & model" },
        type: "text",
        optional: false,
      },
      {
        key: "instagram_handle",
        label: { type: "custom", custom: "Instagram handle (optional)" },
        type: "text",
        optional: true,
      },
    ],
    billing_address_collection: "required",
    metadata: { event_id: event.id },
    success_url: `${origin}/events/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/events`,
  });

  if (!session.url) {
    console.error("checkout: Stripe returned a session without a url");
    return new Response("Failed to create checkout session", { status: 500 });
  }

  return NextResponse.redirect(session.url, 303);
}
