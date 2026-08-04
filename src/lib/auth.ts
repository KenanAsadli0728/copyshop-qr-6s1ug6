import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { opCookieName } from "./authConst";
import { getShop } from "./store";

// Per-shop operator auth: each shop has its own passcode (set at creation) and
// its own signed session cookie. Logging into one shop's dashboard proves
// nothing about any other shop. Customers never authenticate at all — only
// /dashboard/[shopId] and its APIs are gated.
const SECRET = process.env.COPYSHOP_SECRET || "dev-only-insecure-secret-change-me";

export { opCookieName };

export function signShopSession(shopId: string): string {
  return crypto.createHmac("sha256", SECRET).update(`operator:${shopId}`).digest("hex");
}

export async function checkPasscode(shopId: string, input: string): Promise<boolean> {
  const shop = await getShop(shopId);
  return !!shop && input === shop.passcode;
}

export function validShopSession(shopId: string, token: string | undefined): boolean {
  if (!token) return false;
  const expected = signShopSession(shopId);
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function isOperatorFor(req: NextRequest, shopId: string): boolean {
  return validShopSession(shopId, req.cookies.get(opCookieName(shopId))?.value);
}
