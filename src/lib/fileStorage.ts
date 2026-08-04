import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "./store";
import { isNetlify } from "./env";

// Final (post-order) file storage. Local dev keeps real files under
// data/uploads/{orderId}/; on Netlify each file is a blob keyed by
// `{orderId}/{fileId}{ext}` — that same string is what's saved as the
// order's `storedPath`, so callers don't need to know which backend is live.

export async function writeOrderFile(
  orderId: string,
  fileId: string,
  ext: string,
  buf: Buffer
): Promise<string> {
  if (isNetlify()) {
    const { filesStore } = await import("./blobs");
    const key = `${orderId}/${fileId}${ext}`;
    await filesStore().set(key, new Blob([new Uint8Array(buf)]));
    return key;
  }
  const dir = path.join(UPLOAD_DIR, orderId);
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${fileId}${ext}`);
  fs.writeFileSync(dest, buf);
  return dest;
}

export async function readOrderFile(storedPath: string): Promise<Buffer | null> {
  if (isNetlify()) {
    const { filesStore } = await import("./blobs");
    const data = await filesStore().get(storedPath, { type: "arrayBuffer" });
    return data ? Buffer.from(data) : null;
  }
  try {
    return fs.readFileSync(storedPath);
  } catch {
    return null;
  }
}

export async function orderFileExists(storedPath: string): Promise<boolean> {
  if (isNetlify()) {
    const { filesStore } = await import("./blobs");
    const meta = await filesStore().getMetadata(storedPath);
    return !!meta;
  }
  return fs.existsSync(storedPath);
}

// Hard-deletes every file belonging to an order. `keys` are each file's
// storedPath — required on Netlify since blobs have no "directory" to remove
// wholesale; on local disk we just remove the order's whole upload folder.
export async function deleteOrderFiles(orderId: string, keys: string[]): Promise<void> {
  if (isNetlify()) {
    const { filesStore } = await import("./blobs");
    await Promise.all(keys.map((k) => filesStore().delete(k)));
    return;
  }
  const dir = path.join(UPLOAD_DIR, orderId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* already gone */
  }
}
