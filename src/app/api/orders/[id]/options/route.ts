import { NextRequest, NextResponse } from "next/server";
import { getOrder, getShop, updateOrder } from "@/lib/store";
import { isOperatorFor } from "@/lib/auth";
import { pagesInRange } from "@/lib/pages";
import { quote } from "@/lib/pricing";
import { publish } from "@/lib/bus";
import type { Binding, OrderOptions, Paper } from "@/lib/types";

export const runtime = "nodejs";

// Customers submit with default print settings (one-click upload); the operator
// adjusts color/copies/paper/binding/page-range here once they see the file,
// and the price recomputes from the original page counts — no re-upload.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = await getOrder(params.id);
  if (!order || order.status === "deleted") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isOperatorFor(req, order.shopId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const shop = await getShop(order.shopId);
  if (!shop) return NextResponse.json({ error: "Unknown shop" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const options = normalizeOptions(body, order.options);

  const files = order.files.map((f) => ({
    ...f,
    pages: pagesInRange(options.pageRange, f.rawPages),
  }));
  const totalPages = files.reduce((sum, f) => sum + f.pages, 0);
  const q = quote(shop.prices, options, totalPages);

  const updated = await updateOrder(params.id, {
    options,
    files,
    pages: totalPages,
    billedPages: q.billedPages,
    price: q.price,
  });
  publish(order.shopId, { type: "update", orderId: params.id, status: updated?.status });

  return NextResponse.json({ ok: true, pages: totalPages, billedPages: q.billedPages, price: q.price });
}

function normalizeOptions(raw: any, current: OrderOptions): OrderOptions {
  const paper: Paper = raw.paper === "A3" ? "A3" : raw.paper === "A4" ? "A4" : current.paper;
  const binding: Binding =
    raw.binding === "spiral" || raw.binding === "sleeve" || raw.binding === "none"
      ? raw.binding
      : current.binding;
  const copies =
    raw.copies !== undefined
      ? Math.min(999, Math.max(1, parseInt(raw.copies, 10) || 1))
      : current.copies;
  return {
    color: typeof raw.color === "boolean" ? raw.color : current.color,
    duplex: typeof raw.duplex === "boolean" ? raw.duplex : current.duplex,
    copies,
    paper,
    binding,
    pageRange: typeof raw.pageRange === "string" ? raw.pageRange : current.pageRange,
  };
}
