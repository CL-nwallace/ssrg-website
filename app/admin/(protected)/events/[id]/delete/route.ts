import { type NextRequest } from "next/server";
import { deleteEvent } from "../../actions";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await deleteEvent(params.id); // throws NEXT_REDIRECT on success; Next handles it
  // unreachable
}
