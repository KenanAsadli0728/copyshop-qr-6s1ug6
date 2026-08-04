"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Report {
  currency: string;
  today: {
    orders: number;
    pages: number;
    revenue: number;
    revenueLabel: string;
    color: number;
    bw: number;
    hours: number[];
  };
  compare: {
    weekRevenueLabel: string;
    lastWeekRevenueLabel: string;
    weekRevenue: number;
    lastWeekRevenue: number;
    monthRevenueLabel: string;
    lastMonthRevenueLabel: string;
    monthRevenue: number;
    lastMonthRevenue: number;
  };
}

export default function ReportPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const [r, setR] = useState<Report | null>(null);

  useEffect(() => {
    fetch(`/api/report?shopId=${shopId}`)
      .then((res) => res.json())
      .then(setR);
  }, [shopId]);

  if (!r) return <p className="text-neutral-500">Yüklənir…</p>;

  const maxHour = Math.max(1, ...r.today.hours);
  const totalCol = r.today.color + r.today.bw || 1;
  const colorPct = Math.round((r.today.color / totalCol) * 100);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Bu günün hesabatı</h1>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Tile label="Sifarişlər" value={String(r.today.orders)} />
        <Tile label="Çap olunan səhifələr" value={String(r.today.pages)} />
        <Tile label="Gəlir" value={r.today.revenueLabel} highlight />
      </div>

      <h2 className="mt-6 font-semibold">Ən yoğun saatlar</h2>
      <div className="card mt-2 p-4">
        <div className="flex h-32 items-end gap-1">
          {r.today.hours.map((c, h) => (
            <div key={h} className="flex flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t bg-brand/80"
                style={{ height: `${(c / maxHour) * 100}%`, minHeight: c > 0 ? 4 : 0 }}
                title={`${h}:00 saatında ${c}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
          <span>00h</span>
          <span>06h</span>
          <span>12h</span>
          <span>18h</span>
          <span>23h</span>
        </div>
      </div>

      <h2 className="mt-6 font-semibold">Rəngli vs qara-ağ</h2>
      <div className="card mt-2 p-4">
        <div className="flex h-4 overflow-hidden rounded-full">
          <div className="bg-brand" style={{ width: `${colorPct}%` }} />
          <div className="bg-neutral-400" style={{ width: `${100 - colorPct}%` }} />
        </div>
        <div className="mt-2 flex justify-between text-sm text-neutral-500">
          <span>🎨 Rəngli: {r.today.color} ({colorPct}%)</span>
          <span>⬛ Qara-ağ: {r.today.bw} ({100 - colorPct}%)</span>
        </div>
      </div>

      <h2 className="mt-6 font-semibold">Tendensiyalar</h2>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <Compare
          title="Bu həftə / keçən həftə"
          now={r.compare.weekRevenueLabel}
          prev={r.compare.lastWeekRevenueLabel}
          delta={pctDelta(r.compare.weekRevenue, r.compare.lastWeekRevenue)}
        />
        <Compare
          title="Bu ay / keçən ay"
          now={r.compare.monthRevenueLabel}
          prev={r.compare.lastMonthRevenueLabel}
          delta={pctDelta(r.compare.monthRevenue, r.compare.lastMonthRevenue)}
        />
      </div>

      <p className="mt-6 text-xs text-neutral-400">
        Qeyd: sifariş qeydləri hesabat üçün saxlanılır; faylların özü çapdan sonra hələ də həmişəlik silinir.
      </p>
    </div>
  );
}

function pctDelta(now: number, prev: number): number | null {
  if (prev === 0) return now > 0 ? 100 : null;
  return Math.round(((now - prev) / prev) * 100);
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? "ring-1 ring-brand" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function Compare({ title, now, prev, delta }: { title: string; now: string; prev: string; delta: number | null }) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{now}</span>
        {delta !== null && (
          <span className={`text-sm font-semibold ${up ? "text-green-600" : "text-red-600"}`}>
            {up ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="text-xs text-neutral-400">əvvəlki: {prev}</div>
    </div>
  );
}
