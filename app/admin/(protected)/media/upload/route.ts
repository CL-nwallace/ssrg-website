import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAudit } from "@/lib/admin/audit";
import { validateImage, uuidFilename } from "@/lib/admin/uploads";

const VALID_CATEGORIES = new Set([
  "drives_rallies",
  "track",
  "private_parties",
  "coffee_runs",
]);

export async function POST(req: NextRequest) {
  const { email } = await requireAdmin();
  const supabase = createSupabaseServerClient();

  const formData = await req.formData();
  const category = String(formData.get("category") ?? "");

  if (!VALID_CATEGORIES.has(category)) {
    redirect("/admin/media?error=Invalid+category");
  }

  const file = formData.get("file") as File | null;
  const validated = validateImage(file);
  if ("error" in validated) {
    redirect(`/admin/media?error=${encodeURIComponent(validated.error)}`);
  }

  const storagePath = `${category}/${uuidFilename(validated.extension)}`;
  const { error: uploadError } = await supabase.storage
    .from("media")
    .upload(storagePath, validated.file, { contentType: validated.file.type });

  if (uploadError) {
    redirect(`/admin/media?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { data, error } = await supabase
    .from("media")
    .insert({ category, storage_path: storagePath })
    .select("*")
    .single();

  if (error) {
    redirect(`/admin/media?error=${encodeURIComponent(error.message)}`);
  }

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
