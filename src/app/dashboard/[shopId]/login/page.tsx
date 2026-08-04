"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function Login() {
  const { shopId } = useParams<{ shopId: string }>();
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopId, passcode }),
    });
    setBusy(false);
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next || `/dashboard/${shopId}`);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error === "Unknown shop" ? "Bu kodla müəssisə tapılmadı." : "Yanlış parol.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">İşçi girişi</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Müəssisə kodu <strong>{shopId}</strong> — parolunu daxil edin.
        </p>
        <input
          className="input mt-4 text-center text-2xl tracking-widest"
          type="password"
          inputMode="numeric"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="••••"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-4 w-full py-3" disabled={busy}>
          {busy ? "Yoxlanılır…" : "Daxil ol"}
        </button>
      </form>
    </main>
  );
}
