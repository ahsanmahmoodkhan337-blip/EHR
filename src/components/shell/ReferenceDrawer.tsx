/**
 * ReferenceDrawer — the split-pane reference panel beside every working stage
 *
 * Inspired by: Epic Hyperspace's Chart Review / "SnapShot" side panel and
 * eClinicalWorks' right-hand reference pane, where the note, the insurance card
 * and the payer's rules stay visible while the coder or biller works. Spec
 * `task-1-app-shell.md` item 6: "Students must be able to read the note while
 * coding and the card while filling the claim, without leaving the page."
 *
 * Four tabs — Chart note, Insurance card, Payer policy, Code reference — and
 * the student's chosen tab is remembered (`hh_reference_tab`), so moving from
 * Coding to the Claim does not throw them back to the first tab. The panel's
 * open/closed state is remembered too (`hh_reference_open`).
 *
 * Three presentations, one component:
 *   ≥1024 px  an inline split pane on the right of the work area;
 *   collapsed a 44 px rail of tab icons, so the work area gets its width back
 *             without losing the reference;
 *   <1024 px  a slide-over panel opened by a "Reference" button, because a
 *             360 px screen has no room to split. The page never scrolls
 *             sideways at any width (standing rule 4).
 *
 * Every control is a real button with a visible label or an `aria-label`, a
 * 40 px minimum hit area and a visible focus ring (standing rule 5).
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { PanelRightClose, PanelRightOpen, X } from "lucide-react";

export interface ReferenceTab {
  /** Stable id — this is what is remembered between visits. */
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

interface ReferenceDrawerProps {
  tabs: ReferenceTab[];
  /** Blue for the medical track, teal for dental. */
  accent?: "blue" | "teal";
  /** Accessible name for the whole panel. */
  label?: string;
}

const TAB_KEY = "hh_reference_tab";
const OPEN_KEY = "hh_reference_open";

const ACCENT: Record<"blue" | "teal", { active: string; ring: string }> = {
  blue: {
    active: "bg-blue-600 text-white",
    ring: "focus-visible:outline-blue-600",
  },
  teal: {
    active: "bg-teal-600 text-white",
    ring: "focus-visible:outline-teal-600",
  },
};

function readStored(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A preference that cannot be stored is not student work — the panel still
    // works for this session, and the autosave indicator is not the place to
    // report a lost tab choice.
  }
}

/**
 * Which tab to show: the remembered one when it still exists, otherwise the
 * first. Exported so the rule can be tested without a DOM.
 */
export function resolveReferenceTab(stored: string | null, tabs: { id: string }[]): string {
  if (tabs.length === 0) return "";
  if (stored && tabs.some((tab) => tab.id === stored)) return stored;
  return tabs[0].id;
}

export function ReferenceDrawer({ tabs, accent = "blue", label = "Reference" }: ReferenceDrawerProps) {
  const [activeId, setActiveId] = useState(() => resolveReferenceTab(readStored(TAB_KEY), tabs));
  // Default open on a wide screen: the drawer is a teaching aid, not a hidden
  // extra. A student who collapses it keeps it collapsed next time.
  const [open, setOpen] = useState(() => readStored(OPEN_KEY) !== "false");
  const [mobileOpen, setMobileOpen] = useState(false);

  // Keep the choice when the tab list changes (a case with fewer tabs).
  useEffect(() => {
    const next = resolveReferenceTab(activeId, tabs);
    if (next && next !== activeId) setActiveId(next);
  }, [tabs, activeId]);

  useEffect(() => {
    writeStored(TAB_KEY, activeId);
  }, [activeId]);

  useEffect(() => {
    writeStored(OPEN_KEY, String(open));
  }, [open]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  if (tabs.length === 0) return null;

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const tone = ACCENT[accent];

  const tabStrip = (onPick: (id: string) => void, size: "sm" | "lg") => (
    <div role="group" aria-label={`${label} tabs`} className="flex flex-wrap gap-1">
      {tabs.map((tab) => {
        const selected = tab.id === active.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onPick(tab.id)}
            aria-pressed={selected}
            aria-label={`${tab.label}${selected ? " — showing" : ""}`}
            className={`flex min-h-10 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ${tone.ring} ${
              selected
                ? tone.active
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            } ${size === "sm" ? "" : "text-xs"}`}
          >
            <span aria-hidden="true" className="shrink-0">
              {tab.icon}
            </span>
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );

  const panelBody = (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2 text-[11px] leading-relaxed text-slate-700 dark:text-slate-200">
      {active.content}
    </div>
  );

  return (
    <>
      {/* ── ≥1024 px: inline split pane ─────────────────────────────────── */}
      {open ? (
        <aside
          aria-label={label}
          className="hidden w-80 shrink-0 flex-col border-l border-slate-200 bg-white lg:flex xl:w-96 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {label}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={`Collapse ${label.toLowerCase()} panel`}
              title="Collapse the reference panel"
              className={`ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 ${tone.ring}`}
            >
              <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
            {tabStrip(setActiveId, "sm")}
          </div>
          {panelBody}
        </aside>
      ) : (
        <aside
          aria-label={`${label} — collapsed`}
          className="hidden w-12 shrink-0 flex-col items-center gap-1 border-l border-slate-200 bg-white py-2 lg:flex dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`Open ${label.toLowerCase()} panel`}
            title="Open the reference panel"
            className={`flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 ${tone.ring}`}
          >
            <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
          </button>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveId(tab.id);
                setOpen(true);
              }}
              aria-label={`Open ${tab.label} in the reference panel`}
              title={tab.label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 ${tone.ring}`}
            >
              <span aria-hidden="true">{tab.icon}</span>
            </button>
          ))}
        </aside>
      )}

      {/* ── <1024 px: a slide-over, opened from one button ──────────────── */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={`Open ${label.toLowerCase()} panel`}
          aria-expanded={mobileOpen}
          className={`fixed bottom-24 right-4 z-40 flex h-12 items-center gap-1.5 rounded-full px-4 text-[11px] font-bold text-white shadow-lg focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 ${
            accent === "teal" ? "bg-teal-600 hover:bg-teal-700" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
          Reference
        </button>

        {mobileOpen && (
          <div className="fixed inset-0 z-[60] flex">
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close the reference panel"
              className="flex-1 bg-slate-900/40"
            />
            <aside
              aria-label={label}
              className="flex h-full w-[min(92vw,22rem)] flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {label}
                </span>
                <button
                  type="button"
                  onClick={closeMobile}
                  aria-label={`Close ${label.toLowerCase()} panel`}
                  className={`ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 dark:text-slate-300 dark:hover:bg-slate-800 ${tone.ring}`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="border-b border-slate-200 px-2 py-1.5 dark:border-slate-800">
                {tabStrip(setActiveId, "lg")}
              </div>
              {panelBody}
            </aside>
          </div>
        )}
      </div>
    </>
  );
}
