// Edge-safe session verification using Web Crypto (no `node:` imports), so it
// can run inside Next.js middleware. Produces the same per-shop HMAC-SHA256
// hex as the Node side in auth.ts, so the two agree on a valid session cookie.
const SECRET = process.env.COPYSHOP_SECRET || "dev-only-insecure-secret-change-me";

async function expectedShopSession(shopId: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`operator:${shopId}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function validShopSessionEdge(shopId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;
  return token === (await expectedShopSession(shopId));
}
