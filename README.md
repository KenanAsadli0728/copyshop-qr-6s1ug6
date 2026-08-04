# CopyShop QR

A multi-tenant print-shop order system. Each business gets a unique code from
`/create`; customers and the print operator both use that one code at
`/s/{code}` — a shared, unauthenticated screen where customers upload files
and staff print/mark-ready/cancel/download, live. A separate, passcode-gated
`/dashboard/{code}` handles prices, reports, and shop settings.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it lands on a "enter your shop code" screen.

- **Demo shop kiosk:** http://localhost:3000/s/demo
- **Demo shop dashboard:** http://localhost:3000/dashboard/demo (passcode `1234`)
- **Create a new shop:** http://localhost:3000/create

Locally, data is stored in `data/db.json` and `data/uploads/` — nothing to
configure. This path is unaffected by the Netlify support described below.

## Deploying to Netlify

Netlify runs this app as serverless functions: no request can rely on local
disk or in-memory state surviving to the next one. Three parts of the app are
built to detect that (`process.env.NETLIFY === "true"`, set automatically by
Netlify) and switch backends accordingly — **local dev is untouched**; this
only changes behavior when actually running on Netlify.

| Concern | Local dev | On Netlify |
|---|---|---|
| Orders/shops (`src/lib/store.ts`) | `data/db.json` | One JSON blob via `@netlify/blobs` |
| Uploaded files (`src/lib/fileStorage.ts`) | `data/uploads/` | Blobs, keyed `{orderId}/{fileId}` |
| Staged pre-order uploads (`src/lib/staging.ts`) | in-memory Map + temp files | Blobs, same pattern |
| Auto-deletion (`src/lib/retention.ts`) | `setInterval` every 60s | `netlify/functions/retention-sweep.ts`, a Scheduled Function running every minute |

Steps:
1. `netlify.toml` and `@netlify/plugin-nextjs` are already set up — connect
   the repo in Netlify and deploy as-is.
2. Set the `COPYSHOP_SECRET` environment variable in the Netlify UI (site
   settings → Environment variables) to a long random string. Without it the
   app falls back to an insecure default.
3. Netlify Blobs need no separate provisioning — the SDK talks to the site's
   built-in blob store automatically once deployed.
4. The Scheduled Function is picked up automatically from `netlify/functions/`;
   confirm it in the Netlify UI under Functions → Scheduled.

**Honesty check on what's actually been verified:** the local (fs-backed) path
has a 54-check automated test suite (`node scripts/e2e.mjs` against
`npm run dev`) that passes in full. The Netlify/Blobs-backed path has been
written and type-checked but **not executed against a real Netlify
deployment** in this environment (no Netlify CLI/site credentials available
here) — test it for real after your first deploy before relying on it.

### Known limitation: no distributed locking

`nextCode()` increments a shop's order-number counter with a read-modify-write
that isn't atomic across concurrent serverless invocations. Two orders placed
at the exact same instant *could* theoretically collide on the same code.
Fine for typical single-shop foot traffic; would need a proper atomic counter
(e.g. a real database with transactions) if that ever becomes a real
bottleneck.

### Known limitation: SSE doesn't work on Netlify

Real-time push (`src/lib/bus.ts` + the `/api/stream`, `/api/public-stream`,
`/api/orders/[id]/stream` routes) relies on an in-process `EventEmitter` —
serverless invocations share no memory, so a Netlify function publishing an
event and another one's open connection are simply unaware of each other.
Every page that uses SSE (operator queue, kiosk queue, customer status) *also*
polls on an interval as a fallback, so the app still updates and the
new-order sound alert still fires — just every ~5s instead of instantly. SSE
itself is left in place because it still works, and still helps, on
traditional Node hosting.

## What's implemented

**Customer/kiosk (`/s/{code}`, no login by design)**
- One-click upload with color/B&W and 1-/2-sided picked inline; rest defaulted
- Formats: PDF, DOC(X), XLS(X), PPT(X), JPG, PNG, HEIC, WEBP · 50 MB limit
- Server-computed page count and price; big order code + live status page at `/o/{id}`
- Live order queue on the same screen: anyone with the link can view, print,
  mark ready, cancel, and download any file — a deliberate trade-off over a
  locked-down flow, made explicitly by the shop owner
- Web Share Target (Android + "Add to Home Screen" only): share a file from
  WhatsApp straight into the app, skipping the manual save-then-upload step;
  iOS Safari has no equivalent and still needs the manual flow

**Dashboard (`/dashboard/{code}`, per-shop passcode)**
- Live queue, sound + visual alert on new orders, inline option editing
- Signed, expiring, operator-only file preview (inline, no download)
- Price configuration, end-of-day report, shop open/closed + pause toggles
- Printable A5 QR poster + PNG download, passcode reveal/regenerate

**Multi-tenant isolation**
- Every shop gets a unique code (URL slug) and its own passcode, generated at `/create`
- Orders, prices, and sessions are strictly filtered/scoped per shop — verified
  by automated tests that create two shops and confirm zero cross-visibility

**Privacy / security**
- Files served only via signed, short-lived URLs
- Real deletion (not soft): 15 min after printing OR 2 h after upload, whichever first
- Filenames/contents never logged; the record of an order (for reporting)
  survives deletion, but nothing about its content does

## Deferred / stubbed (by design)

- **Office → PDF conversion.** DOCX/XLSX/PPTX are accepted and page-counted
  with an estimate, flagged `convertPending`. Real fidelity needs headless
  LibreOffice — wire it into `src/lib/pages.ts` / the commit step.
- **Chunked/resumable upload.** A single multipart POST with progress; fine
  for the MVP, upgrade to resumable for very weak connections.
- Online payments, customer accounts, multi-shop marketplace — out of scope.

## Config

Copy `.env.example` → `.env.local` and set `COPYSHOP_SECRET` before any real
use. On Netlify, set it in the site's environment variables instead.

## Project map

```
src/lib/            store (shops/orders), fileStorage, staging, blobs, env,
                     pricing, pages, retention, auth, sign, bus
src/app/api/         quote (upload), orders (commit), status, options, file,
                     stream, shop, shops, report, login, public-queue,
                     public-file, public-stream
src/app/s/           kiosk (upload + queue), share (Web Share Target), manifest
src/app/o/           customer order status
src/app/dashboard/   per-shop operator dashboard (queue, prices, report, settings)
src/app/create/      self-service shop signup
netlify/functions/   retention-sweep (Scheduled Function)
```
