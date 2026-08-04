import { NextRequest, NextResponse } from "next/server";
import { getShop, saveShop } from "@/lib/store";
import { isOperatorFor } from "@/lib/auth";
import type { PriceTable } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { shopId: string } }
) {
  const shop = await getShop(params.shopId);
  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const base = {
    id: shop.id,
    name: shop.name,
    address: shop.address,
    hours: shop.hours,
    isOpen: shop.isOpen,
    accepting: shop.accepting,
    currency: shop.prices.currency,
  };
  // Prices and passcode only exposed to that shop's own operator.
  if (isOperatorFor(req, params.shopId)) {
    return NextResponse.json({ ...base, prices: shop.prices, passcode: shop.passcode });
  }
  return NextResponse.json(base);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { shopId: string } }
) {
  if (!isOperatorFor(req, params.shopId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const shop = await getShop(params.shopId);
  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.name === "string") shop.name = body.name.slice(0, 80);
  if (typeof body.address === "string") shop.address = body.address.slice(0, 200);
  if (typeof body.hours === "string") shop.hours = body.hours.slice(0, 120);
  if (typeof body.isOpen === "boolean") shop.isOpen = body.isOpen;
  if (typeof body.accepting === "boolean") shop.accepting = body.accepting;

  if (body.prices && typeof body.prices === "object") {
    const p = shop.prices;
    const numKeys: (keyof PriceTable)[] = [
      "a4_bw_single", "a4_bw_double", "a4_color_single", "a4_color_double",
      "a3_bw_single", "a3_bw_double", "a3_color_single", "a3_color_double",
      "binding_spiral", "binding_sleeve", "bulkThreshold", "bulkPerPage",
    ];
    for (const k of numKeys) {
      const v = Number(body.prices[k]);
      if (Number.isFinite(v) && v >= 0) (p[k] as number) = v;
    }
    if (typeof body.prices.currency === "string" && body.prices.currency.length <= 3) {
      p.currency = body.prices.currency;
    }
  }

  if (body.regeneratePasscode === true) {
    shop.passcode = String(Math.floor(1000 + Math.random() * 9000));
  }

  await saveShop(shop);
  return NextResponse.json({ ok: true, passcode: shop.passcode });
}
