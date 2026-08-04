import { NextRequest } from "next/server";
import { subscribe } from "@/lib/bus";
import { isOperatorFor } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Operator SSE: pushes every queue change for a shop. No polling on the client.
export async function GET(req: NextRequest) {
  const shopId = req.nextUrl.searchParams.get("shopId") || "demo";
  if (!isOperatorFor(req, shopId)) {
    return new Response("Unauthorized", { status: 401 });
  }
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
