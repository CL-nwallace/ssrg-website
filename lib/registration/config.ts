export type MealSection = {
  key: string;
  label: string;
  note: string;
  options: string[];
};

export type Addon = {
  key: string;
  label: string;
  price_cents: number;
  max_qty: number;
};

export type CarOption = { make: string; models: string[] };

export type RegistrationConfig = {
  meals: MealSection[];
  addons: Addon[];
  car_options: CarOption[];
  shirt_sizes: string[];
  passenger_enabled: boolean;
  waiver_text: string;
};

/** Model entry whose selection requires the registrant to type their model. */
export const ALL_MODELS = "All models";
/** Make choice (always appended in the UI) for cars not in the list. */
export const OTHER_MAKE = "Other / not listed";

export const MONTEREY_TEMPLATE: RegistrationConfig = {
  meals: [
    {
      key: "thursday_lunch",
      label: "Thursday Lunch",
      note: "Message us if you have dietary restrictions.",
      options: [
        "Fish & Chips",
        "Cheese Burger",
        "Burger (no cheese)",
        "Caesar Salad",
        "Pork Taco",
      ],
    },
  ],
  addons: [
    { key: "thursday_dinner", label: "Thursday Dinner", price_cents: 19900, max_qty: 2 },
  ],
  car_options: [
    { make: "Aston Martin", models: [ALL_MODELS] },
    { make: "Audi", models: ["R8"] },
    { make: "Bugatti", models: [ALL_MODELS] },
    { make: "Chevrolet", models: ["C8 Z06", "C8 ZR1"] },
    { make: "Ferrari", models: [ALL_MODELS] },
    { make: "Koenigsegg", models: [ALL_MODELS] },
    { make: "Lamborghini", models: [ALL_MODELS] },
    { make: "Lotus", models: [ALL_MODELS] },
    { make: "McLaren", models: [ALL_MODELS] },
    { make: "Mercedes Benz", models: ["AMG GTR/GTS/GTC", "AMG McLaren"] },
    { make: "Pagani", models: [ALL_MODELS] },
    {
      make: "Porsche",
      models: [
        "718 GTS/GT4/GT4RS",
        "991.1/991.2",
        "GT3/3RS/Turbo/Turbo S/GTS",
        "All 992 models",
        "918",
      ],
    },
  ],
  shirt_sizes: ["XS", "SML", "MED", "LRG", "XL", "XXL", "3XL"],
  passenger_enabled: true,
  waiver_text:
    "PLACEHOLDER WAIVER — final liability text pending from the club. By checking the box you acknowledge that motorsport and group-drive activities carry inherent risk and you release SSRG, its organizers, and venues from liability for injury or property damage arising from participation.",
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.length > 0 && v.every(isNonEmptyString);
}

/**
 * Strict structural validation. Returns null on any problem — callers decide
 * whether that means "reject the save" (admin) or "fall back" (public read).
 */
export function parseRegistrationConfig(raw: unknown): RegistrationConfig | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.meals)) return null;
  const meals: MealSection[] = [];
  for (const m of o.meals) {
    if (typeof m !== "object" || m === null) return null;
    const mm = m as Record<string, unknown>;
    if (!isNonEmptyString(mm.key) || !isNonEmptyString(mm.label) || !isStringArray(mm.options)) {
      return null;
    }
    meals.push({
      key: mm.key,
      label: mm.label,
      note: typeof mm.note === "string" ? mm.note : "",
      options: mm.options,
    });
  }

  if (!Array.isArray(o.addons)) return null;
  const addons: Addon[] = [];
  for (const a of o.addons) {
    if (typeof a !== "object" || a === null) return null;
    const aa = a as Record<string, unknown>;
    if (!isNonEmptyString(aa.key) || !isNonEmptyString(aa.label)) return null;
    if (!Number.isInteger(aa.price_cents) || (aa.price_cents as number) < 0) return null;
    if (!Number.isInteger(aa.max_qty) || (aa.max_qty as number) < 1) return null;
    addons.push({
      key: aa.key,
      label: aa.label,
      price_cents: aa.price_cents as number,
      max_qty: aa.max_qty as number,
    });
  }

  if (!Array.isArray(o.car_options) || o.car_options.length === 0) return null;
  const car_options: CarOption[] = [];
  for (const c of o.car_options) {
    if (typeof c !== "object" || c === null) return null;
    const cc = c as Record<string, unknown>;
    if (!isNonEmptyString(cc.make) || !isStringArray(cc.models)) return null;
    car_options.push({ make: cc.make, models: cc.models });
  }

  if (!isStringArray(o.shirt_sizes)) return null;
  if (typeof o.passenger_enabled !== "boolean") return null;
  if (!isNonEmptyString(o.waiver_text)) return null;

  // Duplicate keys would make `answers` ambiguous.
  const keys = [...meals.map((m) => m.key), ...addons.map((a) => a.key)];
  if (new Set(keys).size !== keys.length) return null;

  return {
    meals,
    addons,
    car_options,
    shirt_sizes: o.shirt_sizes,
    passenger_enabled: o.passenger_enabled,
    waiver_text: o.waiver_text,
  };
}

/**
 * Events saved before this feature (or with a corrupted config) fall back to
 * the Monterey template — it is "the standard" per the spec.
 */
export function effectiveConfig(raw: unknown): RegistrationConfig {
  return parseRegistrationConfig(raw) ?? MONTEREY_TEMPLATE;
}
