import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import {
  addOrder,
  getShop,
  id,
  nextCode,
  queueAhead,
} from "@/lib/store";
import { getStaged, discardStaged, readStagedFileBytes } from "@/lib/staging";
import { writeOrderFile } from "@/lib/fileStorage";
import { pagesInRange } from "@/lib/pages";
import { quote } from "@/lib/pricing";
import { publish } from "@/lib/bus";
import type { Order, OrderFile, OrderOptions, Binding, Paper } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Commit a staged upload into a real order — no second file transfer.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Yanlış sorğu" }, { status: 400 });

  const { shopId, quoteId, firstName } = body as {
    shopId: string;
    quoteId: string;
    firstName?: string;
  };
  const options = normalizeOptions(body.options ?? {});

  const shop = await getShop(shopId);
  if (!shop) return NextResponse.json({ error: "Naməlum müəssisə" }, { status: 404 });
  if (!shop.isOpen || !shop.accepting) {
    return NextResponse.json({ error: "Müəssisə hazırda sifariş qəbul etmir" }, { status: 409 });
  }
  const staged = await getStaged(quoteId);
  if (!staged || staged.shopId !== shopId) {
    return NextResponse.json(
      { error: "Yükləmənin vaxtı bitib, faylları yenidən seçin" },
      { status: 410 }
    );
  }

  const orderId = id();
  const files: OrderFile[] = [];
  let totalPages = 0;
  for (const sf of staged.files) {
    const buf = await readStagedFileBytes(staged.id, sf.id);
    if (!buf) continue; // shouldn't happen, but don't let one missing file sink the order
    const storedPath = await writeOrderFile(orderId, sf.id, path.extname(sf.name), buf);
    const pages = pagesInRange(options.pageRange, sf.rawPages);
    totalPages += pages;
    files.push({
      id: sf.id,
      name: sf.name,
      size: sf.size,
      type: sf.type,
      rawPages: sf.rawPages,
      pages,
      storedPath,
      convertPending: sf.convertPending,
    });
  }
  await discardStaged(staged.id);

  const q = quote(shop.prices, options, totalPages);
  const code = await nextCode(shopId);
  const order: Order = {
    id: orderId,
    shopId,
    code,
    firstName: firstName?.trim() || undefined,
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

  return NextResponse.json({
    id: order.id,
    code: order.code,
    pages: order.pages,
    price: order.price,
    ahead: await queueAhead(shopId, orderId),
  });
}

function normalizeOptions(raw: any): OrderOptions {
  const paper: Paper = raw.paper === "A3" ? "A3" : "A4";
  const binding: Binding =
    raw.binding === "spiral" || raw.binding === "sleeve" ? raw.binding : "none";
  const copies = Math.min(999, Math.max(1, parseInt(raw.copies, 10) || 1));
  return {
    color: !!raw.color,
    duplex: !!raw.duplex,
    copies,
    paper,
    binding,
    pageRange: typeof raw.pageRange === "string" ? raw.pageRange : undefined,
  };
}
