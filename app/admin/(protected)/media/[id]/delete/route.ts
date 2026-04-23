import { type NextRequest } from "next/server";
import { deleteMedia } from "../../actions";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await deleteMedia(params.id);
}
