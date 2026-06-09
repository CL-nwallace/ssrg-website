import { test, expect, request as pwRequest } from "@playwright/test";
import { seedTestEvent, deleteTestEvent } from "./helpers/registrations";
import { serviceClient } from "./helpers/admin-session";

const CHECKOUT_URL = "http://localhost:3000/api/checkout";

test.describe("/api/checkout", () => {
  let eventId: string;

  test.beforeEach(async () => {
    eventId = await seedTestEvent({
      title: `Checkout Spec ${Date.now()}`,
      price_cents: 1234,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("redirects to a Stripe Checkout URL for a published event", async () => {
    const api = await pwRequest.newContext();
    const form = new URLSearchParams();
    form.set("event_id", eventId);

    const res = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: form.toString(),
      maxRedirects: 0,
    });

    expect(res.status()).toBe(303);
    const location = res.headers()["location"];
    expect(location).toBeTruthy();
    expect(location).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });

  test("returns 404 for an unknown event id", async () => {
    const api = await pwRequest.newContext();
    const form = new URLSearchParams();
    form.set("event_id", "00000000-0000-0000-0000-000000000000");

    const res = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: form.toString(),
      maxRedirects: 0,
    });

    expect(res.status()).toBe(404);
  });

  test("returns 404 for a draft event (unpublished)", async () => {
    await serviceClient().from("events").update({ status: "draft" }).eq("id", eventId);

    const api = await pwRequest.newContext();
    const form = new URLSearchParams();
    form.set("event_id", eventId);

    const res = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: form.toString(),
      maxRedirects: 0,
    });

    expect(res.status()).toBe(404);
  });

  test("returns 400 when event_id is missing", async () => {
    const api = await pwRequest.newContext();
    const res = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/x-www-form-urlencoded" },
      data: "",
      maxRedirects: 0,
    });
    expect(res.status()).toBe(400);
  });
});
