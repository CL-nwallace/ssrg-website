"use client";

import { useMemo, useState } from "react";
import {
  type RegistrationConfig,
  ALL_MODELS,
  OTHER_MAKE,
} from "@/lib/registration/config";

type Props = {
  eventId: string;
  basePriceCents: number;
  config: RegistrationConfig;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function dollars(cents: number): string {
  return usd.format(cents / 100);
}

const inputClass =
  "mt-1 w-full rounded border border-subtle bg-bg-elevated px-3 py-2 text-text-primary";
const labelClass = "block text-small text-text-secondary";
const headingClass = "font-serif text-large text-text-primary";

export default function RegistrationForm({ eventId, basePriceCents, config }: Props) {
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [hasPassenger, setHasPassenger] = useState(false);
  const [addonQty, setAddonQty] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const makeEntry = config.car_options.find((c) => c.make === carMake);
  const needsManualModel = carMake === OTHER_MAKE || carModel === ALL_MODELS;

  const totalCents = useMemo(
    () =>
      basePriceCents +
      config.addons.reduce((sum, a) => sum + (addonQty[a.key] ?? 0) * a.price_cents, 0),
    [basePriceCents, config.addons, addonQty],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = new FormData(e.currentTarget);

    const meals: Record<string, { driver: string; passenger?: string }> = {};
    for (const meal of config.meals) {
      meals[meal.key] = {
        driver: String(form.get(`meal_${meal.key}_driver`) ?? ""),
        ...(hasPassenger
          ? { passenger: String(form.get(`meal_${meal.key}_passenger`) ?? "") }
          : {}),
      };
    }

    const body = {
      event_id: eventId,
      first_name: String(form.get("first_name") ?? ""),
      last_name: String(form.get("last_name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      shirt_size: String(form.get("shirt_size") ?? ""),
      instagram: String(form.get("instagram") ?? ""),
      facebook: String(form.get("facebook") ?? ""),
      car_make: carMake,
      car_model: carModel,
      car_model_other: String(form.get("car_model_other") ?? ""),
      has_passenger: hasPassenger,
      passenger: hasPassenger
        ? {
            first_name: String(form.get("passenger_first_name") ?? ""),
            last_name: String(form.get("passenger_last_name") ?? ""),
            shirt_size: String(form.get("passenger_shirt_size") ?? ""),
            social: String(form.get("passenger_social") ?? ""),
          }
        : undefined,
      meals,
      addons: addonQty,
      waiver_accepted: form.get("waiver_accepted") === "on",
    };

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.ok && data.url) {
      window.location.assign(data.url);
      return;
    }
    setError(data.error ?? "Something went wrong. Please try again.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10" data-testid="registration-form">
      <section className="space-y-4">
        <h2 className={headingClass}>Driver</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            First name *
            <input name="first_name" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Last name *
            <input name="last_name" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Email *
            <input name="email" type="email" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Phone
            <input name="phone" type="tel" className={inputClass} />
          </label>
          <label className={labelClass}>
            T-shirt size *
            <select name="shirt_size" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                — Select size —
              </option>
              {config.shirt_sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Instagram username
            <input name="instagram" className={inputClass} />
          </label>
          <label className={labelClass}>
            Facebook username
            <input name="facebook" className={inputClass} />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className={headingClass}>Your car</h2>
        <p className="text-small text-text-muted">
          If you don&apos;t see your car make/model here, message us!
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className={labelClass}>
            Car make *
            <select
              required
              value={carMake}
              onChange={(e) => {
                setCarMake(e.target.value);
                setCarModel("");
              }}
              className={inputClass}
              aria-label="Car make *"
            >
              <option value="" disabled>
                — Select make —
              </option>
              {config.car_options.map((c) => (
                <option key={c.make} value={c.make}>
                  {c.make}
                </option>
              ))}
              <option value={OTHER_MAKE}>{OTHER_MAKE}</option>
            </select>
          </label>
          {makeEntry ? (
            <label className={labelClass}>
              Car model *
              <select
                required
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                className={inputClass}
                aria-label="Car model *"
              >
                <option value="" disabled>
                  — Select model —
                </option>
                {makeEntry.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {needsManualModel ? (
            <label className={labelClass}>
              {carMake === OTHER_MAKE ? "Your car make & model *" : "Your model *"}
              <input name="car_model_other" required className={inputClass} />
            </label>
          ) : null}
        </div>
      </section>

      {config.passenger_enabled ? (
        <section className="space-y-4">
          <h2 className={headingClass}>Passenger</h2>
          <label className="flex items-center gap-2 text-small text-text-secondary">
            <input
              type="checkbox"
              checked={hasPassenger}
              onChange={(e) => setHasPassenger(e.target.checked)}
            />
            I have a passenger
          </label>
          {hasPassenger ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Passenger first name *
                <input name="passenger_first_name" required className={inputClass} />
              </label>
              <label className={labelClass}>
                Passenger last name *
                <input name="passenger_last_name" required className={inputClass} />
              </label>
              <label className={labelClass}>
                Passenger t-shirt size *
                <select
                  name="passenger_shirt_size"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    — Select size —
                  </option>
                  {config.shirt_sizes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Passenger Instagram/Facebook
                <input name="passenger_social" className={inputClass} />
              </label>
            </div>
          ) : null}
        </section>
      ) : null}

      {config.meals.length > 0 ? (
        <section className="space-y-4">
          <h2 className={headingClass}>Meals (included)</h2>
          {config.meals.map((meal) => (
            <div key={meal.key} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className={labelClass}>
                {meal.label} — your meal *
                <select
                  name={`meal_${meal.key}_driver`}
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    — Select meal —
                  </option>
                  {meal.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {meal.note ? (
                  <span className="mt-1 block text-small text-text-muted">{meal.note}</span>
                ) : null}
              </label>
              {hasPassenger ? (
                <label className={labelClass}>
                  {meal.label} — passenger meal *
                  <select
                    name={`meal_${meal.key}_passenger`}
                    required
                    defaultValue=""
                    className={inputClass}
                  >
                    <option value="" disabled>
                      — Select meal —
                    </option>
                    {meal.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {config.addons.length > 0 ? (
        <section className="space-y-4">
          <h2 className={headingClass}>Optional add-ons</h2>
          {config.addons.map((addon) => (
            <label key={addon.key} className={labelClass}>
              {addon.label} ({dollars(addon.price_cents)}/person)
              <select
                value={addonQty[addon.key] ?? 0}
                onChange={(e) =>
                  setAddonQty({ ...addonQty, [addon.key]: Number(e.target.value) })
                }
                className={inputClass}
              >
                {Array.from({ length: addon.max_qty }, (_, i) => addon.max_qty - i).map(
                  (q) => (
                    <option key={q} value={q}>
                      {q} × {addon.label} — {dollars(q * addon.price_cents)}
                    </option>
                  ),
                )}
                <option value={0}>No {addon.label}</option>
              </select>
            </label>
          ))}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className={headingClass}>Waiver</h2>
        <div className="max-h-48 overflow-y-auto rounded border border-subtle p-4 text-small text-text-secondary whitespace-pre-wrap">
          {config.waiver_text}
        </div>
        <label className="flex items-start gap-2 text-small text-text-secondary">
          <input type="checkbox" name="waiver_accepted" required className="mt-1" />
          I have read and accept the waiver *
        </label>
      </section>

      <section className="space-y-2 rounded border border-subtle p-4" data-testid="order-summary">
        <h2 className={headingClass}>Summary</h2>
        <p className="flex justify-between text-small text-text-secondary">
          <span>Registration (per car)</span>
          <span>{dollars(basePriceCents)}</span>
        </p>
        {config.addons.map((addon) => {
          const qty = addonQty[addon.key] ?? 0;
          if (qty === 0) return null;
          return (
            <p key={addon.key} className="flex justify-between text-small text-text-secondary">
              <span>
                {addon.label} × {qty}
              </span>
              <span>{dollars(qty * addon.price_cents)}</span>
            </p>
          );
        })}
        <p className="flex justify-between text-body font-semibold text-gold">
          <span>Total</span>
          <span>{dollars(totalCents)}</span>
        </p>
      </section>

      {error ? (
        <p role="alert" className="rounded bg-red-950/60 px-4 py-3 text-small text-red-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-block px-6 py-3 bg-gold text-bg-deep font-semibold text-small rounded hover:bg-gold-light transition-colors cursor-pointer disabled:opacity-50"
      >
        {submitting ? "Redirecting…" : `Continue to payment — ${dollars(totalCents)}`}
      </button>
    </form>
  );
}
