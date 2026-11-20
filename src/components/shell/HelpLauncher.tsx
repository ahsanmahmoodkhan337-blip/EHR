/**
 * HelpLauncher — the collapsible help button that stays out of the way
 *
 * Inspired by: the support widget on athenaOne and eClinicalWorks, rebuilt so
 * it stops behaving like an advert. The old WhatsApp button was a 56 px floating
 * circle that hover-scaled and pulsed, sat over the bottom-right of every form
 * and could cover the button a student was about to press (spec
 * `task-1-app-shell.md` item 10).
 *
 * What changed:
 *   - It starts collapsed as a plain 44 px button in the bottom-right corner,
 *     with no animation, so it never covers a form control until it is opened.
 *   - Opening it gives a panel with the keyboard shortcuts (item 8), the
 *     support link and the simulated-data statement.
 *   - Escape closes it, focus goes back to the launcher, and the state is
 *     remembered (`hh_help_open`) so a student who opened it once is not
 *     re-opening it on every page.
 *
 * Every control is a real button with an accessible name, a visible focus ring
 * and at least a 40 px hit area (STANDING-RULES 5).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { HelpCircle, MessageCircle, X } from "lucide-react";
import { SHELL_SHORTCUTS } from "./stageReview";

const OPEN_KEY = "hh_help_open";

const WHATSAPP_URL =
  "https://api.whatsapp.com/send/?phone=923350340888&text=Hi%21%20I%20need%20help%20with%20the%20EHR%20Simulation%20Portal.&type=phone_number&app_absent=0";

function readOpen(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

export function HelpLauncher() {
  // Collapsed by default: a help panel that opens itself is a help panel in the
  // way. A student who opens it keeps it open on the next page.
  const [open, setOpen] = useState(readOpen);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, String(open));
    } catch {
      // A preference that cannot be stored is not student work — the panel
      // still works for this session.
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        launcherRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div
          role="dialog"
          aria-label="Help and keyboard shortcuts"
          className="w-[min(92vw,20rem)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">Help</h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close help"
              title="Close help"
              className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Keyboard shortcuts
          </p>
          <dl className="mt-1 space-y-1">
            {SHELL_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-baseline gap-2">
                <dt className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
                  {shortcut.keys}
                </dt>
                <dd className="min-w-0 text-[11px] text-slate-600 dark:text-slate-300">{shortcut.action}</dd>
              </div>
            ))}
          </dl>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-10 items-center gap-2 rounded-lg bg-green-600 px-2.5 text-[11px] font-semibold text-white hover:bg-green-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Message support on WhatsApp
            <span className="sr-only">(opens in a new tab)</span>
          </a>

          <p className="mt-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            Simulated data — every patient, payer, NPI and fee in this app is fictional and for teaching
            only.
          </p>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Hide help" : "Show help and keyboard shortcuts"}
        title={open ? "Hide help" : "Help and keyboard shortcuts"}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-700 text-white shadow-md transition-colors hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-600 dark:hover:bg-slate-500"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <HelpCircle className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
