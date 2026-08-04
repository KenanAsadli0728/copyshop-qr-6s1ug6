import { NextRequest, NextResponse } from "next/server";
import { activeOrders, getShop } from "@/lib/store";
import { isOperatorFor } from "@/lib/auth";
import { signFile } from "@/lib/sign";
import { money } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId") || "demo";
  if (!isOperatorFor(req, shopId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const shop = await getShop(shopId);
  if (!shop) return NextResponse.json({ error: "Unknown shop" }, { status: 404 });

  const active = await activeOrders(shopId);
  const orders = active.map((o) => ({
    id: o.id,
    code: o.code,
    firstName: o.firstName,
    status: o.status,
    createdAt: o.createdAt,
    printedAt: o.printedAt,
    pages: o.pages,
    billedPages: o.billedPages,
    price: o.price,
    priceLabel: money(shop.prices, o.price),
    options: o.options,
    files: o.files.map((f) => ({
      id: f.id,
      name: f.name,
      pages: f.pages,
      size: f.size,
      convertPending: f.convertPending,
      // Signed, expiring preview URL (operator only, no download).
      previewUrl: `/api/file/${o.id}/${f.id}?token=${signFile(o.id, f.id)}`,
    })),
  }));

  return NextResponse.json({ shop: { name: shop.name, accepting: shop.accepting, isOpen: shop.isOpen }, orders });
}
