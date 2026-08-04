import { NextRequest } from "next/server";
import { subscribe } from "@/lib/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public SSE feed for the kiosk monitor — pushes queue change events only
// (type/orderId/status), same shape as the operator stream. No file data
// travels over this channel; the client re-fetches /api/public-queue on event.
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId") || "demo";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ type: "hello" });
      const unsub = subscribe(shopId, (e) => send(e));
      const ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
