import { everyOrder, updateOrder } from "./store";
import { publish } from "./bus";
import { sweepStaged } from "./staging";
import { deleteOrderFiles } from "./fileStorage";
import { isNetlify } from "./env";

const FIFTEEN_MIN = 15 * 60 * 1000;
const TWO_HOURS = 2 * 60 * 60 * 1000;

// Hard-delete an order's files (local disk or blobs, whichever backend is
// live) and mark it deleted. Not a soft delete: the bytes are removed and the
// stored paths cleared — only order metadata (code/price/pages) survives, for
// reporting.
async function purge(orderId: string, shopId: string, keys: string[]) {
  await deleteOrderFiles(orderId, keys);
  await updateOrder(orderId, {
    status: "deleted",
    deletedAt: Date.now(),
    files: [],
  });
  publish(shopId, { type: "deleted", orderId });
}

// Delete files 15 min after printing OR 2 h after upload, whichever first.
// Called every 60s by a local setInterval on traditional hosting, or once per
// invocation by a Netlify Scheduled Function (see netlify/functions/retention-sweep.ts).
export async function sweep() {
  const now = Date.now();
  const orders = await everyOrder();
  for (const o of orders) {
    if (o.status === "deleted") continue;
    const printedExpired = o.printedAt !== undefined && now - o.printedAt >= FIFTEEN_MIN;
    const uploadExpired = now - o.createdAt >= TWO_HOURS;
    if (printedExpired || uploadExpired) {
      await purge(o.id, o.shopId, o.files.map((f) => f.storedPath));
    }
  }
  await sweepStaged();
}

let started = false;
export function startRetention() {
  if (started || isNetlify()) return; // Netlify uses a Scheduled Function instead
  started = true;
  // Run every 60s. Real deletion, driven by a scheduled job.
  setInterval(sweep, 60 * 1000).unref?.();
  sweep();
}
