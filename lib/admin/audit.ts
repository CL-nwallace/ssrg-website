import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuditAction = "create" | "update" | "delete" | "login";
export type AuditEntity = "event" | "media" | "auth";

export type LogAuditInput = {
  adminEmail: string;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string | null;
  snapshot?: unknown;
};

export async function logAudit(input: LogAuditInput): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    admin_email: input.adminEmail,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    snapshot: input.snapshot ?? null,
  });
  if (error) {
    // Audit failure should not block the user action; log to server console so
    // we can investigate. Swallow it intentionally.
    console.error("Failed to write audit log:", error.message, input);
  }
}
