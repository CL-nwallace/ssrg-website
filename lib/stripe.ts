import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Server-only Stripe SDK accessor. Lazy so importing this module
 * at build time without STRIPE_SECRET_KEY set doesn't throw.
 *
 * NEVER import this from a "use client" file.
 */
export function stripeServer(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  _stripe = new Stripe(key);
  return _stripe;
}
