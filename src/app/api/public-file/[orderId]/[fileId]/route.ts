import { NextRequest, NextResponse } from "next/server";
import { getOrder } from "@/lib/store";
import { verifyFile } from "@/lib/sign";
import { readOrderFile } from "@/lib/fileStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately public download endpoint for the print operator, by explicit
// choice — no passcode gate. Still requires a valid, short-lived signed token
// (minted by /api/public-queue) rather than a guessable path, and forces an
// actual download (not inline) since that's what a printer workflow needs.
export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string; fileId: string } }
) {
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyFile(params.orderId, params.fileId, token)) {
    return new NextResponse("Link expired", { status: 403 });
  }

  const order = await getOrder(params.orderId);
  const file = order?.files.find((f) => f.id === params.fileId);
  if (!order || !file || order.status === "deleted") {
    return new NextResponse("Gone", { status: 410 });
  }
  const data = await readOrderFile(file.storedPath);
  if (!data) {
    return new NextResponse("Gone", { status: 410 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
