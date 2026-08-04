import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { addOrder, getShop, id, nextCode } from "@/lib/store";
import { writeOrderFile, deleteOrderFiles } from "@/lib/fileStorage";
import { countPages } from "@/lib/pages";
import { quote } from "@/lib/pricing";
import { publish } from "@/lib/bus";
import type { Order, OrderFile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|heic|webp)$/i;

// Web Share Target endpoint: when this shop's kiosk screen is installed to
// the home screen on Android, it registers as a share target (see
// manifest.webmanifest). Sharing a file from WhatsApp (or anywhere) straight
// to the installed app lands here — one request, one order, same defaults as
// the one-click upload button. No staging round-trip needed since the whole
// file arrives in a single POST.
export async function POST(
  req: NextRequest,
  { params }: { params: { shopId: string } }
) {
  const shopId = params.shopId;
  const shop = await getShop(shopId);
  const fail = () => NextResponse.redirect(new URL(`/s/${shopId}?shareError=1`, req.url), 303);

  if (!shop || !shop.isOpen || !shop.accepting) return fail();

  const form = await req.formData().catch(() => null);
  if (!form) return fail();

  const uploads = form.getAll("files").filter((f): f is File => f instanceof File);
  if (uploads.length === 0) return fail();

  const orderId = id();
  const files: OrderFile[] = [];
  let totalPages = 0;
  const savedKeys: string[] = [];
  try {
    for (const f of uploads) {
      if (!ALLOWED.test(f.name) || f.size > MAX_BYTES) continue; // skip anything unsupported, keep the rest
      const buf = Buffer.from(await f.arrayBuffer());
      const fileId = id();
      const storedPath = await writeOrderFile(orderId, fileId, path.extname(f.name), buf);
      savedKeys.push(storedPath);
      const info = await countPages(buf, f.name, f.type);
      totalPages += info.pages;
      files.push({
        id: fileId,
        name: f.name,
        size: f.size,
        type: f.type || "application/octet-stream",
        rawPages: info.pages,
        pages: info.pages,
        storedPath,
        convertPending: info.convertPending,
      });
    }
  } catch {
    await deleteOrderFiles(orderId, savedKeys);
    return fail();
  }

  if (files.length === 0) {
    await deleteOrderFiles(orderId, savedKeys);
    return fail();
  }

  const options = { color: false, duplex: false, copies: 1, paper: "A4" as const, binding: "none" as const };
  const q = quote(shop.prices, options, totalPages);
  const code = await nextCode(shopId);
  const order: Order = {
    id: orderId,
    shopId,
    code,
    files,
    fileCount: files.length,
    options,
    pages: totalPages,
    billedPages: q.billedPages,
    price: q.price,
    status: "waiting",
    createdAt: Date.now(),
  };
  await addOrder(order);
  publish(shopId, { type: "new", orderId });

  return NextResponse.redirect(new URL(`/o/${order.id}`, req.url), 303);
}
