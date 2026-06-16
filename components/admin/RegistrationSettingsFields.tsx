"use client";

import { useState } from "react";
import type { CarOption, RegistrationConfig } from "@/lib/registration/config";

type Props = {
  initialConfig: RegistrationConfig;
  /** datetime-local format ("YYYY-MM-DDTHH:mm") or null */
  initialDeadline: string | null;
};

function carsToText(cars: CarOption[]): string {
  return cars.map((c) => `${c.make}: ${c.models.join(", ")}`).join("\n");
}

function textToCars(text: string): CarOption[] {
  return text
    .split("\n")
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { make: line.trim(), models: [] };
      return {
        make: line.slice(0, idx).trim(),
        models: line
          .slice(idx + 1)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    })
    .filter((c) => c.make.length > 0);
}

const fieldClass = "mt-1 w-full rounded border border-gray-300 px-3 py-2";

export default function RegistrationSettingsFields({
  initialConfig,
  initialDeadline,
}: Props) {
  const [meals, setMeals] = useState(
    initialConfig.meals.map((m) => ({ ...m, optionsText: m.options.join(", ") })),
  );
  const [addons, setAddons] = useState(
    initialConfig.addons.map((a) => ({
      ...a,
      priceDollars: (a.price_cents / 100).toFixed(2),
    })),
  );
  const [carsText, setCarsText] = useState(carsToText(initialConfig.car_options));
  const [sizesText, setSizesText] = useState(initialConfig.shirt_sizes.join(", "));
  const [passengerEnabled, setPassengerEnabled] = useState(
    initialConfig.passenger_enabled,
  );
  const [waiverText, setWaiverText] = useState(initialConfig.waiver_text);

  // Serialized on every render; the server action re-validates with
  // parseRegistrationConfig before saving.
  const config: RegistrationConfig = {
    meals: meals.map((m) => ({
      key: m.key,
      label: m.label,
      note: m.note,
      options: m.optionsText.split(",").map((s) => s.trim()).filter(Boolean),
    })),
    addons: addons.map((a) => ({
      key: a.key,
      label: a.label,
      price_cents: Math.round(Number(a.priceDollars) * 100),
      max_qty: a.max_qty,
    })),
    car_options: textToCars(carsText),
    shirt_sizes: sizesText.split(",").map((s) => s.trim()).filter(Boolean),
    dietary_options: initialConfig.dietary_options,
    passenger_enabled: passengerEnabled,
    waiver_text: waiverText,
  };

  return (
    <fieldset className="space-y-4 rounded border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold">Registration settings</legend>
      <input type="hidden" name="registration_config" value={JSON.stringify(config)} />

      <label className="block">
        <span className="text-sm font-medium">Registration deadline (optional)</span>
        <input
          name="registration_deadline"
          type="datetime-local"
          defaultValue={initialDeadline ?? ""}
          className={fieldClass}
        />
      </label>

      <div className="space-y-3">
        <span className="text-sm font-medium">Meal choices (included in base price)</span>
        {meals.map((m, i) => (
          <div key={m.key} className="space-y-2 rounded border border-gray-200 p-3">
            <label className="block">
              <span className="text-xs text-gray-600">Meal label</span>
              <input
                value={m.label}
                onChange={(e) =>
                  setMeals(meals.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Options (comma-separated)</span>
              <input
                value={m.optionsText}
                onChange={(e) =>
                  setMeals(
                    meals.map((x, j) => (j === i ? { ...x, optionsText: e.target.value } : x)),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Note (shown under the dropdown)</span>
              <input
                value={m.note}
                onChange={(e) =>
                  setMeals(meals.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))
                }
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={() => setMeals(meals.filter((_, j) => j !== i))}
              className="text-xs text-red-700 underline"
            >
              Remove meal
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setMeals([
              ...meals,
              {
                key: `meal_${Date.now()}`,
                label: "New meal",
                note: "",
                options: [],
                optionsText: "",
              },
            ])
          }
          className="text-sm underline"
        >
          + Add meal
        </button>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-medium">Paid add-ons (per person)</span>
        {addons.map((a, i) => (
          <div key={a.key} className="space-y-2 rounded border border-gray-200 p-3">
            <label className="block">
              <span className="text-xs text-gray-600">Add-on label</span>
              <input
                value={a.label}
                onChange={(e) =>
                  setAddons(
                    addons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Per-person cost (USD)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={a.priceDollars}
                onChange={(e) =>
                  setAddons(
                    addons.map((x, j) =>
                      j === i ? { ...x, priceDollars: e.target.value } : x,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-xs text-gray-600">Max quantity</span>
              <input
                type="number"
                min="1"
                step="1"
                value={a.max_qty}
                onChange={(e) =>
                  setAddons(
                    addons.map((x, j) =>
                      j === i ? { ...x, max_qty: Number(e.target.value) } : x,
                    ),
                  )
                }
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={() => setAddons(addons.filter((_, j) => j !== i))}
              className="text-xs text-red-700 underline"
            >
              Remove add-on
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setAddons([
              ...addons,
              {
                key: `addon_${Date.now()}`,
                label: "New add-on",
                price_cents: 0,
                max_qty: 1,
                priceDollars: "0.00",
              },
            ])
          }
          className="text-sm underline"
        >
          + Add add-on
        </button>
      </div>

      <label className="block">
        <span className="text-sm font-medium">
          Car list (one make per line — &quot;Make: model, model&quot;)
        </span>
        <textarea
          value={carsText}
          onChange={(e) => setCarsText(e.target.value)}
          rows={10}
          className={fieldClass}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Shirt sizes (comma-separated)</span>
        <input
          value={sizesText}
          onChange={(e) => setSizesText(e.target.value)}
          className={fieldClass}
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={passengerEnabled}
          onChange={(e) => setPassengerEnabled(e.target.checked)}
        />
        <span className="text-sm font-medium">Allow a passenger</span>
      </label>

      <label className="block">
        <span className="text-sm font-medium">Waiver text</span>
        <textarea
          value={waiverText}
          onChange={(e) => setWaiverText(e.target.value)}
          rows={6}
          className={fieldClass}
        />
      </label>
    </fieldset>
  );
}
