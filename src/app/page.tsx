"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The site's main entry point: type the shop's unique code to reach that one
// shop's shared upload+queue screen at /s/[code]. Customers and print staff
// use this exact same screen and code — two different codes never see each
// other's files or queue, since every shop's data is filtered by its own code
// server-side.
export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function go(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    router.push(`/s/${c}`);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-950 via-brand to-violet-600 p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.12), transparent 40%), radial-gradient(circle at 85% 75%, rgba(255,255,255,0.10), transparent 45%)",
        }}
      />
      <form onSubmit={go} className="card relative w-full max-w-sm p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
          <PrinterIcon />
        </div>
        <h1 className="text-xl font-bold">Müəssisə kodunuzu daxil edin</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Müştərilər və işçilər öz müəssisələrinin yükləmə və çap növbəsinə çatmaq üçün eyni koddan istifadə edir.
        </p>
        <input
          className="input mt-4 text-center text-2xl uppercase tracking-widest"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="məs: 7F3K2"
          maxLength={10}
        />
        <button className="btn-primary mt-4 flex w-full items-center justify-center gap-2 py-3" disabled={!code.trim()}>
          Davam et <ArrowIcon />
        </button>
        <p className="mt-4 text-xs text-neutral-400">
          Hələ müəssisə kodunuz yoxdur? <a href="/create" className="text-brand hover:underline">Yaradın</a>
        </p>
      </form>
    </main>
  );
}

function PrinterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path
        d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
