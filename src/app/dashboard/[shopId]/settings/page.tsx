"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

interface ShopSettings {
  name: string;
  address: string;
  hours: string;
  isOpen: boolean;
  accepting: boolean;
  passcode?: string;
}

export default function Settings() {
  const { shopId } = useParams<{ shopId: string }>();
  const [s, setS] = useState<ShopSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string>("");
  const [customerUrl, setCustomerUrl] = useState("");
  const [revealPasscode, setRevealPasscode] = useState(false);

  useEffect(() => {
    fetch(`/api/shop/${shopId}`)
      .then((r) => r.json())
      .then((d) =>
        setS({
          name: d.name,
          address: d.address,
          hours: d.hours,
          isOpen: d.isOpen,
          accepting: d.accepting,
          passcode: d.passcode,
        })
      );
    const url = `${window.location.origin}/s/${shopId}`;
    setCustomerUrl(url);
    QRCode.toDataURL(url, { width: 640, margin: 1 }).then(setQr).catch(() => {});
  }, [shopId]);

  function patch(p: Partial<ShopSettings>) {
    if (!s) return;
    setSaved(false);
    setS({ ...s, ...p });
  }

  async function save() {
    if (!s) return;
    setBusy(true);
    await fetch(`/api/shop/${shopId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setBusy(false);
    setSaved(true);
  }

  // Persist a toggle immediately (open/closed, pause) — these are used live.
  async function toggle(p: Partial<ShopSettings>) {
    patch(p);
    await fetch(`/api/shop/${shopId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  }

  async function regeneratePasscode() {
    if (!confirm("Yeni parol yaradılsın? Köhnə parol dərhal işləməyi dayandıracaq.")) return;
    const res = await fetch(`/api/shop/${shopId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regeneratePasscode: true }),
    });
    const data = await res.json();
    patch({ passcode: data.passcode });
    setRevealPasscode(true);
  }

  function printPoster() {
    if (!qr || !s) return;
    const w = window.open("", "_blank", "width=595,height=842");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${s.name} — QR</title>
      <style>
        @page { size: A5; margin: 12mm; }
        body { font-family: system-ui, sans-serif; text-align: center; color: #111; }
        h1 { font-size: 28px; margin: 0 0 4px; }
        p.sub { color: #555; margin: 0 0 18px; }
        img { width: 340px; height: 340px; }
        ol { display:inline-block; text-align:left; font-size:18px; line-height:1.8; margin-top:16px; }
        .foot { margin-top: 18px; font-size: 13px; color:#666; }
      </style></head><body>
      <h1>${s.name}</h1>
      <p class="sub">Burada çap edin — tətbiq yox, qeydiyyat yox</p>
      <img src="${qr}" />
      <ol><li>📷 Bu kodu skan edin</li><li>📄 Faylınızı yükləyin</li><li>✅ Hazır — çaplarınızı götürün</li></ol>
      <p class="foot">🔒 Fayllar çapdan sonra həmişəlik silinir.</p>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  if (!s) return <p className="text-neutral-500">Yüklənir…</p>;

  return (
    <div className="grid max-w-4xl gap-6 md:grid-cols-2">
      {/* Shop details */}
      <div>
        <h1 className="text-2xl font-bold">Müəssisə ayarları</h1>

        <div className="mt-4 grid gap-3">
          <Field label="Müəssisənin adı">
            <input className="input" value={s.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Field label="Ünvan">
            <input className="input" value={s.address} onChange={(e) => patch({ address: e.target.value })} />
          </Field>
          <Field label="İş saatları">
            <input className="input" value={s.hours} onChange={(e) => patch({ hours: e.target.value })} />
          </Field>
        </div>

        <div className="card mt-4 divide-y divide-neutral-100 dark:divide-neutral-800">
          <ToggleRow
            label="Müəssisə açıqdır"
            desc="Bağlı olduqda müştərilərə 'Bağlıdır' nişanı göstərilir."
            on={s.isOpen}
            onChange={(v) => toggle({ isOpen: v })}
          />
          <ToggleRow
            label="Yeni sifariş qəbul edir"
            desc="Növbə uzun olduqda fasilə verin — mövcud sifarişlər davam edir."
            on={s.accepting}
            onChange={(v) => toggle({ accepting: v })}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary px-6 py-2.5" onClick={save} disabled={busy}>
            {busy ? "Yadda saxlanılır…" : "Məlumatları yadda saxla"}
          </button>
          {saved && <span className="text-sm text-green-600">Yadda saxlanıldı ✓</span>}
        </div>

        <h2 className="mt-6 font-semibold">Panel parolu</h2>
        <div className="card mt-2 flex items-center justify-between p-4">
          <div>
            <div className="text-xs text-neutral-500">/dashboard/{shopId} ünvanına daxil olmaq üçün lazımdır</div>
            <div className="mt-1 font-mono text-2xl tracking-widest">
              {revealPasscode ? s.passcode : "••••"}
            </div>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost px-3 py-2 text-sm" onClick={() => setRevealPasscode((v) => !v)}>
              {revealPasscode ? "Gizlət" : "Göstər"}
            </button>
            <button className="btn-ghost px-3 py-2 text-sm" onClick={regeneratePasscode}>
              Yenilə
            </button>
          </div>
        </div>
      </div>

      {/* QR */}
      <div>
        <h2 className="text-2xl font-bold">QR kodunuz</h2>
        <p className="text-sm text-neutral-500">Bunu çap edib divara yapışdırın.</p>
        <div className="card mt-3 flex flex-col items-center p-6">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt="Müəssisə QR kodu" className="h-56 w-56" />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          )}
          <code className="mt-3 break-all text-center text-xs text-neutral-500">{customerUrl}</code>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary px-4 py-2" onClick={printPoster}>
              🖨 A5 poster çap et
            </button>
            <a className="btn-ghost px-4 py-2" href={qr} download={`qr-${shopId}.png`}>
              ⬇ PNG yüklə
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-600 dark:text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  desc,
  on,
  onChange,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3">
      <div className="pr-4">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-neutral-500">{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700"}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-1"}`} />
      </button>
    </div>
  );
}
