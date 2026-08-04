"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { timeAgo, clockTime, bytes } from "@/lib/format";
import type { OrderOptions } from "@/lib/types";

interface QFile {
  id: string;
  name: string;
  pages: number;
  size: number;
  convertPending: boolean;
  previewUrl: string;
}
interface QOrder {
  id: string;
  code: string;
  firstName?: string;
  status: "waiting" | "printing" | "ready" | "cancelled";
  createdAt: number;
  printedAt?: number;
  pages: number;
  billedPages: number;
  price: number;
  priceLabel: string;
  options: OrderOptions;
  files: QFile[];
}

export default function Queue() {
  const { shopId } = useParams<{ shopId: string }>();
  const [orders, setOrders] = useState<QOrder[]>([]);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => 0);
  const audioCtx = useRef<AudioContext | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const seenIds = useRef<Set<string> | null>(null); // null until the first load, so the initial batch never "beeps"

  // Beep via WebAudio — no asset needed. Must be unlocked by a user gesture.
  const beep = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = audioCtx.current;
    if (!ctx) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.36);
  }, []);

  // Detects genuinely new orders on every poll (not just via SSE), so the
  // sound alert still works even where SSE can't deliver anything — e.g. on
  // Netlify, where each request is an isolated serverless invocation and the
  // in-process event bus that SSE relies on shares no memory between them.
  const load = useCallback(async () => {
    const r = await fetch(`/api/queue?shopId=${shopId}`, { cache: "no-store" });
    if (!r.ok) return;
    const d = await r.json();
    const ids = new Set<string>(d.orders.map((o: QOrder) => o.id));
    if (seenIds.current) {
      const hasNew = [...ids].some((oid) => !seenIds.current!.has(oid));
      if (hasNew) {
        beep();
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      }
    }
    seenIds.current = ids;
    setOrders(d.orders);
  }, [shopId, beep]);

  function unlockAudio() {
    if (!audioCtx.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      audioCtx.current = new AC();
    }
    audioCtx.current.resume();
  }

  useEffect(() => {
    load();
    // SSE (works on traditional Node hosting) just triggers a reload — load()
    // itself decides whether to beep, so a "new" event and the poll below
    // reloading a moment later never double-beep for the same order.
    const es = new EventSource(`/api/stream?shopId=${shopId}`);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data);
        if (e.type === "new" || e.type === "update" || e.type === "deleted") load();
      } catch {}
    };
    // Polling fallback — the only mechanism that works on Netlify, where SSE
    // can't deliver anything (each request is an isolated invocation with no
    // shared memory with whatever published the event).
    const poll = setInterval(load, 5000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [load, shopId]);

  // Tick for relative timestamps.
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  async function setStatus(id: string, status: string) {
    await fetch(`/api/orders/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function setOptions(id: string, options: Partial<OrderOptions>) {
    await fetch(`/api/orders/${id}/options`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    load();
  }

  const active = orders.filter((o) => o.status !== "cancelled");

  return (
    <div onClick={unlockAudio}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Növbə</h1>
          <p className="text-sm text-neutral-500">
            {active.length} aktiv sifariş · ən köhnə əvvəldə
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className={`flex items-center gap-1.5 ${connected ? "text-green-600" : "text-neutral-400"}`}>
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-500" : "bg-neutral-400"}`} />
            {connected ? "Canlı" : "Yenidən qoşulur…"}
          </span>
          <button
            className="rounded-lg border border-neutral-300 px-2.5 py-1.5 dark:border-neutral-700"
            onClick={() => setMuted((m) => !m)}
          >
            {muted ? "🔇 Səssiz" : "🔔 Səs açıq"}
          </button>
        </div>
      </div>

      {flash && (
        <div className="mb-3 animate-pop rounded-xl bg-brand px-4 py-2 font-semibold text-white">
          Yeni sifariş alındı!
        </div>
      )}

      {active.length === 0 ? (
        <div className="card p-10 text-center text-neutral-500">
          Hələ sifariş yoxdur. Yeni sifarişlər səs siqnalı ilə burada görünəcək.
          <div className="mt-1 text-xs">(Səsi aktivləşdirmək üçün bir dəfə hər yerə toxunun.)</div>
        </div>
      ) : (
        <div className="grid gap-3">
          {active.map((o) => (
            <OrderCard key={o.id} o={o} now={now} onStatus={setStatus} onOptions={setOptions} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({
  o,
  now,
  onStatus,
  onOptions,
}: {
  o: QOrder;
  now: number;
  onStatus: (id: string, s: string) => void;
  onOptions: (id: string, options: Partial<OrderOptions>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const badge =
    o.status === "waiting"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      : o.status === "printing"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
      : "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  const statusLabel: Record<string, string> = {
    waiting: "Gözləyir",
    printing: "Çap olunur",
    ready: "Hazırdır",
    cancelled: "Ləğv edilib",
  };

  const opt = o.options;
  const bindingLabel: Record<string, string> = { spiral: "spiral", sleeve: "üzlük" };
  const summary = [
    `${o.pages} səh`,
    opt.color ? "Rəngli" : "Qara-ağ",
    opt.duplex ? "2 tərəfli" : "1 tərəfli",
    `${opt.copies} nüsxə`,
    opt.paper,
    opt.binding !== "none" ? bindingLabel[opt.binding] : null,
    opt.pageRange ? `səhifə ${opt.pageRange}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="card animate-pop p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black tracking-tight">{o.code}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${badge}`}>
              {statusLabel[o.status] || o.status}
            </span>
            {o.firstName && <span className="text-sm text-neutral-500">{o.firstName}</span>}
          </div>
          <div className="mt-1 text-sm text-neutral-500">
            {clockTime(o.createdAt)} · {now ? timeAgo(o.createdAt, now) : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-bold">{o.priceLabel}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
        {o.files.map((f) => (
          <span key={f.id} className="text-sm">
            <span className="font-medium">{f.name}</span>
            <span className="text-neutral-400"> ({bytes(f.size)}{f.convertPending ? ", ⚠ çevrilir" : ""})</span>
          </span>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
        <span>{summary}</span>
        {o.status !== "ready" && (
          <button
            className="text-xs font-medium text-brand hover:underline"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "bağla" : "düzəlt"}
          </button>
        )}
      </div>

      {editing && (
        <OptionsEditor
          options={o.options}
          onChange={(patch) => onOptions(o.id, patch)}
        />
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {o.files.map((f) => (
          <a key={f.id} href={f.previewUrl} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-sm">
            👁 Önizləmə {o.files.length > 1 ? f.name.slice(0, 12) : ""}
          </a>
        ))}
        {o.status === "waiting" && (
          <button className="btn-primary px-4 py-2 text-sm" onClick={() => onStatus(o.id, "printing")}>
            🖨 Çap et
          </button>
        )}
        {o.status === "printing" && (
          <button className="btn-primary px-4 py-2 text-sm" onClick={() => onStatus(o.id, "ready")}>
            ✅ Hazırdır et
          </button>
        )}
        {o.status !== "ready" && (
          <button className="btn-danger px-4 py-2 text-sm" onClick={() => onStatus(o.id, "cancelled")}>
            Ləğv et
          </button>
        )}
        {o.status === "ready" && (
          <span className="self-center text-sm text-green-600 dark:text-green-400">
            Hazırdır — götürüldükdən sonra avtomatik silinir
          </span>
        )}
      </div>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: OrderOptions;
  onChange: (patch: Partial<OrderOptions>) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800 sm:grid-cols-4">
      <MiniToggle label="Qara-ağ" active={!options.color} onClick={() => onChange({ color: false })} />
      <MiniToggle label="Rəngli" active={options.color} onClick={() => onChange({ color: true })} />
      <MiniToggle label="1 tərəfli" active={!options.duplex} onClick={() => onChange({ duplex: false })} />
      <MiniToggle label="2 tərəfli" active={options.duplex} onClick={() => onChange({ duplex: true })} />
      <MiniToggle label="A4" active={options.paper === "A4"} onClick={() => onChange({ paper: "A4" })} />
      <MiniToggle label="A3" active={options.paper === "A3"} onClick={() => onChange({ paper: "A3" })} />
      <MiniToggle label="Cildsiz" active={options.binding === "none"} onClick={() => onChange({ binding: "none" })} />
      <MiniToggle label="Spiral" active={options.binding === "spiral"} onClick={() => onChange({ binding: "spiral" })} />
      <MiniToggle label="Üzlük" active={options.binding === "sleeve"} onClick={() => onChange({ binding: "sleeve" })} />

      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <span className="text-xs text-neutral-500">Nüsxə</span>
        <button
          className="tap tap-idle h-8 w-8 text-lg"
          onClick={() => onChange({ copies: Math.max(1, options.copies - 1) })}
        >
          −
        </button>
        <span className="w-6 text-center font-semibold">{options.copies}</span>
        <button className="tap tap-idle h-8 w-8 text-lg" onClick={() => onChange({ copies: options.copies + 1 })}>
          +
        </button>
      </div>

      <div className="col-span-2 flex items-center gap-2 sm:col-span-3">
        <span className="shrink-0 text-xs text-neutral-500">Səhifə aralığı</span>
        <input
          className="input py-1 text-sm"
          placeholder="Bütün səhifələr"
          defaultValue={options.pageRange || ""}
          onBlur={(e) => onChange({ pageRange: e.target.value })}
        />
      </div>
    </div>
  );
}

function MiniToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`tap p-2 text-sm ${active ? "tap-on" : "tap-idle"}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
