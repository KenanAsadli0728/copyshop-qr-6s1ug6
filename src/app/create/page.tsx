"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Created {
  id: string;
  name: string;
  passcode: string;
}

export default function CreateShop() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qr, setQr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Müəssisə yaradıla bilmədi");
      setCreated(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const kioskUrl = created ? `${origin}/s/${created.id}` : "";

  useEffect(() => {
    if (!kioskUrl) return;
    QRCode.toDataURL(kioskUrl, { width: 240, margin: 1 }).then(setQr).catch(() => {});
  }, [kioskUrl]);

  if (created) {
    const dashUrl = `${origin}/dashboard/${created.id}`;
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-6">
        <div className="text-center">
          <div className="text-4xl">🎉</div>
          <h1 className="mt-2 text-2xl font-bold">{created.name} artıq fəaldır</h1>
          <p className="text-sm text-neutral-500">Bunları saxlayın — passcode yalnız bir dəfə göstərilir.</p>
        </div>

        <InfoCard icon={<ShopIcon />} iconClasses="bg-blue-100 text-blue-600" label="Müəssisə kodu">
          <div className="mt-1 flex items-center justify-between">
            <span className="text-3xl font-black tracking-widest">{created.id}</span>
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => copy(created.id, "code")}>
              {copied === "code" ? "Kopyalandı!" : "Kopyala"}
            </button>
          </div>
        </InfoCard>

        <InfoCard icon={<ShieldIcon />} iconClasses="bg-brand/10 text-brand" label="İdarəetmə parolu">
          <div className="mt-1 flex items-center justify-between">
            <span className="text-3xl font-black tracking-widest">{created.passcode}</span>
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => copy(created.passcode, "pass")}>
              {copied === "pass" ? "Kopyalandı!" : "Kopyala"}
            </button>
          </div>
        </InfoCard>

        <InfoCard icon={<LinkIcon />} iconClasses="bg-green-100 text-green-600" label="Müştəri + printçi linki">
          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-all text-sm">{kioskUrl}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Bunu divardakı QR koduna qoyun. Bu linkə sahib olan hər kəs fayl yükləyə və çap növbəsindən
                (çap et/hazırdır/ləğv et/yüklə) istifadə edə bilər — orada giriş tələb olunmur, bu qəsdəndir.
              </p>
              <a href={kioskUrl} className="btn-primary mt-3 inline-flex px-4 py-2 text-sm" target="_blank">
                Kiosk ekranını aç
              </a>
            </div>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Kiosk QR kodu" className="h-20 w-20 shrink-0 rounded-lg border border-neutral-200 dark:border-neutral-700" />
            )}
          </div>
        </InfoCard>

        <InfoCard icon={<CrownIcon />} iconClasses="bg-rose-100 text-rose-600" label="İdarəetmə paneli">
          <p className="mt-1 break-all text-sm">{dashUrl}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Qiymətlər, açıq/bağlı, günlük hesabat, QR poster. Yuxarıdakı parol tələb olunur.
          </p>
          <a href={dashUrl} className="btn-ghost mt-3 inline-flex px-4 py-2 text-sm" target="_blank">
            Paneli aç
          </a>
        </InfoCard>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Print müəssisənizi qurun</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Bir neçə saniyəyə unikal kod və parol alın — hesab tələb olunmur.
        </p>
        <input
          className="input mt-4"
          placeholder="Müəssisənin adı (məs: Mərkəz Nüsxə)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-4 w-full py-3" disabled={busy || !name.trim()}>
          {busy ? "Yaradılır…" : "Müəssisəmi Yarat"}
        </button>
      </form>
    </main>
  );
}

function InfoCard({
  icon,
  iconClasses,
  label,
  children,
}: {
  icon: React.ReactNode;
  iconClasses: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClasses}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ShopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M4 9l1-5h14l1 5M4 9a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0M5 9v10h14V9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M9 15l6-6M10 6l1-1a4 4 0 115.5 5.5l-1 1M14 18l-1 1a4 4 0 11-5.5-5.5l1-1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
