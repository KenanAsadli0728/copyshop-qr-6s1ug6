import { NextRequest, NextResponse } from "next/server";
import { checkPasscode, opCookieName, signShopSession } from "@/lib/auth";
import { getShop } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { shopId, passcode } = await req.json().catch(() => ({ shopId: "", passcode: "" }));
  if (!shopId || !(await getShop(String(shopId)))) {
    return NextResponse.json({ error: "Unknown shop" }, { status: 404 });
  }
  if (!(await checkPasscode(String(shopId), String(passcode || "")))) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(opCookieName(shopId), signShopSession(shopId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h shift
  });
  return res;
}

export async function DELETE(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId") || "";
  const res = NextResponse.json({ ok: true });
  if (shopId) res.cookies.set(opCookieName(shopId), "", { path: "/", maxAge: 0 });
  return res;
}
