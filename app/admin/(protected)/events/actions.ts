"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAudit } from "@/lib/admin/audit";
import { validateImage, uuidFilename } from "@/lib/admin/uploads";
import {
  parseRegistrationConfig,
  type RegistrationConfig,
} from "@/lib/registration/config";

type ActionResult = { ok: true } | { ok: false; error: string };

function parseRegistrationFields(formData: FormData):
  | { ok: true; deadline: string | null; config: RegistrationConfig }
  | { ok: false; error: string } {
  const deadlineRaw = String(formData.get("registration_deadline") ?? "").trim();
  const deadline = deadlineRaw || null;

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(String(formData.get("registration_config") ?? ""));
  } catch {
    return { ok: false, error: "Registration settings are malformed." };
  }
  const config = parseRegistrationConfig(parsedJson);
  if (!config) {
    return {
      ok: false,
      error:
        "Registration settings are invalid — check that prices are not negative, every list has at least one option, and the waiver text is not empty.",
    };
  }
  return { ok: true, deadline, config };
}

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

  const reg = parseRegistrationFields(formData);
  if (!reg.ok) return { ok: false, error: reg.error };

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
      registration_deadline: reg.deadline,
      registration_config: reg.config,
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

export async function updateEvent(
  id: string,
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

  const reg = parseRegistrationFields(formData);
  if (!reg.ok) return { ok: false, error: reg.error };

  const patch: Record<string, unknown> = {
    title,
    event_date: eventDate,
    price_cents: priceCents,
    description_html: descriptionHtml,
    status,
    registration_deadline: reg.deadline,
    registration_config: reg.config,
  };

  const coverFile = formData.get("cover_image") as File | null;
  if (coverFile && coverFile.size > 0) {
    const validated = validateImage(coverFile);
    if ("error" in validated) return { ok: false, error: validated.error };
    const path = `${id}/${uuidFilename(validated.extension)}`;
    const { error: uploadError } = await supabase.storage
      .from("event-covers")
      .upload(path, validated.file, { contentType: validated.file.type });
    if (uploadError) return { ok: false, error: uploadError.message };
    patch.cover_image_path = path;
  }

  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: email,
    action: "update",
    entityType: "event",
    entityId: id,
    snapshot: data,
  });

  revalidatePath("/events");
  revalidatePath("/admin/events");
  redirect("/admin/events");
}

export async function deleteEvent(id: string): Promise<void> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    adminEmail: email,
    action: "delete",
    entityType: "event",
    entityId: id,
    snapshot: existing ?? null,
  });

  revalidatePath("/events");
  revalidatePath("/admin/events");
  redirect("/admin/events");
}
