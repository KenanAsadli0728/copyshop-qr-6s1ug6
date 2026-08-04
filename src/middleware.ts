import { NextRequest, NextResponse } from "next/server";
import { opCookieName } from "@/lib/authConst";
import { validShopSessionEdge } from "@/lib/sessionEdge";

// /dashboard            -> public "enter your shop code" page
// /dashboard/[shopId]/login -> public login form for that shop
// /dashboard/[shopId]/**    -> requires that shop's own session cookie
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const parts = pathname.split("/").filter(Boolean); // ["dashboard", shopId, ...rest]

  if (parts.length < 2) return NextResponse.next(); // "/dashboard" itself

  const shopId = parts[1];
  const isLogin = parts[2] === "login";
  if (isLogin) return NextResponse.next();

  const ok = await validShopSessionEdge(shopId, req.cookies.get(opCookieName(shopId))?.value);
  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = `/dashboard/${shopId}/login`;
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
