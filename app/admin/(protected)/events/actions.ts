"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAudit } from "@/lib/admin/audit";
import { validateImage, uuidFilename } from "@/lib/admin/uploads";

type ActionResult = { ok: true } | { ok: false; error: string };

function parsePriceCents(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function createEvent(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const title = String(formData.get("title") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim();
  const priceCents = parsePriceCents(formData.get("price_dollars"));
  const descriptionHtml = String(formData.get("description_html") ?? "");
  const status = formData.get("status") === "published" ? "published" : "draft";

  if (!title) return { ok: false, error: "Title is required." };
  if (!eventDate) return { ok: false, error: "Event date is required." };
  if (priceCents === null) return { ok: false, error: "Price is required." };

  // Optional cover
  let coverImagePath: string | null = null;
  const coverFile = formData.get("cover_image") as File | null;
  if (coverFile && coverFile.size > 0) {
    const validated = validateImage(coverFile);
    if ("error" in validated) return { ok: false, error: validated.error };

    const storagePath = `pending/${uuidFilename(validated.extension)}`;
    const { error: uploadError } = await supabase.storage
      .from("event-covers")
      .upload(storagePath, validated.file, { contentType: validated.file.type });
    if (uploadError) return { ok: false, error: uploadError.message };
    coverImagePath = storagePath;
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      title,
      event_date: eventDate,
      price_cents: priceCents,
      description_html: descriptionHtml,
      status,
      cover_image_path: coverImagePath,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: email,
    action: "create",
    entityType: "event",
    entityId: data.id,
    snapshot: data,
  });

  revalidatePath("/events");
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
