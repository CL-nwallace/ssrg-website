import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import EditEventForm from "./EditEventForm";

export const dynamic = "force-dynamic";

export default async function EditEventPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, event_date, price_cents, description_html, cover_image_path, status")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const coverUrl = data.cover_image_path
    ? `${supabaseUrl}/storage/v1/object/public/event-covers/${data.cover_image_path}`
    : null;

  return (
    <div className="max-w-2xl">
      <h2 className="text-3xl font-serif mb-6">Edit event</h2>
      <EditEventForm event={{ ...data, coverUrl }} />
    </div>
  );
}
