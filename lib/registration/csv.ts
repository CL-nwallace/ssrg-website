import type { PaidRegistration } from "./admin-data";

function csvCell(v: string | number | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralize spreadsheet formula injection: registrant free-text (names,
  // socials, car model) reaches this CSV, and a leading =/+/-/@ becomes a live
  // formula when an admin opens the export in Excel/Sheets. Prefix with a quote.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADER = [
  "Registered at",
  "First name",
  "Last name",
  "Email",
  "Phone",
  "Shirt size",
  "Car make",
  "Car model",
  "Has passenger",
  "Passenger first name",
  "Passenger last name",
  "Passenger shirt size",
  "Instagram",
  "Facebook",
  "Passenger social",
  "Meals",
  "Add-ons",
  "Amount paid (USD)",
];

export function registrationsToCsv(rows: PaidRegistration[]): string {
  const lines = [HEADER.map(csvCell).join(",")];
  for (const r of rows) {
    const meals = Object.entries(r.answers?.meals ?? {})
      .map(([k, v]) => `${k}: ${v.driver ?? ""}${v.passenger ? " / " + v.passenger : ""}`)
      .join(" | ");
    const addons = Object.entries(r.answers?.addons ?? {})
      .map(([k, qty]) => `${k} x${qty}`)
      .join(" | ");
    lines.push(
      [
        r.created_at,
        r.first_name,
        r.last_name,
        r.email,
        r.phone,
        r.shirt_size,
        r.car_make,
        r.car_model,
        r.has_passenger ? "yes" : "no",
        r.passenger_first_name,
        r.passenger_last_name,
        r.passenger_shirt_size,
        r.answers?.instagram ?? "",
        r.answers?.facebook ?? "",
        r.answers?.passenger_social ?? "",
        meals,
        addons,
        r.amount_paid_cents === null ? "" : (r.amount_paid_cents / 100).toFixed(2),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n") + "\n";
}
