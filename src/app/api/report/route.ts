import { NextRequest, NextResponse } from "next/server";
import { allOrders, getShop } from "@/lib/store";
import { isOperatorFor } from "@/lib/auth";
import { money } from "@/lib/pricing";
import type { Order } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId") || "demo";
  if (!isOperatorFor(req, shopId)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const shop = await getShop(shopId);
  if (!shop) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const now = Date.now();
  const dayStart = startOfDay(now);
  const DAY = 24 * 60 * 60 * 1000;
  const WEEK = 7 * DAY;

  const all = await allOrders(shopId);
  const orders = all.filter((o) => o.status !== "cancelled");

  const inRange = (o: Order, from: number, to: number) =>
    o.createdAt >= from && o.createdAt < to;

  const today = orders.filter((o) => o.createdAt >= dayStart);

  const revenue = (list: Order[]) => list.reduce((s, o) => s + o.price, 0);
  const pages = (list: Order[]) => list.reduce((s, o) => s + o.billedPages, 0);

  // Busiest hours (today), 24 buckets.
  const hours = Array.from({ length: 24 }, () => 0);
  for (const o of today) hours[new Date(o.createdAt).getHours()]++;

  // Color vs B&W (today).
  const colorCount = today.filter((o) => o.options.color).length;
  const bwCount = today.length - colorCount;

  // Week-over-week & month-over-month revenue.
  const thisWeek = orders.filter((o) => inRange(o, now - WEEK, now + 1));
  const lastWeek = orders.filter((o) => inRange(o, now - 2 * WEEK, now - WEEK));
  const thisMonth = orders.filter((o) => inRange(o, now - 30 * DAY, now + 1));
  const lastMonth = orders.filter((o) => inRange(o, now - 60 * DAY, now - 30 * DAY));

  const m = (n: number) => money(shop.prices, n);

  return NextResponse.json({
    currency: shop.prices.currency,
    today: {
      orders: today.length,
      pages: pages(today),
      revenue: revenue(today),
      revenueLabel: m(revenue(today)),
      color: colorCount,
      bw: bwCount,
      hours,
    },
    compare: {
      weekRevenue: revenue(thisWeek),
      weekRevenueLabel: m(revenue(thisWeek)),
      lastWeekRevenue: revenue(lastWeek),
      lastWeekRevenueLabel: m(revenue(lastWeek)),
      monthRevenue: revenue(thisMonth),
      monthRevenueLabel: m(revenue(thisMonth)),
      lastMonthRevenue: revenue(lastMonth),
      lastMonthRevenueLabel: m(revenue(lastMonth)),
    },
  });
}
