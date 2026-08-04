"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface Status {
  code: string;
  status: "waiting" | "printing" | "ready" | "cancelled" | "deleted";
  ahead: number;
  priceLabel: string;
  pages: number;
  billedPages: number;
  fileCount: number;
  firstName?: string;
}

const STEPS = [
  { key: "waiting", label: "Gözləyir", icon: "🕓" },
  { key: "printing", label: "Çap olunur", icon: "🖨️" },
  { key: "ready", label: "Hazırdır", icon: "✅" },
] as const;

export default function OrderStatus() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Status | null>(null);
  const [notFound, setNotFound] = useState(false);
  const prevStatus = useRef<string | null>(null);

  async function refresh() {
    try {
      const r = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      if (r.status === 404) {
        setNotFound(true);
        return;
      }
      const d = await r.json();
      setData(d);
    } catch {
      /* keep last known */
    }
  }

  useEffect(() => {
    refresh();
    const es = new EventSource(`/api/orders/${id}/stream`);
    es.onmessage = (ev) => {
      try {
        const e = JSON.parse(ev.data);
        if (e.type === "update" || e.type === "deleted" || e.type === "new") refresh();
      } catch {}
    };
    // Poll as a fallback for flaky SSE.
    const poll = setInterval(refresh, 5000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [id]);

  // Alert the customer when the order becomes Ready.
  useEffect(() => {
    if (!data) return;
    if (prevStatus.current && prevStatus.current !== data.status && data.status === "ready") {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {}
      try {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Sifarişiniz hazırdır!", { body: `${data.code} sifarişi almağa hazırdır.` });
        }
      } catch {}
    }
    prevStatus.current = data.status;
  }, [data]);

  function askNotify() {
    if ("Notification" in window) Notification.requestPermission();
  }

  if (notFound) {
    return (
      <Centered>
        <div className="text-5xl">🗑️</div>
        <p className="mt-4 text-lg font-semibold">Bu sifariş artıq mövcud deyil</p>
        <p className="mt-1 text-neutral-500">
          Çap edilib və faylları serverdən həmişəlik silinib.
        </p>
      </Centered>
    );
  }
  if (!data) return <Centered>Yüklənir…</Centered>;

  const stepIndex = STEPS.findIndex((s) => s.key === data.status);
  const cancelled = data.status === "cancelled";
  const deleted = data.status === "deleted";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center p-6 text-center">
      <p className="mt-6 text-sm uppercase tracking-wide text-neutral-500">Sifariş kodunuz</p>
      <div className="my-2 rounded-3xl border-2 border-brand px-10 py-6">
        <span className="text-6xl font-black tracking-tight text-brand">{data.code}</span>
      </div>
      {data.firstName && <p className="text-neutral-500">{data.firstName} üçün</p>}

      {deleted ? (
        <div className="mt-8">
          <div className="text-4xl">✅</div>
          <p className="mt-3 text-lg font-semibold">Çap edilib və götürülüb</p>
          <p className="mt-1 text-neutral-500">Fayllarınız həmişəlik silinib.</p>
        </div>
      ) : cancelled ? (
        <div className="mt-8">
          <div className="text-4xl">✖️</div>
          <p className="mt-3 text-lg font-semibold">Sifariş ləğv edilib</p>
          <p className="mt-1 text-neutral-500">Zəhmət olmasa müəssisə ilə əlaqə saxlayın.</p>
        </div>
      ) : (
        <>
          {/* Progress steps */}
          <div className="mt-8 flex w-full items-center justify-between">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const active = i === stepIndex;
              return (
                <div key={s.key} className="flex flex-1 flex-col items-center">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl transition ${
                      active
                        ? "bg-brand text-white shadow-lg animate-pop"
                        : done
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                        : "bg-neutral-200 text-neutral-400 dark:bg-neutral-800"
                    }`}
                  >
                    {s.icon}
                  </div>
                  <span className={`mt-2 text-sm ${active ? "font-bold text-brand" : "text-neutral-500"}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {data.status === "waiting" && (
            <p className="mt-8 text-lg">
              {data.ahead === 0 ? (
                <span className="font-semibold">Növbədə sizsiniz.</span>
              ) : (
                <>
                  Sizdən qabaqda <span className="font-semibold">{data.ahead}</span> sifariş var.
                </>
              )}
            </p>
          )}
          {data.status === "printing" && (
            <p className="mt-8 text-lg font-semibold text-brand">Sifarişiniz indi çap olunur…</p>
          )}
          {data.status === "ready" && (
            <p className="mt-8 text-xl font-bold text-green-600 dark:text-green-400">
              🎉 Almağa hazırdır!
            </p>
          )}

          <button className="btn-ghost mt-8 text-sm" onClick={askNotify}>
            🔔 Hazır olanda xəbər ver
          </button>
        </>
      )}

      <div className="mt-auto w-full pt-10">
        <div className="card p-4 text-left text-sm text-neutral-500">
          <div className="flex justify-between">
            <span>Fayllar</span>
            <span>{data.fileCount}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Çap olunan səhifələr</span>
            <span>{data.billedPages}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Cəmi</span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">{data.priceLabel}</span>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-neutral-500">
          🔒 Fayllar çapdan sonra serverlərimizdən həmişəlik silinir.
        </p>
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">{children}</main>
  );
}
