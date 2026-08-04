"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { PriceTable } from "@/lib/types";

const ROWS: { key: keyof PriceTable; label: string }[] = [
  { key: "a4_bw_single", label: "A4 · Qara-ağ · 1 tərəfli" },
  { key: "a4_bw_double", label: "A4 · Qara-ağ · 2 tərəfli" },
  { key: "a4_color_single", label: "A4 · Rəngli · 1 tərəfli" },
  { key: "a4_color_double", label: "A4 · Rəngli · 2 tərəfli" },
  { key: "a3_bw_single", label: "A3 · Qara-ağ · 1 tərəfli" },
  { key: "a3_bw_double", label: "A3 · Qara-ağ · 2 tərəfli" },
  { key: "a3_color_single", label: "A3 · Rəngli · 1 tərəfli" },
  { key: "a3_color_double", label: "A3 · Rəngli · 2 tərəfli" },
];

export default function Prices() {
  const { shopId } = useParams<{ shopId: string }>();
  const [prices, setPrices] = useState<PriceTable | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/shop/${shopId}`)
      .then((r) => r.json())
      .then((d) => setPrices(d.prices));
  }, [shopId]);

  function set(key: keyof PriceTable, value: string) {
    if (!prices) return;
    setSaved(false);
    setPrices({ ...prices, [key]: key === "currency" ? value : Number(value) });
  }

  async function save() {
    if (!prices) return;
    setBusy(true);
    await fetch(`/api/shop/${shopId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prices }),
    });
    setBusy(false);
    setSaved(true);
  }

  if (!prices) return <p className="text-neutral-500">Yüklənir…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Qiymətlər</h1>
      <p className="text-sm text-neutral-500">Səhifə başına qiymətlər. Müştərilərin gördüyü qiyməti bunlar müəyyən edir.</p>

      <div className="card mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between p-3">
            <span className="text-sm">{row.label}</span>
            <div className="flex items-center gap-1">
              <span className="text-neutral-400">{prices.currency}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input w-24 text-right"
                value={prices[row.key] as number}
                onChange={(e) => set(row.key, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-6 font-semibold">Cildləmə (nüsxə başına)</h2>
      <div className="card mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
        <Row label="Spiral" cur={prices.currency}>
          <input type="number" step="0.01" min="0" className="input w-24 text-right"
            value={prices.binding_spiral} onChange={(e) => set("binding_spiral", e.target.value)} />
        </Row>
        <Row label="Plastik üzlük" cur={prices.currency}>
          <input type="number" step="0.01" min="0" className="input w-24 text-right"
            value={prices.binding_sleeve} onChange={(e) => set("binding_sleeve", e.target.value)} />
        </Row>
      </div>

      <h2 className="mt-6 font-semibold">Həcm endirimi</h2>
      <div className="card mt-2 divide-y divide-neutral-100 dark:divide-neutral-800">
        <Row label="… səhifədən çox olduqda tətbiq olunur">
          <input type="number" step="1" min="0" className="input w-24 text-right"
            value={prices.bulkThreshold} onChange={(e) => set("bulkThreshold", e.target.value)} />
        </Row>
        <Row label="Hədd üzərindəki səhifə qiyməti (0 = deaktiv)" cur={prices.currency}>
          <input type="number" step="0.01" min="0" className="input w-24 text-right"
            value={prices.bulkPerPage} onChange={(e) => set("bulkPerPage", e.target.value)} />
        </Row>
        <Row label="Valyuta işarəsi">
          <input className="input w-24 text-right" maxLength={3}
            value={prices.currency} onChange={(e) => set("currency", e.target.value)} />
        </Row>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary px-6 py-2.5" onClick={save} disabled={busy}>
          {busy ? "Yadda saxlanılır…" : "Qiymətləri yadda saxla"}
        </button>
        {saved && <span className="text-sm text-green-600">Yadda saxlanıldı ✓</span>}
      </div>
    </div>
  );
}

function Row({ label, cur, children }: { label: string; cur?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        {cur && <span className="text-neutral-400">{cur}</span>}
        {children}
      </div>
    </div>
  );
}
