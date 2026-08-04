import { NextRequest } from "next/server";
import { subscribe } from "@/lib/bus";
import { getOrder } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Customer SSE: pushes status changes for THIS order only. No auth (the order id
// is the secret), and it never leaks any other order's data.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const order = await getOrder(params.id);
  if (!order) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  const orderId = params.id;
  const shopId = order.shopId;

  const stream = new ReadableStream({
    start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ type: "hello" });
      const unsub = subscribe(shopId, (e: any) => {
        if (e && e.orderId === orderId) send(e);
      });
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
