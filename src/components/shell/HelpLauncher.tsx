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
 *   - It is a plain 40 px button docked at the right-hand end of the shell's
 *     footer strip, in the layout and not floating over it, so it can never be
 *     drawn on top of a table row, a form control or the simulated-data line
 *     (slice H: a floating corner button was measured covering the last row's
 *     "Open patient" button on Patients at 1440 px).
 *   - Opening it gives a panel with the keyboard shortcuts (item 8), the
 *     support link and the simulated-data statement; the panel opens upwards
 *     out of the strip.
 *   - Escape closes it, focus goes back to the launcher, and the state is
 *     remembered (`hh_help_open`) so a student who opened it once is not
 *     re-opening it on every page.
 *
 * Every control is a real button with an accessible name, a visible focus ring
 * and at least a 40 px hit area (STANDING-RULES 5).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BookOpen, HelpCircle, MessageCircle, X } from "lucide-react";
import { HOW_TO_TUTORIALS, TUTORIAL_PATIENT_TIP } from "../../domain/howToTutorials";
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
  // The how-to guide open inside the panel, if any (same guides as the landing page).
  const [guideId, setGuideId] = useState<string | null>(null);
  const guide = HOW_TO_TUTORIALS.find((t) => t.id === guideId) ?? null;
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
    <div className="relative flex shrink-0 items-center">
      {open && (
        <div
          role="dialog"
          aria-label="Help and keyboard shortcuts"
          className="absolute bottom-full right-0 z-50 mb-2 max-h-[min(80vh,36rem)] w-[min(92vw,24rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800"
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

          {guide ? (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setGuideId(null)}
                className="flex min-h-10 items-center gap-1 rounded-lg px-1 text-[11px] font-medium text-brand-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                All guides
              </button>
              <h3 className="mt-1 text-[13px] font-bold text-slate-800">{guide.title}</h3>
              <p className="text-[11px] text-slate-500">
                {guide.where} · about {guide.minutes} min
              </p>
              <ol className="mt-2 space-y-2">
                {guide.steps.map((step, i) => (
                  <li key={step.title} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand-50 text-xs font-bold text-brand-700">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-800">{step.title}</p>
                      <p className="text-[11px] leading-relaxed text-slate-600">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">You'll finish with: </span>
                {guide.outcome}
              </p>
            </div>
          ) : (
          <>
          <p className="mt-1 text-[11px] font-semibold text-slate-700">How-to guides</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{TUTORIAL_PATIENT_TIP}</p>
          <ol className="mt-1.5 space-y-1">
            {HOW_TO_TUTORIALS.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setGuideId(t.id)}
                  className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[12px] text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">{t.title}</span>
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-[11px] font-semibold text-slate-700">
            Keyboard shortcuts
          </p>
          <dl className="mt-1 space-y-1">
            {SHELL_SHORTCUTS.map((shortcut) => (
              <div key={shortcut.keys} className="flex items-baseline gap-2">
                <dt className="shrink-0 rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200">
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

          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Simulated data — every patient, payer, NPI and fee in this app is fictional and for teaching
            only.
          </p>
          </>
          )}
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Hide help" : "Show help and keyboard shortcuts"}
        title={open ? "Hide help" : "Help and keyboard shortcuts"}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-white shadow-sm transition-colors hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:bg-slate-600 dark:hover:bg-slate-500"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <HelpCircle className="h-5 w-5" aria-hidden="true" />}
      </button>
    </div>
  );
}
