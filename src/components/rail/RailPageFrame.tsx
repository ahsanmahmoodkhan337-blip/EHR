/**
 * RailPageFrame — the shared pieces the five money-cycle rail pages draw
 *
 * Inspired by: athenahealth's worklist screens (a counted list you open one row
 * at a time) and Epic's report cards (a titled block with the figure and where
 * it came from). The five pages — Coding, Claims, Payments, Denials and AR,
 * Reports — differ in what they count, not in how a row looks, so the row, the
 * header and the empty state live here once.
 *
 * Spec `eleven-rail-pages.md`:
 *  - a row carries **one** control, which opens the stage where its work is
 *    done — never a dead end and never two competing buttons;
 *  - a page with no records says which stage produces the first one, and never
 *    shows a sample record as if the student had made it;
 *  - every control is at least 40 px, has a visible label, and keeps a keyboard
 *    focus ring (STANDING-RULES 5);
 *  - dense content wraps inside its own card, so nothing scrolls the page
 *    sideways at 360 px (STANDING-RULES 4).
 *
 * Nothing here computes a figure: every value it prints came from
 * `domain/railPages.ts`, which reads the student's saved records.
 */

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { RailRow } from "../../domain/railPages";
import type { Role } from "../../store/pipelineEncounter";

/** The simulated-data footer every rail page carries (STANDING-RULES 1). */
export const railFooter = (
  <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400 dark:border-slate-800 dark:bg-slate-900">
    Healthcare Hustlers EHR Simulation — built for healthcare education. All patients, payers and fees are
    fictional.
  </footer>
);

export function RailPageHeader({
  icon: Icon,
  title,
  purpose,
  count,
  countLabel,
}: {
  icon: LucideIcon;
  title: string;
  purpose: string;
  /** The count of rows the page is showing, from the student's own records. */
  count: number;
  countLabel: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
        <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h1>
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{purpose}</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        <span className="tabular-nums">{count}</span> {countLabel}
      </p>
    </div>
  );
}

/** A page or a section with no records: it names the stage that fills it. */
export function RailEmptyState({ nextStep }: { nextStep: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
        No data yet — nothing here.
      </p>
      <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">Next: {nextStep}</p>
    </div>
  );
}

/** One plain sentence about what a page can and cannot show. */
export function RailNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{children}</p>
  );
}

export function RailSection({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 first:mt-0" aria-label={title}>
      <div className="mb-1.5 flex items-center gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {title}
        </h2>
        {typeof count === "number" && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            {count}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

const actionClass =
  "inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:bg-brand-900/30";

/**
 * One row: what it is about, the facts behind it, and the single control that
 * opens the stage where its work is done.
 */
export function RailRowList({
  rows,
  onOpenMedical,
}: {
  rows: RailRow[];
  /** Open a patient at the stage that holds this work (the medical track). */
  onOpenMedical: (patientId: string | null, role: Role) => void;
}) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => {
        const target = row.target;
        return (
        <li
          key={row.id}
          className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <p className="min-w-0 flex-1 break-words text-[12px] font-semibold text-slate-800 dark:text-slate-100">
              {row.title}
            </p>
            {target.kind === "medical" ? (
              <button
                type="button"
                onClick={() => onOpenMedical(target.patientId, target.role)}
                className={actionClass}
                aria-label={`${row.action} — ${row.title}`}
              >
                {row.action}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : (
              <Link
                to="/cases/$track/$caseId/$stage"
                params={{ track: "dental", caseId: target.caseId, stage: target.stage }}
                className={actionClass}
                aria-label={`${row.action} — ${row.title}`}
              >
                {row.action}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>

          <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
            {row.fields.map((field) => (
              <div key={field.label} className="min-w-0">
                <dt className="text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {field.label}
                </dt>
                <dd className="break-words text-[11px] text-slate-700 dark:text-slate-300">{field.value}</dd>
              </div>
            ))}
          </dl>
        </li>
        );
      })}
    </ul>
  );
}

/** A titled figure with the store it was read from, for the Reports page. */
export function RailFigure({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 break-words text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
        {value}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">{source}</p>
    </div>
  );
}
