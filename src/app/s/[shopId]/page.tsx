"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { timeAgo } from "@/lib/format";
import type { OrderOptions, OrderStatus } from "@/lib/types";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/jpeg,image/png,image/heic,image/webp";
const ALLOWED = /\.(pdf|docx?|xlsx?|pptx?|jpe?g|png|heic|webp)$/i;
const MAX_BYTES = 50 * 1024 * 1024;

interface ShopInfo {
  name: string;
  isOpen: boolean;
  accepting: boolean;
  currency: string;
}
interface PublicFile {
  id: string;
  name: string;
  downloadUrl: string;
}
interface PublicOrder {
  id: string;
  code: string;
  status: OrderStatus;
  createdAt: number;
  pages: number;
  billedPages: number;
  price: number;
  priceLabel: string;
  options: OrderOptions;
  fileCount: number;
  files: PublicFile[];
}
interface PublicQueue {
  orders: PublicOrder[];
  totals: { count: number; revenue: number; revenueLabel: string };
}

const STATUS_META: Record<string, { label: string; classes: string }> = {
  waiting: { label: "Gözləyir", classes: "bg-green-100 text-green-700" },
  printing: { label: "Çap olunur", classes: "bg-blue-100 text-blue-700" },
  ready: { label: "Hazırdır", classes: "bg-amber-100 text-amber-700" },
  deleted: { label: "Çap edilib", classes: "bg-neutral-200 text-neutral-600" },
};

// One shared, unauthenticated screen for both sides, by explicit choice: the
// left panel is a one-click upload (color + single/double-sided pickable, the
// rest defaulted); the right panel is a live queue where staff can print,
// mark ready, cancel, and download files directly — no passcode gate. That
// trade-off (anyone with the link can act on any order) was a deliberate
// choice over the more locked-down /dashboard, which still exists separately.
export default function ShopKiosk() {
  const { shopId } = useParams<{ shopId: string }>();

  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);

  const [shareError, setShareError] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("shareError")) {
      setShareError(true);
      window.history.replaceState(null, "", `/s/${shopId}`);
    }
  }, [shopId]);

  return (
    <main className="min-h-screen bg-neutral-100 dark:bg-neutral-950">
      <Header shopId={shopId} shop={shop} onShop={setShop} onError={setShopError} />
      {shopError ? (
        <Centered>{shopError}</Centered>
      ) : !shop ? (
        <Centered>Yüklənir…</Centered>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-2">
          <UploadPanel shopId={shopId} closed={!shop.isOpen || !shop.accepting} shareError={shareError} />
          <QueuePanel shopId={shopId} />
        </div>
      )}
    </main>
  );
}

/* --------------------------------- Header -------------------------------- */

function Header({
  shopId,
  shop,
  onShop,
  onError,
}: {
  shopId: string;
  shop: ShopInfo | null;
  onShop: (s: ShopInfo) => void;
  onError: (e: string) => void;
}) {
  useEffect(() => {
    fetch(`/api/shop/${shopId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(onShop)
      .catch(() => onError("Müəssisə tapılmadı."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopId]);

  const closed = shop ? !shop.isOpen || !shop.accepting : false;

  return (
    <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
            <PrinterIcon />
          </span>
          <span className="text-lg font-bold">{shop?.name || "Print Müəssisəsi"}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {shop && (
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 font-medium ${
                closed
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${closed ? "bg-red-500" : "bg-green-500"}`} />
              {shop.isOpen ? (shop.accepting ? "Açıqdır" : "Fasilədədir") : "Bağlıdır"}
            </span>
          )}
          <InstallButton />
          <span className="flex items-center gap-1 text-neutral-500" title="Fayllar çapdan sonra silinir.">
            Kömək lazımdır? <HelpIcon />
          </span>
        </div>
      </div>
    </header>
  );
}

// Android/Chrome only: lets someone install this shop's kiosk screen to their
// home screen, which is what registers it as a Share Target (see
// manifest.webmanifest) — after that, sharing a file from WhatsApp straight
// to the app skips the "save it first" step entirely. No equivalent exists on
// iOS Safari; the button simply never appears there since the browser never
// fires this event.
function InstallButton() {
  const [prompt, setPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt) return null;

  return (
    <button
      className="rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-brand hover:bg-brand/20"
      onClick={async () => {
        prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
    >
      📲 Tətbiq kimi quraşdır
    </button>
  );
}

/* ------------------------------ Upload panel ------------------------------ */

function UploadPanel({ shopId, closed, shareError }: { shopId: string; closed: boolean; shareError?: boolean }) {
  const [phase, setPhase] = useState<"idle" | "uploading" | "sending" | "done">("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [color, setColor] = useState(false);
  const [duplex, setDuplex] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);
  const pendingFiles = useRef<File[] | null>(null);

  const run = useCallback(
    (list: File[]) => {
      pendingFiles.current = list;
      setError(null);
      setFileName(list.length === 1 ? list[0].name : `${list.length} fayl`);
      setPhase("uploading");
      setPct(0);

      const fd = new FormData();
      fd.append("shopId", shopId);
      for (const f of list) fd.append("files", f);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/quote");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = async () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          let msg = "Yükləmə uğursuz oldu.";
          try {
            msg = JSON.parse(xhr.responseText).error || msg;
          } catch {}
          setError(msg);
          setPhase("idle");
          return;
        }
        const staged = JSON.parse(xhr.responseText);
        setPhase("sending");
        try {
          const res = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ shopId, quoteId: staged.quoteId, options: { color, duplex } }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Sifariş göndərilə bilmədi.");
          setLastCode(data.code);
          setPhase("done");
        } catch (e: any) {
          setError(e.message || "Sifariş göndərilə bilmədi.");
          setPhase("idle");
        }
      };
      xhr.onerror = () => {
        setError("Yükləmə zamanı bağlantı kəsildi.");
        setPhase("idle");
      };
      xhr.send(fd);
    },
    [shopId, color, duplex]
  );

  function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    const picked = Array.from(list);
    const bad = picked.find((f) => !ALLOWED.test(f.name));
    if (bad) {
      setError(`Dəstəklənməyən fayl növü: ${bad.name}`);
      return;
    }
    const big = picked.find((f) => f.size > MAX_BYTES);
    if (big) {
      setError(`${big.name} 50 MB limitini keçir.`);
      return;
    }
    run(picked);
  }

  function retry() {
    if (pendingFiles.current) run(pendingFiles.current);
  }

  function reset() {
    setPhase("idle");
    setError(null);
    setFileName(null);
    setLastCode(null);
    setColor(false);
    setDuplex(false);
  }

  const busy = phase === "uploading" || phase === "sending";

  return (
    <section className="card flex flex-col items-center justify-center gap-5 p-10 text-center">
      {phase === "done" ? (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand/10">
            <span className="text-4xl">✅</span>
          </div>
          <div>
            <div className="text-sm text-neutral-500">Sifariş kodunuz</div>
            <div className="text-4xl font-black tracking-tight text-brand">{lastCode}</div>
          </div>
          <p className="text-sm text-neutral-500">
            Sağdakı növbəyə baxın — hazır olduqda işçilər kodunuzu çağıracaq.
          </p>
          <button className="btn-primary px-6 py-2.5" onClick={reset}>
            + Fayl əlavə et
          </button>
        </>
      ) : busy ? (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand/10">
            <CloudUploadIcon className="h-12 w-12 text-brand animate-pulse" />
          </div>
          <div className="w-full max-w-xs">
            <div className="truncate text-sm text-neutral-500">{fileName}</div>
            <div className="my-2 text-lg font-semibold">
              {phase === "uploading" ? `Yüklənir… ${pct}%` : "Müəssisəyə göndərilir…"}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${phase === "uploading" ? pct : 100}%` }}
              />
            </div>
          </div>
        </>
      ) : (
        <>
          <PrinterIllustration className="h-28 w-auto" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10">
            <CloudUploadIcon className="h-8 w-8 text-brand" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Fayllarınızı Yükləyin</h1>
            <p className="mt-1 text-neutral-500">Qalanını biz həll edəcəyik</p>
          </div>
          <button
            className="btn-primary px-6 py-3 text-base"
            onClick={() => fileInput.current?.click()}
            disabled={closed}
          >
            + Fayl əlavə et
          </button>
          <button
            className="text-sm font-medium text-brand hover:underline"
            onClick={() => camInput.current?.click()}
            disabled={closed}
          >
            📷 Və ya sənədi şəkilə çəkin
          </button>

          <div className="grid w-full max-w-xs grid-cols-2 gap-2">
            <MiniPick label="🎨 Rəngli" active={color} onClick={() => setColor(true)} />
            <MiniPick label="⬛ Sadə" active={!color} onClick={() => setColor(false)} />
            <MiniPick label="1 tərəfli" active={!duplex} onClick={() => setDuplex(false)} />
            <MiniPick label="2 tərəfli" active={duplex} onClick={() => setDuplex(true)} />
          </div>

          <p className="text-xs text-neutral-400">
            Dəstəklənir: PDF, DOC, DOCX, XLSX, PPTX, JPG, PNG, HEIC
            <br />
            Maksimum fayl ölçüsü: hər fayl üçün 50 MB
          </p>
        </>
      )}

      {closed && !busy && phase !== "done" && (
        <p className="text-sm font-medium text-red-600">Bu müəssisə hazırda sifariş qəbul etmir.</p>
      )}
      {shareError && !busy && phase !== "done" && (
        <div className="w-full max-w-xs rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Paylaşılan fayl göndərilmədi. Yenidən cəhd edin və ya aşağıdan "Fayl əlavə et" ilə seçin.
        </div>
      )}
      {error && (
        <div className="flex w-full max-w-xs items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <span>{error}</span>
          <button className="btn-ghost px-3 py-1.5 text-xs" onClick={retry}>
            Yenidən cəhd et
          </button>
        </div>
      )}

      <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => onPick(e.target.files)} />
      <input
        ref={camInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />

      <div className="mt-2 flex items-center gap-2 border-t border-neutral-100 pt-5 text-xs text-neutral-500 dark:border-neutral-800">
        <ShieldIcon />
        Fayllarınız təhlükəsizdir və çapdan sonra silinəcək
      </div>
    </section>
  );
}

/* ------------------------------- Queue panel ------------------------------ */

function QueuePanel({ shopId }: { shopId: string }) {
  const [data, setData] = useState<PublicQueue | null>(null);
  const [connected, setConnected] = useState(false);
  const [lookup, setLookup] = useState("");
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const r = await fetch(`/api/public-queue?shopId=${shopId}`, { cache: "no-store" });
    if (r.ok) setData(await r.json());
  }, [shopId]);

  useEffect(() => {
    load();
    const es = new EventSource(`/api/public-stream?shopId=${shopId}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data);
        if (e.type === "new" || e.type === "update" || e.type === "deleted") load();
      } catch {}
    };
    const poll = setInterval(load, 8000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [load, shopId]);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = lookup.trim().toLowerCase();
    if (!q) return data.orders;
    return data.orders.filter((o) => o.code.toLowerCase().includes(q));
  }, [data, lookup]);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <section className="card flex flex-col p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold">Sifarişi tap</h2>
        <p className="text-sm text-neutral-500">İşçilər: ona keçmək üçün kod yazın.</p>
        <div className="mt-2 flex gap-2">
          <input
            className="input"
            placeholder="Kodu daxil edin (məs: A-47)"
            value={lookup}
            onChange={(e) => setLookup(e.target.value)}
          />
          {lookup && (
            <button className="btn-ghost px-4" onClick={() => setLookup("")}>
              Təmizlə
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 pt-4 dark:border-neutral-800">
        <h3 className="font-bold">Sifariş Növbəsi</h3>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${connected ? "text-green-600" : "text-neutral-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500" : "bg-neutral-400"}`} />
          Avtomatik yenilənmə
        </span>
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: 480 }}>
        {!data ? (
          <p className="p-6 text-center text-sm text-neutral-500">Yüklənir…</p>
        ) : filtered.length === 0 ? (
          <p className="p-6 text-center text-sm text-neutral-500">
            {lookup ? "Bu kodla sifariş tapılmadı." : "Hələ sifariş yoxdur."}
          </p>
        ) : (
          filtered.map((o) => (
            <QueueRow key={o.id} o={o} now={now} highlight={!!lookup} onStatus={setStatus} />
          ))
        )}
      </div>

      {data && (
        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4 text-sm dark:border-neutral-800">
          <span className="text-neutral-500">
            Ümumi sifariş: <strong className="text-neutral-900 dark:text-neutral-100">{data.totals.count}</strong>
          </span>
          <span className="text-neutral-500">
            Ümumi gəlir: <strong className="text-neutral-900 dark:text-neutral-100">{data.totals.revenueLabel}</strong>
          </span>
        </div>
      )}
    </section>
  );
}

function QueueRow({
  o,
  now,
  highlight,
  onStatus,
}: {
  o: PublicOrder;
  now: number;
  highlight: boolean;
  onStatus: (id: string, status: string) => void;
}) {
  const meta = STATUS_META[o.status] || STATUS_META.waiting;
  const opt = o.options;
  const summary = [
    `${o.pages} səh`,
    opt.color ? "Rəngli" : "Qara-ağ",
    opt.duplex ? "2 tərəfli" : "1 tərəfli",
    `${opt.copies} nüsxə`,
  ].join(" · ");
  const filesLabel =
    o.status === "deleted"
      ? `${o.fileCount} fayl · çapdan sonra silinib`
      : o.files.map((f) => f.name).join(", ");

  return (
    <div
      className={`rounded-xl border p-3 ${
        highlight
          ? "border-brand/40 bg-brand/5 dark:border-brand/40 dark:bg-brand/10"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-black tracking-tight">{o.code}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.classes}`}>{meta.label}</span>
          </div>
          <div className="text-xs text-neutral-400">{now ? timeAgo(o.createdAt, now) : ""}</div>
          <div className="mt-1 truncate text-sm">{filesLabel}</div>
          <div className="text-xs text-neutral-500">{summary}</div>
        </div>
        <div className="shrink-0 text-right font-bold">{o.priceLabel}</div>
      </div>

      {o.status !== "deleted" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {o.files.map((f) => (
            <a
              key={f.id}
              href={f.downloadUrl}
              download
              className="btn-ghost px-2.5 py-1.5 text-xs"
              title={`Yüklə: ${f.name}`}
            >
              ⬇ {o.files.length > 1 ? f.name.slice(0, 14) : "Yüklə"}
            </a>
          ))}
          {o.status === "waiting" && (
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => onStatus(o.id, "printing")}>
              🖨 Çap et
            </button>
          )}
          {o.status === "printing" && (
            <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => onStatus(o.id, "ready")}>
              ✅ Hazırdır et
            </button>
          )}
          {o.status !== "ready" && (
            <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => onStatus(o.id, "cancelled")}>
              Ləğv et
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MiniPick({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`tap p-2.5 text-sm ${active ? "border-brand bg-brand text-white" : "tap-idle"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/* --------------------------------- Icons --------------------------------- */

function PrinterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A friendlier, more decorative printer illustration for the customer-facing
// upload panel — a bigger visual cue that this is a print shop, not just a
// generic "upload files" box.
function PrinterIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className}>
      <rect x="18" y="34" width="84" height="40" rx="8" fill="#5B4FE9" />
      <rect x="28" y="14" width="64" height="28" rx="4" fill="#EDEBFF" stroke="#5B4FE9" strokeWidth="2" />
      <rect x="34" y="20" width="52" height="4" rx="2" fill="#5B4FE9" opacity="0.5" />
      <rect x="34" y="28" width="38" height="4" rx="2" fill="#5B4FE9" opacity="0.3" />
      <circle cx="90" cy="46" r="3.5" fill="#7BE0A8" />
      <rect x="30" y="70" width="60" height="26" rx="3" fill="#ffffff" stroke="#5B4FE9" strokeWidth="2" />
      <rect x="38" y="78" width="44" height="3" rx="1.5" fill="#C9C4F7" />
      <rect x="38" y="85" width="30" height="3" rx="1.5" fill="#C9C4F7" />
    </svg>
  );
}

function CloudUploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
      <path
        d="M7 18a4.5 4.5 0 0 1-.6-8.96A5.5 5.5 0 0 1 17.3 8.1 4 4 0 0 1 17 16"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 12v7m0-7 3 3m-3-3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 text-green-600">
      <path
        d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 1-1 1.7" strokeLinecap="round" />
      <path d="M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-center text-neutral-500">{children}</div>
  );
}
