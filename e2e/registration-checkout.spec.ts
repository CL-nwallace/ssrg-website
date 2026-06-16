import { test, expect, request as pwRequest } from "@playwright/test";
import Stripe from "stripe";
import {
  seedTestEvent,
  deleteTestEvent,
  waitForRegistration,
  countRegistrations,
} from "./helpers/registrations";

const CHECKOUT_URL = "http://localhost:3000/api/checkout";

function validBody(eventId: string): Record<string, unknown> {
  return {
    event_id: eventId,
    first_name: "Test",
    last_name: "Driver",
    email: "driver@example.com",
    phone: "555-0100",
    shirt_size: "LRG",
    instagram: "@driver",
    facebook: "",
    car_make: "Porsche",
    car_model: "918",
    car_model_other: "",
    has_passenger: true,
    passenger: { first_name: "Pat", last_name: "Rider", shirt_size: "MED", social: "@pat" },
    meals: { thursday_lunch: { driver: "Pork Taco", passenger: "Caesar Salad" } },
    dietary: { driver: ["Vegan"], passenger: ["Gluten Free"] },
    addons: { thursday_dinner: 2 },
    waiver_accepted: true,
  };
}

async function postCheckout(body: unknown) {
  const api = await pwRequest.newContext();
  return api.post(CHECKOUT_URL, {
    headers: { "content-type": "application/json" },
    data: JSON.stringify(body),
  });
}

test.describe("/api/checkout (registration template)", () => {
  let eventId: string;

  test.beforeEach(async () => {
    // No registration_config => effectiveConfig falls back to the Monterey template.
    eventId = await seedTestEvent({
      title: `Checkout Spec ${Date.now()}`,
      price_cents: 1234,
    });
  });

  test.afterEach(async () => {
    if (eventId) await deleteTestEvent(eventId);
  });

  test("valid submission: pending row + itemized Stripe session", async () => {
    const res = await postCheckout(validBody(eventId));
    expect(res.status()).toBe(200);
    const { url } = (await res.json()) as { url: string };
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

    const row = await waitForRegistration(eventId, { status: "pending" });
    expect(row.first_name).toBe("Test");
    expect(row.shirt_size).toBe("LRG");
    expect(row.car_make).toBe("Porsche");
    expect(row.car_model).toBe("918");
    expect(row.has_passenger).toBe(true);
    expect(row.passenger_first_name).toBe("Pat");
    expect(row.answers.addons!.thursday_dinner).toBe(2);
    expect(row.answers.meals!.thursday_lunch.passenger).toBe("Caesar Salad");
    expect(row.answers.dietary!.driver).toEqual(["Vegan"]);
    expect(row.answers.dietary!.passenger).toEqual(["Gluten Free"]);
    expect(row.waiver_accepted_at).not.toBeNull();
    expect(row.amount_paid_cents).toBeNull();
    expect(row.stripe_session_id).toMatch(/^cs_/);

    // Itemization is real on Stripe's side: base 1234 + dinner 19900 x 2.
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id!);
    expect(session.amount_total).toBe(1234 + 19900 * 2);
    const items = await stripe.checkout.sessions.listLineItems(row.stripe_session_id!);
    const amounts = items.data
      .map((i) => ({ qty: i.quantity, unit: i.price?.unit_amount }))
      .sort((a, b) => (a.unit ?? 0) - (b.unit ?? 0));
    expect(amounts).toEqual([
      { qty: 1, unit: 1234 },
      { qty: 2, unit: 19900 },
    ]);
  });

  test("client-sent prices are ignored", async () => {
    const body = {
      ...validBody(eventId),
      addons: { thursday_dinner: 1 },
      price_cents: 1, // attacker-controlled junk the server must ignore
      total_cents: 1,
      amount: 1,
    };
    const res = await postCheckout(body);
    expect(res.status()).toBe(200);
    const row = await waitForRegistration(eventId, { status: "pending" });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id!);
    expect(session.amount_total).toBe(1234 + 19900);
  });

  test("no passenger, no add-ons: single line item", async () => {
    const body = {
      ...validBody(eventId),
      has_passenger: false,
      passenger: undefined,
      meals: { thursday_lunch: { driver: "Caesar Salad" } },
      addons: {},
    };
    const res = await postCheckout(body);
    expect(res.status()).toBe(200);
    const row = await waitForRegistration(eventId, { status: "pending" });
    expect(row.has_passenger).toBe(false);
    expect(row.passenger_first_name).toBeNull();
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id!);
    expect(session.amount_total).toBe(1234);
  });

  test("manual car entry via Other / not listed", async () => {
    const body = {
      ...validBody(eventId),
      car_make: "Other / not listed",
      car_model: "",
      car_model_other: "Nissan GT-R NISMO",
    };
    const res = await postCheckout(body);
    expect(res.status()).toBe(200);
    const row = await waitForRegistration(eventId, { status: "pending" });
    expect(row.car_make).toBe("Other / not listed");
    expect(row.car_model).toBe("Nissan GT-R NISMO");
  });

  test("All models selection requires a typed model", async () => {
    const body = {
      ...validBody(eventId),
      car_make: "Ferrari",
      car_model: "All models",
      car_model_other: "",
    };
    const res = await postCheckout(body);
    expect(res.status()).toBe(400);
    expect(((await res.json()) as { error: string }).error).toMatch(/type your car model/i);
  });

  test("rejections: each invalid field returns 400 and writes no row", async () => {
    const cases: Array<Record<string, unknown>> = [
      { ...validBody(eventId), first_name: "" },
      { ...validBody(eventId), email: "not-an-email" },
      { ...validBody(eventId), shirt_size: "XXXXL" },
      { ...validBody(eventId), car_make: "Yugo", car_model: "45" },
      { ...validBody(eventId), meals: { thursday_lunch: { driver: "Sushi", passenger: "Caesar Salad" } } },
      { ...validBody(eventId), addons: { thursday_dinner: 3 } },
      { ...validBody(eventId), addons: { bogus_addon: 1 } },
      { ...validBody(eventId), waiver_accepted: false },
      { ...validBody(eventId), has_passenger: true, passenger: { first_name: "", last_name: "", shirt_size: "MED" } },
    ];
    for (const body of cases) {
      const res = await postCheckout(body);
      expect(res.status(), JSON.stringify(body)).toBe(400);
    }
    expect(await countRegistrations(eventId)).toBe(0);
  });

  test("rejects an unknown dietary restriction", async () => {
    const res = await postCheckout({ ...validBody(eventId), dietary: { driver: ["Carnivore"] } });
    expect(res.status()).toBe(400);
    expect(await countRegistrations(eventId)).toBe(0);
  });

  test("410 once the registration deadline has passed", async () => {
    const closedId = await seedTestEvent({
      title: `Closed Checkout ${Date.now()}`,
      price_cents: 1000,
      registration_deadline: new Date(Date.now() - 60_000).toISOString(),
    });
    const res = await postCheckout(validBody(closedId));
    expect(res.status()).toBe(410);
    expect(await countRegistrations(closedId)).toBe(0);
    await deleteTestEvent(closedId);
  });

  test("404 for unknown and draft events, 400 for bad envelope", async () => {
    const unknown = await postCheckout(validBody("00000000-0000-0000-0000-000000000000"));
    expect(unknown.status()).toBe(404);

    const { serviceClient } = await import("./helpers/admin-session");
    await serviceClient().from("events").update({ status: "draft" }).eq("id", eventId);
    const draft = await postCheckout(validBody(eventId));
    expect(draft.status()).toBe(404);

    const missingId = await postCheckout({ ...validBody(eventId), event_id: "" });
    expect(missingId.status()).toBe(400);

    const api = await pwRequest.newContext();
    const badJson = await api.post(CHECKOUT_URL, {
      headers: { "content-type": "application/json" },
      data: "{not json",
    });
    expect(badJson.status()).toBe(400);
  });
});
