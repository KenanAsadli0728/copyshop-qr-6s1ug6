// Netlify sets NETLIFY=true in both the build and the Functions runtime
// (including Scheduled Functions). Everywhere else (local dev, a plain Node
// host) we fall back to the local filesystem, which is what this app used
// exclusively before Netlify support was added.
export function isNetlify(): boolean {
  return process.env.NETLIFY === "true";
}
