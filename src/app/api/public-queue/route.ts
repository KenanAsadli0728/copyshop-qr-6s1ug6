import { NextRequest, NextResponse } from "next/server";
import { allOrders, getShop } from "@/lib/store";
import { money } from "@/lib/pricing";
import { signFile } from "@/lib/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public, unauthenticated live monitor + action feed for an in-shop kiosk
// screen, by explicit choice: this includes order ids (to act on) and signed,
// short-lived per-file download links. No passcode gates this — the shop
// chose a single shared screen over per-action auth for staff convenience.
const VISIBLE_STATUSES = new Set(["waiting", "printing", "ready", "deleted"]);

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId") || "demo";
  const shop = await getShop(shopId);
  if (!shop) return NextResponse.json({ error: "Unknown shop" }, { status: 404 });

  const all = await allOrders(shopId);
  const orders = all
    .filter((o) => VISIBLE_STATUSES.has(o.status))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20)
    .map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      createdAt: o.createdAt,
      pages: o.pages,
      billedPages: o.billedPages,
      price: o.price,
      priceLabel: money(shop.prices, o.price),
      options: o.options,
      fileCount: o.fileCount,
      // Filenames/downloads are withheld once the files themselves are gone
      // (status "deleted") — nothing about a printed job's content survives
      // retention, even though the order record itself does for reporting.
      files:
        o.status === "deleted"
          ? []
          : o.files.map((f) => ({
              id: f.id,
              name: f.name,
              downloadUrl: `/api/public-file/${o.id}/${f.id}?token=${signFile(o.id, f.id)}`,
            })),
    }));

  const dayStart = startOfDay(Date.now());
  const today = all.filter((o) => o.status !== "cancelled" && o.createdAt >= dayStart);
  const revenue = today.reduce((sum, o) => sum + o.price, 0);

  return NextResponse.json({
    orders,
    totals: {
      count: today.length,
      revenue,
      revenueLabel: money(shop.prices, revenue),
    },
  });
}
