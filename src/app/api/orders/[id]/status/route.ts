import { NextRequest, NextResponse } from "next/server";
import { getOrder, updateOrder } from "@/lib/store";
import { publish } from "@/lib/bus";
import type { OrderStatus } from "@/lib/types";

export const runtime = "nodejs";

// Deliberately public (no passcode) by explicit choice: the same status
// buttons (Print/Ready/Cancel) are exposed on the unauthenticated kiosk
// queue at /s/[shopId], not just the operator dashboard.
const ALLOWED: OrderStatus[] = ["waiting", "printing", "ready", "cancelled"];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { status } = await req.json().catch(() => ({ status: "" }));
  if (!ALLOWED.includes(status)) {
    return NextResponse.json({ error: "Bad status" }, { status: 400 });
  }
  const existing = await getOrder(params.id);
  if (!existing || existing.status === "deleted") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Stamp printedAt the first time it starts printing — this begins the 15-min
  // retention countdown.
  const patch: any = { status };
  if (status === "printing" && !existing.printedAt) {
    patch.printedAt = Date.now();
  }
  const updated = await updateOrder(params.id, patch);
  publish(existing.shopId, { type: "update", orderId: params.id, status });

  return NextResponse.json({ ok: true, status: updated?.status });
}
