/**
 * DarkModeToggle — Sun/Moon Toggle for Dark Mode
 *
 * Persists dark mode preference to localStorage.
 * Uses Tailwind `dark:` class on <html> element.
 * Toggle button with Sun/Moon icon, animated rotation.
 *
 * Inspired by: shadcn/ui Dark Mode Toggle
 */

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

export function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hh_dark_mode");
      if (saved !== null) return saved === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("hh_dark_mode", String(dark));
  }, [dark]);

  const toggle = () => setDark(prev => !prev);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle dark mode"
    >
      <Sun
        aria-hidden="true"
        className={`h-4 w-4 absolute transition-all duration-300 ${
          dark ? "opacity-0 rotate-90 scale-0" : "opacity-100 rotate-0 scale-100"
        }`}
      />
      <Moon
        aria-hidden="true"
        className={`h-4 w-4 absolute transition-all duration-300 ${
          dark ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-0"
        }`}
      />
    </button>
  );
}