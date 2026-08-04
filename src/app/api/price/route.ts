import { NextRequest, NextResponse } from "next/server";
import { getShop, activeOrders } from "@/lib/store";
import { getStaged } from "@/lib/staging";
import { pagesInRange } from "@/lib/pages";
import { quote, money, perPageRate } from "@/lib/pricing";
import type { OrderOptions } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side price for a staged upload under the chosen options. Called each
// time the customer changes an option. No file transfer involved.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Yanlış sorğu" }, { status: 400 });

  const { shopId, quoteId, options } = body as {
    shopId: string;
    quoteId: string;
    options: OrderOptions;
  };
  const shop = await getShop(shopId);
  if (!shop) return NextResponse.json({ error: "Naməlum müəssisə" }, { status: 404 });
  const staged = await getStaged(quoteId);
  if (!staged) return NextResponse.json({ error: "Yükləmənin vaxtı bitib, faylları yenidən seçin" }, { status: 410 });

  const totalPages = staged.files.reduce(
    (sum, f) => sum + pagesInRange(options.pageRange, f.rawPages),
    0
  );
  const q = quote(shop.prices, options, totalPages);
  const pending = staged.files.some((f) => f.convertPending);
  const active = await activeOrders(shopId);
  const ahead = active.filter((o) => o.status === "waiting" || o.status === "printing").length;

  return NextResponse.json({
    ahead,
    pages: q.pages,
    billedPages: q.billedPages,
    perPage: q.perPage,
    bulkApplied: q.bulkApplied,
    price: q.price,
    priceLabel: money(shop.prices, q.price),
    perPageLabel: money(shop.prices, perPageRate(shop.prices, options)),
    convertPending: pending,
  });
}
