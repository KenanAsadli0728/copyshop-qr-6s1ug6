import { NextRequest, NextResponse } from "next/server";
import { createShop } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Self-service shop creation: any business can register itself and get a
// unique code + passcode immediately, no approval step. This is the only
// place a shop's passcode is ever returned in full — after this, it's only
// visible to someone already logged into that shop's dashboard.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "Shop name is required" }, { status: 400 });
  }
  const shop = await createShop(name);
  return NextResponse.json({ id: shop.id, name: shop.name, passcode: shop.passcode });
}
