// End-to-end smoke test against a running dev server (http://localhost:3000).
import { PDFDocument } from "pdf-lib";

const BASE = "http://localhost:3000";
let pass = 0,
  fail = 0;
function check(name, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name} ${extra}`);
  }
}

async function makePdf(pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]);
  return Buffer.from(await doc.save());
}

async function main() {
  // 1. Shop info (public)
  let r = await fetch(`${BASE}/api/shop/demo`);
  const shop = await r.json();
  check("shop info loads", r.ok && shop.name, JSON.stringify(shop));
  check("prices hidden from public", shop.prices === undefined);

  // 2. Stage upload (3-page PDF)
  const pdf = await makePdf(3);
  const fd = new FormData();
  fd.append("shopId", "demo");
  fd.append("files", new Blob([pdf], { type: "application/pdf" }), "report.pdf");
  r = await fetch(`${BASE}/api/quote`, { method: "POST", body: fd });
  const q = await r.json();
  check("quote stages upload", r.ok && q.quoteId, JSON.stringify(q));
  check("page count = 3 (server-side)", q.files?.[0]?.rawPages === 3, JSON.stringify(q.files));

  // 3. Live price: color, 2 copies
  const options = { color: true, duplex: false, copies: 2, paper: "A4", binding: "spiral", pageRange: "" };
  r = await fetch(`${BASE}/api/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: "demo", quoteId: q.quoteId, options }),
  });
  const price = await r.json();
  // 3 pages * 2 copies * 0.4 (a4_color_single) + spiral 2.0 * 2 = 2.4 + 4.0 = 6.4
  check("billed pages = 6", price.billedPages === 6, JSON.stringify(price));
  check("price = 6.40", price.price === 6.4, JSON.stringify(price));

  // 3b. Page range 1-2 -> 2 pages
  r = await fetch(`${BASE}/api/price`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: "demo", quoteId: q.quoteId, options: { ...options, pageRange: "1-2" } }),
  });
  const priceRange = await r.json();
  check("page range 1-2 -> 2 pages/copy -> 4 billed", priceRange.billedPages === 4, JSON.stringify(priceRange));

  // 4. Commit order
  r = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: "demo", quoteId: q.quoteId, firstName: "Alex", options }),
  });
  const order = await r.json();
  check("order created with code", r.ok && order.code, JSON.stringify(order));
  check("committed price matches quote", order.price === 6.4, JSON.stringify(order));

  // 5. Customer status (public)
  r = await fetch(`${BASE}/api/orders/${order.id}`);
  const status = await r.json();
  check("customer status = waiting", status.status === "waiting", JSON.stringify(status));
  check("status exposes no file paths", status.files === undefined);

  // 6. Operator queue requires auth
  r = await fetch(`${BASE}/api/queue?shopId=demo`);
  check("queue blocked without auth", r.status === 401);

  // 7. Login (per-shop passcode now)
  r = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: "demo", passcode: "1234" }),
  });
  const cookie = r.headers.get("set-cookie");
  check("login sets cookie", r.ok && !!cookie, String(cookie));
  const auth = { cookie: cookie?.split(";")[0] || "" };

  // 8. Authorised queue
  r = await fetch(`${BASE}/api/queue?shopId=demo`, { headers: { Cookie: auth.cookie } });
  const queue = await r.json();
  const found = queue.orders?.find((o) => o.id === order.id);
  check("order appears in operator queue", !!found, JSON.stringify(queue.orders?.map((o) => o.code)));
  check("queue gives signed preview url", !!found?.files?.[0]?.previewUrl);

  // 9. Preview requires auth + valid token
  const previewUrl = found.files[0].previewUrl;
  r = await fetch(`${BASE}${previewUrl}`); // no cookie
  check("preview blocked without auth", r.status === 401);
  r = await fetch(`${BASE}${previewUrl}`, { headers: { Cookie: auth.cookie } });
  check("preview works with auth + token", r.ok, `status ${r.status}`);
  r = await fetch(`${BASE}${previewUrl.replace(/token=.*/, "token=bogus")}`, { headers: { Cookie: auth.cookie } });
  check("preview rejects bad token", r.status === 403);

  // 10. Status transitions
  r = await fetch(`${BASE}/api/orders/${order.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: auth.cookie },
    body: JSON.stringify({ status: "printing" }),
  });
  check("set printing", r.ok);
  r = await fetch(`${BASE}/api/orders/${order.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: auth.cookie },
    body: JSON.stringify({ status: "ready" }),
  });
  check("set ready", r.ok);
  r = await fetch(`${BASE}/api/orders/${order.id}`);
  const finalStatus = await r.json();
  check("customer sees ready", finalStatus.status === "ready", JSON.stringify(finalStatus));

  // 11. Report
  r = await fetch(`${BASE}/api/report?shopId=demo`, { headers: { Cookie: auth.cookie } });
  const report = await r.json();
  check("report has today totals", r.ok && report.today && report.today.orders >= 1, JSON.stringify(report.today));

  // 12. One-click flow: no options passed at all -> defaults applied server-side
  const pdf2 = await makePdf(5);
  const fd2 = new FormData();
  fd2.append("shopId", "demo");
  fd2.append("files", new Blob([pdf2], { type: "application/pdf" }), "id.pdf");
  r = await fetch(`${BASE}/api/quote`, { method: "POST", body: fd2 });
  const q2 = await r.json();
  r = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: "demo", quoteId: q2.quoteId }), // no firstName, no options
  });
  const order2 = await r.json();
  // 5 pages * 1 copy * 0.10 (a4_bw_single, default) = 0.50
  check("one-click order defaults to B&W/single/1 copy/A4", r.ok && order2.price === 0.5, JSON.stringify(order2));

  // 13. Operator edits options after the fact -> price recomputes, no re-upload
  r = await fetch(`${BASE}/api/orders/${order2.id}/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: auth.cookie },
    body: JSON.stringify({ color: true, copies: 3 }),
  });
  const edited = await r.json();
  // 5 pages * 3 copies * 0.40 (a4_color_single) = 6.00
  check("operator option edit recomputes price", r.ok && edited.price === 6.0, JSON.stringify(edited));

  r = await fetch(`${BASE}/api/orders/${order2.id}/options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // no cookie
    body: JSON.stringify({ color: true }),
  });
  check("options edit blocked without operator auth", r.status === 401);

  // 14. Public queue: no auth needed, exposes id + download links (by explicit
  // choice) but never raw storedPath.
  r = await fetch(`${BASE}/api/public-queue?shopId=demo`); // no cookie
  const pub = await r.json();
  check("public queue reachable without auth", r.ok && Array.isArray(pub.orders), JSON.stringify(pub).slice(0, 200));
  const pubOrder = pub.orders.find((o) => o.code === order2.code);
  check("public queue shows the order", !!pubOrder, JSON.stringify(pub.orders.map((o) => o.code)));
  check("public queue exposes no storedPath", pubOrder && !("storedPath" in pubOrder));
  check("public queue gives a download link per file", !!pubOrder?.files?.[0]?.downloadUrl, JSON.stringify(pubOrder));
  check("public queue has totals", typeof pub.totals?.revenue === "number", JSON.stringify(pub.totals));

  // 15. Public download: works without auth (by explicit choice), rejects bad token
  const dlUrl = pubOrder.files[0].downloadUrl;
  r = await fetch(`${BASE}${dlUrl}`); // no cookie, by design
  check("public download works without auth", r.ok, `status ${r.status}`);
  check(
    "public download forces attachment (not inline)",
    (r.headers.get("content-disposition") || "").includes("attachment"),
    r.headers.get("content-disposition")
  );
  r = await fetch(`${BASE}${dlUrl.replace(/token=.*/, "token=bogus")}`);
  check("public download rejects bad token", r.status === 403);

  // 16. Public status change: Print/Ready/Cancel work without the operator
  // passcode, by explicit choice (kiosk buttons call the same endpoint).
  r = await fetch(`${BASE}/api/orders/${order2.id}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // no cookie
    body: JSON.stringify({ status: "printing" }),
  });
  check("public status change (no auth) sets printing", r.ok, `status ${r.status}`);
  r = await fetch(`${BASE}/api/public-queue?shopId=demo`);
  const pub2 = await r.json();
  const afterPrint = pub2.orders.find((o) => o.code === order2.code);
  check("public queue reflects the status change", afterPrint?.status === "printing", JSON.stringify(afterPrint));

  // 17. Multi-tenant: create two brand-new shops via self-service signup and
  // verify they never see each other's orders, and one shop's passcode does
  // not unlock the other's dashboard.
  r = await fetch(`${BASE}/api/shops`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Shop Alpha" }),
  });
  const shopA = await r.json();
  check("create shop A", r.ok && shopA.id && shopA.passcode, JSON.stringify(shopA));

  r = await fetch(`${BASE}/api/shops`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Shop Beta" }),
  });
  const shopB = await r.json();
  check("create shop B", r.ok && shopB.id && shopB.passcode, JSON.stringify(shopB));
  check("shop A and B get different codes", shopA.id !== shopB.id);
  check("shop A and B get different passcodes", shopA.passcode !== shopB.passcode);

  // Order into shop A only
  const pdfA = await makePdf(2);
  const fdA = new FormData();
  fdA.append("shopId", shopA.id);
  fdA.append("files", new Blob([pdfA], { type: "application/pdf" }), "alpha.pdf");
  r = await fetch(`${BASE}/api/quote`, { method: "POST", body: fdA });
  const qA = await r.json();
  r = await fetch(`${BASE}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: shopA.id, quoteId: qA.quoteId }),
  });
  const orderA = await r.json();
  check("order created in shop A", r.ok && orderA.code, JSON.stringify(orderA));

  r = await fetch(`${BASE}/api/public-queue?shopId=${shopB.id}`);
  const queueB = await r.json();
  check(
    "shop B's public queue does not show shop A's order",
    !queueB.orders.some((o) => o.code === orderA.code),
    JSON.stringify(queueB.orders)
  );

  // Shop B's passcode must not open shop A's dashboard
  r = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: shopA.id, passcode: shopB.passcode }),
  });
  check("shop B's passcode is rejected for shop A", r.status === 401);

  // Shop A's own passcode does work for shop A
  r = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: shopA.id, passcode: shopA.passcode }),
  });
  const cookieA = r.headers.get("set-cookie");
  check("shop A's own passcode works", r.ok && !!cookieA);
  const authA = { cookie: cookieA?.split(";")[0] || "" };

  // That session cookie must not grant access to shop B's queue
  r = await fetch(`${BASE}/api/queue?shopId=${shopB.id}`, { headers: { Cookie: authA.cookie } });
  check("shop A's session cannot read shop B's operator queue", r.status === 401);

  // But it does grant access to shop A's own operator queue
  r = await fetch(`${BASE}/api/queue?shopId=${shopA.id}`, { headers: { Cookie: authA.cookie } });
  const queueA = await r.json();
  check(
    "shop A's session can read shop A's own queue",
    r.ok && queueA.orders.some((o) => o.code === orderA.code),
    JSON.stringify(queueA.orders?.map((o) => o.code))
  );

  // 18. Web Share Target: manifest, icons, and the /share endpoint that lets
  // an installed Android app receive a WhatsApp-shared file directly.
  r = await fetch(`${BASE}/s/demo/manifest.webmanifest`);
  const manifest = await r.json();
  check("manifest reachable", r.ok && manifest.name, JSON.stringify(manifest).slice(0, 200));
  check("manifest scoped to this shop's start_url", manifest.start_url === "/s/demo");
  check(
    "manifest share_target posts to this shop's /share",
    manifest.share_target?.action === "/s/demo/share" && manifest.share_target?.method === "POST"
  );

  r = await fetch(`${BASE}/icons/192`);
  check("192 icon serves a PNG", r.ok && (r.headers.get("content-type") || "").includes("image/png"), r.headers.get("content-type"));
  r = await fetch(`${BASE}/icons/512`);
  check("512 icon serves a PNG", r.ok && (r.headers.get("content-type") || "").includes("image/png"), r.headers.get("content-type"));

  // Share a file straight to the endpoint, as an installed app would.
  const pdf3 = await makePdf(4);
  const fdShare = new FormData();
  fdShare.append("files", new Blob([pdf3], { type: "application/pdf" }), "shared.pdf");
  r = await fetch(`${BASE}/s/demo/share`, { method: "POST", body: fdShare, redirect: "manual" });
  check("share endpoint redirects (3xx) on success", r.status >= 300 && r.status < 400, `status ${r.status}`);
  const shareLoc = r.headers.get("location") || "";
  check("share redirects straight to the order status page", /\/o\/[^/]+$/.test(shareLoc), shareLoc);
  const sharedOrderId = shareLoc.split("/o/")[1];
  r = await fetch(`${BASE}/api/orders/${sharedOrderId}`);
  const sharedOrder = await r.json();
  check("shared order was actually created", sharedOrder.status === "waiting", JSON.stringify(sharedOrder));

  // No files -> redirected back to the kiosk with an error flag, not a 500.
  r = await fetch(`${BASE}/s/demo/share`, { method: "POST", body: new FormData(), redirect: "manual" });
  check(
    "share with no files redirects back with shareError",
    r.status >= 300 && r.status < 400 && (r.headers.get("location") || "").includes("shareError"),
    r.headers.get("location")
  );

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
