// Thin wrapper around Netlify Blobs. Only ever imported on paths that first
// check isNetlify(), so the @netlify/blobs SDK never has to run (or even be
// resolved) during local dev/testing.
import { getStore } from "@netlify/blobs";

// Three logical stores sharing the site's blob storage:
// - "db"      one JSON blob holding the whole DB (shops + orders) — same
//             shape as the local data/db.json file.
// - "files"   final order files, keyed by `${orderId}/${fileId}`.
// - "staging" pre-order upload staging, keyed by `${quoteId}/${fileId}`.
export function dbStore() {
  return getStore({ name: "copyshop-db", consistency: "strong" });
}
export function filesStore() {
  return getStore({ name: "copyshop-files", consistency: "strong" });
}
export function stagingStore() {
  return getStore({ name: "copyshop-staging", consistency: "strong" });
}
