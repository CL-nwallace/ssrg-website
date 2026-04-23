"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAudit } from "@/lib/admin/audit";

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
