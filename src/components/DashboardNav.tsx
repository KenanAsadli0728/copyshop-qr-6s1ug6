"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { shopId } = useParams<{ shopId: string }>();
  if (pathname.endsWith("/login")) return null;

  const base = `/dashboard/${shopId}`;
  const TABS = [
    { href: base, label: "Növbə" },
    { href: `${base}/prices`, label: "Qiymətlər" },
    { href: `${base}/report`, label: "Hesabat" },
    { href: `${base}/settings`, label: "Ayarlar" },
  ];

  async function signOut() {
    await fetch(`/api/login?shopId=${shopId}`, { method: "DELETE" });
    router.replace(`${base}/login`);
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2">
        <span className="mr-3 font-bold">CopyShop · {shopId}</span>
        {TABS.map((t) => {
          const active = t.href === base ? pathname === t.href : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                active
                  ? "bg-brand text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
        <button
          onClick={signOut}
          className="ml-auto rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Çıxış
        </button>
      </div>
    </nav>
  );
}
