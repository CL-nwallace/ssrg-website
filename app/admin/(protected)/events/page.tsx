import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  event_date: string;
  price_cents: number;
  status: "draft" | "published";
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default async function AdminEventsPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, event_date, price_cents, status")
    .order("event_date", { ascending: true });
  const rows: Row[] = data ?? [];

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-serif">Events</h2>
        <Link
          href="/admin/events/new"
          className="rounded bg-black px-4 py-2 text-white text-sm"
        >
          New event
        </Link>
      </header>

      <table className="w-full text-sm">
        <thead className="border-b border-gray-200">
          <tr className="text-left">
            <th className="py-2">Title</th>
            <th className="py-2">Date</th>
            <th className="py-2">Price</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-100">
              <td className="py-3">{r.title}</td>
              <td className="py-3">{new Date(r.event_date).toLocaleDateString()}</td>
              <td className="py-3">{priceFormatter.format(r.price_cents / 100)}</td>
              <td className="py-3">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    r.status === "published"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {r.status}
                </span>
              </td>
              <td className="py-3 text-right space-x-3">
                <Link href={`/admin/events/${r.id}`} className="underline">
                  Edit
                </Link>
                <form action={`/admin/events/${r.id}/delete`} method="post" className="inline">
                  <button type="submit" className="text-red-700 underline">
                    Delete
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-8 text-center text-text-muted">
                No events yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
