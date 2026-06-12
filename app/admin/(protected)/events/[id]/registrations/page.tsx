import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchPaidRegistrations,
  type PaidRegistration,
} from "@/lib/registration/admin-data";

export const dynamic = "force-dynamic";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function tally(
  rows: PaidRegistration[],
  pick: (r: PaidRegistration) => (string | null | undefined)[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const v of pick(r)) {
      if (!v) continue;
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return counts;
}

export default async function RegistrationsPage({
  params,
}: {
  params: { id: string };
}) {
  const result = await fetchPaidRegistrations(params.id);
  if (!result) notFound();
  const { event, registrations } = result;

  const shirts = tally(registrations, (r) => [r.shirt_size, r.passenger_shirt_size]);

  const mealCounts = new Map<string, Map<string, number>>();
  for (const r of registrations) {
    for (const [meal, choice] of Object.entries(r.answers?.meals ?? {})) {
      const inner = mealCounts.get(meal) ?? new Map<string, number>();
      for (const v of [choice.driver, choice.passenger]) {
        if (v) inner.set(v, (inner.get(v) ?? 0) + 1);
      }
      mealCounts.set(meal, inner);
    }
  }

  const addonCounts = new Map<string, number>();
  for (const r of registrations) {
    for (const [k, qty] of Object.entries(r.answers?.addons ?? {})) {
      addonCounts.set(k, (addonCounts.get(k) ?? 0) + qty);
    }
  }

  const revenueCents = registrations.reduce(
    (sum, r) => sum + (r.amount_paid_cents ?? 0),
    0,
  );

  return (
    <div>
      <header className="mb-6 flex items-center justify-between">
        <h2 className="text-3xl font-serif">Registrations — {event.title}</h2>
        <a
          href={`/admin/events/${event.id}/registrations/export`}
          className="rounded bg-black px-4 py-2 text-sm text-white"
          data-testid="export-csv"
        >
          Export CSV
        </a>
      </header>

      <section
        className="mb-8 grid grid-cols-2 gap-6 text-sm md:grid-cols-4"
        data-testid="registration-summary"
      >
        <div>
          <h3 className="mb-1 font-semibold">Totals</h3>
          <p>{registrations.length} cars</p>
          <p>{usd.format(revenueCents / 100)} collected</p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Shirts</h3>
          {Array.from(shirts).map(([size, n]) => (
            <p key={size}>
              {size}: {n}
            </p>
          ))}
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Meals</h3>
          {Array.from(mealCounts).map(([meal, inner]) => (
            <div key={meal} className="mb-2">
              <p className="italic">{meal}</p>
              {Array.from(inner).map(([opt, n]) => (
                <p key={opt}>
                  {opt}: {n}
                </p>
              ))}
            </div>
          ))}
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Add-ons</h3>
          {Array.from(addonCounts).map(([k, n]) => (
            <p key={k}>
              {k}: {n}
            </p>
          ))}
        </div>
      </section>

      <table className="w-full text-sm" data-testid="registrations-table">
        <thead className="border-b border-gray-200">
          <tr className="text-left">
            <th className="py-2">Name</th>
            <th className="py-2">Email / phone</th>
            <th className="py-2">Car</th>
            <th className="py-2">Shirts</th>
            <th className="py-2">Passenger</th>
            <th className="py-2">Add-ons</th>
            <th className="py-2">Paid</th>
            <th className="py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {registrations.map((r) => (
            <tr key={r.id} className="border-b border-gray-100 align-top">
              <td className="py-3">
                {r.first_name} {r.last_name}
              </td>
              <td className="py-3">
                {r.email}
                {r.phone ? <span className="block text-gray-500">{r.phone}</span> : null}
              </td>
              <td className="py-3">
                {r.car_make} {r.car_model}
              </td>
              <td className="py-3">
                {r.shirt_size}
                {r.passenger_shirt_size ? ` / ${r.passenger_shirt_size}` : ""}
              </td>
              <td className="py-3">
                {r.has_passenger
                  ? `${r.passenger_first_name} ${r.passenger_last_name}`
                  : "—"}
              </td>
              <td className="py-3">
                {Object.entries(r.answers?.addons ?? {})
                  .map(([k, qty]) => `${k} ×${qty}`)
                  .join(", ") || "—"}
              </td>
              <td className="py-3">
                {r.amount_paid_cents !== null
                  ? usd.format(r.amount_paid_cents / 100)
                  : "—"}
              </td>
              <td className="py-3">{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
          {registrations.length === 0 && (
            <tr>
              <td colSpan={8} className="py-8 text-center text-gray-500">
                No paid registrations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="mt-6">
        <Link href="/admin/events" className="underline">
          Back to events
        </Link>
      </p>
    </div>
  );
}
