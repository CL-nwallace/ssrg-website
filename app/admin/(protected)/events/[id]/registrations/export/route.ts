import { requireAdmin } from "@/lib/admin/require-admin";
import { fetchPaidRegistrations } from "@/lib/registration/admin-data";
import { registrationsToCsv } from "@/lib/registration/csv";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  await requireAdmin();

  const result = await fetchPaidRegistrations(params.id);
  if (!result) return new Response("Not found", { status: 404 });

  const csv = registrationsToCsv(result.registrations);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="registrations-${params.id}.csv"`,
    },
  });
}
