import { NextRequest, NextResponse } from "next/server";
import { getOrder, getShop, queueAhead } from "@/lib/store";
import { money } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public status for the customer's own order. Exposes NO file access, no other
// orders' details — just this order's code, status and queue position.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const o = await getOrder(params.id);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const shop = await getShop(o.shopId);

  const ahead =
    o.status === "waiting" || o.status === "printing"
      ? await queueAhead(o.shopId, o.id)
      : 0;

  return NextResponse.json({
    id: o.id,
    code: o.code,
    status: o.status,
    pages: o.pages,
    billedPages: o.billedPages,
    price: o.price,
    priceLabel: shop ? money(shop.prices, o.price) : String(o.price),
    ahead,
    fileCount: o.fileCount,
    firstName: o.firstName,
  });
}
