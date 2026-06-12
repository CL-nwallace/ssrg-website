import { type RegistrationConfig, ALL_MODELS, OTHER_MAKE } from "./config";

export type LineItem = { label: string; unit_amount_cents: number; quantity: number };

export type ValidatedRegistration = {
  row: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    shirt_size: string;
    car_make: string;
    car_model: string;
    has_passenger: boolean;
    passenger_first_name: string | null;
    passenger_last_name: string | null;
    passenger_shirt_size: string | null;
    answers: {
      instagram: string | null;
      facebook: string | null;
      passenger_social: string | null;
      meals: Record<string, { driver: string; passenger?: string }>;
      addons: Record<string, number>;
    };
  };
  lineItems: LineItem[];
  totalCents: number;
};

export type ValidationResult =
  | { ok: true; value: ValidatedRegistration }
  | { ok: false; error: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * The single authority on what a valid registration submission is.
 * Client-side validation is UX only; every rule lives here.
 * Prices come exclusively from `config` and `basePriceCents` — nothing
 * money-related is read from `input`.
 */
export function validateSubmission(
  config: RegistrationConfig,
  basePriceCents: number,
  baseLabel: string,
  input: unknown,
): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid submission." };
  }
  const o = input as Record<string, unknown>;

  const first_name = str(o.first_name);
  const last_name = str(o.last_name);
  if (!first_name || !last_name) {
    return { ok: false, error: "First and last name are required." };
  }

  const email = str(o.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "A valid email address is required." };
  }

  const phone = str(o.phone) || null;

  const shirt_size = str(o.shirt_size);
  if (!config.shirt_sizes.includes(shirt_size)) {
    return { ok: false, error: "Please select a t-shirt size." };
  }

  // Car: curated dropdown, with two manual-entry paths (OTHER_MAKE, ALL_MODELS).
  const carMakeInput = str(o.car_make);
  const carModelInput = str(o.car_model);
  const carModelOther = str(o.car_model_other);
  let car_make: string;
  let car_model: string;
  if (carMakeInput === OTHER_MAKE) {
    if (!carModelOther) {
      return { ok: false, error: "Please enter your car make and model." };
    }
    car_make = OTHER_MAKE;
    car_model = carModelOther;
  } else {
    const makeEntry = config.car_options.find((c) => c.make === carMakeInput);
    if (!makeEntry) return { ok: false, error: "Please select your car make." };
    if (!makeEntry.models.includes(carModelInput)) {
      return { ok: false, error: "Please select your car model." };
    }
    car_make = makeEntry.make;
    car_model = carModelInput === ALL_MODELS ? carModelOther : carModelInput;
    if (!car_model) return { ok: false, error: "Please type your car model." };
  }

  if (config.passenger_enabled && typeof o.has_passenger !== "boolean") {
    return { ok: false, error: "Please tell us whether you have a passenger." };
  }
  const has_passenger = config.passenger_enabled && o.has_passenger === true;

  let passenger_first_name: string | null = null;
  let passenger_last_name: string | null = null;
  let passenger_shirt_size: string | null = null;
  let passenger_social: string | null = null;
  if (has_passenger) {
    const p = (typeof o.passenger === "object" && o.passenger !== null
      ? o.passenger
      : {}) as Record<string, unknown>;
    passenger_first_name = str(p.first_name);
    passenger_last_name = str(p.last_name);
    passenger_shirt_size = str(p.shirt_size);
    passenger_social = str(p.social) || null;
    if (!passenger_first_name || !passenger_last_name) {
      return { ok: false, error: "Passenger first and last name are required." };
    }
    if (!config.shirt_sizes.includes(passenger_shirt_size)) {
      return { ok: false, error: "Please select a t-shirt size for your passenger." };
    }
  }

  // Meals: one choice per person per configured section.
  const mealsInput = (typeof o.meals === "object" && o.meals !== null
    ? o.meals
    : {}) as Record<string, unknown>;
  const meals: Record<string, { driver: string; passenger?: string }> = {};
  for (const section of config.meals) {
    const choice = (typeof mealsInput[section.key] === "object" && mealsInput[section.key] !== null
      ? mealsInput[section.key]
      : {}) as Record<string, unknown>;
    const driver = str(choice.driver);
    if (!section.options.includes(driver)) {
      return { ok: false, error: `Please pick a ${section.label} option.` };
    }
    if (has_passenger) {
      const passenger = str(choice.passenger);
      if (!section.options.includes(passenger)) {
        return { ok: false, error: `Please pick a ${section.label} option for your passenger.` };
      }
      meals[section.key] = { driver, passenger };
    } else {
      meals[section.key] = { driver };
    }
  }

  // Add-ons: integer quantity 0..max_qty; unknown keys rejected.
  const addonsInput = (typeof o.addons === "object" && o.addons !== null
    ? o.addons
    : {}) as Record<string, unknown>;
  for (const key of Object.keys(addonsInput)) {
    if (!config.addons.some((a) => a.key === key)) {
      return { ok: false, error: "Unknown add-on selected." };
    }
  }
  const addons: Record<string, number> = {};
  const lineItems: LineItem[] = [
    { label: `${baseLabel} — Registration`, unit_amount_cents: basePriceCents, quantity: 1 },
  ];
  for (const addon of config.addons) {
    const rawQty = addonsInput[addon.key] ?? 0;
    if (!Number.isInteger(rawQty) || (rawQty as number) < 0 || (rawQty as number) > addon.max_qty) {
      return { ok: false, error: `Invalid quantity for ${addon.label}.` };
    }
    const qty = rawQty as number;
    if (qty > 0) {
      addons[addon.key] = qty;
      lineItems.push({ label: addon.label, unit_amount_cents: addon.price_cents, quantity: qty });
    }
  }

  if (o.waiver_accepted !== true) {
    return { ok: false, error: "You must accept the waiver to register." };
  }

  const totalCents = lineItems.reduce((sum, li) => sum + li.unit_amount_cents * li.quantity, 0);

  return {
    ok: true,
    value: {
      row: {
        first_name,
        last_name,
        email,
        phone,
        shirt_size,
        car_make,
        car_model,
        has_passenger,
        passenger_first_name: has_passenger ? passenger_first_name : null,
        passenger_last_name: has_passenger ? passenger_last_name : null,
        passenger_shirt_size: has_passenger ? passenger_shirt_size : null,
        answers: {
          instagram: str(o.instagram) || null,
          facebook: str(o.facebook) || null,
          passenger_social,
          meals,
          addons,
        },
      },
      lineItems,
      totalCents,
    },
  };
}
