import { NextRequest, NextResponse } from "next/server";
import { getShop, id } from "@/lib/store";
import { createStaged, discardStaged, addStagedFile, getStaged } from "@/lib/staging";
import { countPages } from "@/lib/pages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|heic|webp)$/i;

// Upload files ONCE, stage them, and return accurate per-file page counts.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const shopId = String(form.get("shopId") || "");
  const shop = await getShop(shopId);
  if (!shop) return NextResponse.json({ error: "Naməlum müəssisə" }, { status: 404 });
  if (!shop.isOpen || !shop.accepting) {
    return NextResponse.json({ error: "Müəssisə hazırda sifariş qəbul etmir" }, { status: 409 });
  }

  const uploads = form.getAll("files").filter((f): f is File => f instanceof File);
  if (uploads.length === 0) {
    return NextResponse.json({ error: "Fayl yoxdur" }, { status: 400 });
  }

  const staged = await createStaged(shopId);
  try {
    for (const f of uploads) {
      if (!ALLOWED.test(f.name)) {
        throw new BadRequest(`Dəstəklənməyən fayl növü: ${f.name}`);
      }
      if (f.size > MAX_BYTES) {
        throw new BadRequest(`${f.name} 50 MB limitini keçir`);
      }
      const buf = Buffer.from(await f.arrayBuffer());
      const fileId = id();
      const info = await countPages(buf, f.name, f.type);
      await addStagedFile(
        staged.id,
        {
          id: fileId,
          name: f.name,
          size: f.size,
          type: f.type || "application/octet-stream",
          rawPages: info.pages,
          convertPending: info.convertPending,
        },
        buf
      );
    }
  } catch (e) {
    await discardStaged(staged.id);
    const msg = e instanceof BadRequest ? e.message : "Yükləmə uğursuz oldu";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const final = (await getStaged(staged.id)) || { files: [] };
  return NextResponse.json({
    quoteId: staged.id,
    files: final.files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      rawPages: f.rawPages,
      convertPending: f.convertPending,
    })),
  });
}

class BadRequest extends Error {}
