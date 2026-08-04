"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Public entry point: staff type their shop's unique code to reach that
// shop's own login (which then gates the actual dashboard). No shop code is
// guessable/listed here — each business only ever gets its own via /create.
export default function DashboardEntry() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c) router.push(`/dashboard/${c}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={go} className="card w-full max-w-sm p-6 text-center">
        <h1 className="text-xl font-bold">Müəssisə paneli</h1>
        <p className="mt-1 text-sm text-neutral-500">Müəssisənizin unikal kodunu daxil edin.</p>
        <input
          className="input mt-4 text-center text-2xl uppercase tracking-widest"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="məs: 7F3K2"
          maxLength={10}
        />
        <button className="btn-primary mt-4 w-full py-3">Davam et</button>
        <p className="mt-4 text-xs text-neutral-400">
          Hələ müəssisəniz yoxdur? <a href="/create" className="text-brand hover:underline">Yaradın</a>
        </p>
      </form>
    </main>
  );
}
