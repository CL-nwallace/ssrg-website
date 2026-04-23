import { createSupabaseServerClient } from "@/lib/supabase/server";
import UploadForm from "./UploadForm";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  { slug: "drives_rallies", label: "Drives / Rallies" },
  { slug: "track", label: "Track Events" },
  { slug: "private_parties", label: "Private Parties" },
  { slug: "coffee_runs", label: "Coffee Runs" },
] as const;

type Row = { id: string; category: string; storage_path: string; created_at: string };

export default async function AdminMediaPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("media")
    .select("id, category, storage_path, created_at")
    .order("created_at", { ascending: false });
  const rows: Row[] = data ?? [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  return (
    <div className="space-y-10">
      <h2 className="text-3xl font-serif">Media</h2>

      {CATEGORIES.map((cat) => {
        const items = rows.filter((r) => r.category === cat.slug);
        return (
          <section key={cat.slug}>
            <h3 className="text-xl font-medium mb-3">{cat.label}</h3>
            <UploadForm category={cat.slug} />
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {items.map((row) => {
                const src = `${supabaseUrl}/storage/v1/object/public/media/${row.storage_path}`;
                return (
                  <div key={row.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-32 w-full rounded object-cover" />
                    <form
                      action={`/admin/media/${row.id}/delete`}
                      method="post"
                      className="absolute top-1 right-1"
                    >
                      <button
                        type="submit"
                        className="rounded bg-black/70 px-2 py-0.5 text-xs text-white"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="col-span-full text-sm text-text-muted">
                  No media in this category yet.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
