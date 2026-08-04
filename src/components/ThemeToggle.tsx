"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label="Qaranlıq rejimi dəyiş"
      className="fixed right-3 top-3 z-50 rounded-full border border-neutral-300 bg-white/80 p-2 text-lg shadow-sm backdrop-blur dark:border-neutral-700 dark:bg-neutral-900/80"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
