"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAudit } from "@/lib/admin/audit";
import { validateImage, uuidFilename } from "@/lib/admin/uploads";

type ActionResult = { ok: true } | { ok: false; error: string };

const VALID_CATEGORIES = new Set([
  "drives_rallies",
  "track",
  "private_parties",
  "coffee_runs",
]);

export async function uploadMedia(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const category = String(formData.get("category") ?? "");
  if (!VALID_CATEGORIES.has(category)) {
    return { ok: false, error: "Invalid category." };
  }

  const file = formData.get("file") as File | null;
  const validated = validateImage(file);
  if ("error" in validated) return { ok: false, error: validated.error };

  const path = `${category}/${uuidFilename(validated.extension)}`;
  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(path, validated.file, { contentType: validated.file.type });
  if (uploadError) return { ok: false, error: uploadError.message };

  const { data, error } = await supabase
    .from("media")
    .insert({ category, storage_path: path })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    adminEmail: email,
    action: "create",
    entityType: "media",
    entityId: data.id,
    snapshot: data,
  });

  revalidatePath("/media");
  revalidatePath("/admin/media");
  redirect("/admin/media");
}

export async function deleteMedia(id: string): Promise<void> {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("media")
    .select("*")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logAudit({
    adminEmail: email,
    action: "delete",
    entityType: "media",
    entityId: id,
    snapshot: existing ?? null,
  });

  revalidatePath("/media");
  revalidatePath("/admin/media");
  redirect("/admin/media");
}
