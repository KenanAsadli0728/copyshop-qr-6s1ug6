import crypto from "node:crypto";

// Signed, expiring URLs for file preview. Files are never served by a raw path;
// the operator gets a token that expires (default 10 min TTL). Customers never
// get a file URL at all.
const SECRET =
  process.env.COPYSHOP_SECRET || "dev-only-insecure-secret-change-me";

export function signFile(orderId: string, fileId: string, ttlMs = 10 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const payload = `${orderId}.${fileId}.${exp}`;
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyFile(orderId: string, fileId: string, token: string): boolean {
  const [expStr, sig] = (token || "").split(".");
  if (!expStr || !sig) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const payload = `${orderId}.${fileId}.${exp}`;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
