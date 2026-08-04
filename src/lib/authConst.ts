// Shared helpers with no crypto imports — safe for both Edge middleware and
// Node route handlers. Each shop gets its own session cookie, scoped by its
// code, so being logged into one shop's dashboard grants nothing on another's.
export function opCookieName(shopId: string): string {
  const safe = shopId.replace(/[^A-Za-z0-9_-]/g, "");
  return `op_${safe}`;
}
