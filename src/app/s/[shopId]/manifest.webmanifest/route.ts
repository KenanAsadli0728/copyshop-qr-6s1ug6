import { NextRequest, NextResponse } from "next/server";
import { getShop } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A manifest scoped to THIS shop's code, so "Add to Home Screen" installs an
// app pinned to /s/[shopId] specifically — and, critically, registers this
// shop as a Share Target on Android: sharing a file from WhatsApp straight to
// the installed app posts it to /s/[shopId]/share, skipping the "save first"
// step. iOS Safari doesn't support Share Target; there the manual "Add
// Files" button is still the only path, unaffected by any of this.
export async function GET(
  req: NextRequest,
  { params }: { params: { shopId: string } }
) {
  const shop = await getShop(params.shopId);
  const name = shop?.name || "CopyShop";

  const manifest = {
    name,
    short_name: name.slice(0, 20),
    start_url: `/s/${params.shopId}`,
    scope: `/s/${params.shopId}`,
    display: "standalone",
    background_color: "#f5f5f5",
    theme_color: "#5B4FE9",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
    share_target: {
      action: `/s/${params.shopId}/share`,
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [
          {
            name: "files",
            accept: [
              "application/pdf",
              ".doc",
              ".docx",
              ".xls",
              ".xlsx",
              ".ppt",
              ".pptx",
              "image/jpeg",
              "image/png",
              "image/heic",
              "image/webp",
            ],
          },
        ],
      },
    },
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
