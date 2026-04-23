import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  admin_email: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  snapshot: unknown;
  created_at: string;
};

export default async function AuditPage() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, admin_email, action, entity_type, entity_id, snapshot, created_at")
    .order("seq", { ascending: false })
    .limit(200);
  const rows: Row[] = data ?? [];

  return (
    <div>
      <h2 className="text-3xl font-serif mb-6">Audit log</h2>
      <p className="text-sm text-text-muted mb-4">
        Showing the most recent 200 entries, newest first.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <details
            key={r.id}
            data-testid="audit-row"
            className="rounded border border-gray-200 p-3 text-sm"
          >
            <summary className="cursor-pointer">
              <span className="font-mono text-xs text-text-muted">
                {new Date(r.created_at).toLocaleString()}
              </span>{" "}
              — {r.admin_email} — <strong>{r.action}</strong> {r.entity_type}
              {r.entity_id ? ` (${r.entity_id.slice(0, 8)}…)` : ""}
            </summary>
            <pre className="mt-3 overflow-x-auto rounded bg-gray-50 p-3 text-xs">
              {JSON.stringify(r.snapshot, null, 2)}
            </pre>
          </details>
        ))}
        {rows.length === 0 && (
          <p className="text-text-muted">No audit entries yet.</p>
        )}
      </div>
    </div>
  );
}
