/**
 * AppealDocumentationChecklist.tsx — the documentation gate on an appeal.
 *
 * Inspired by: the attachment drawer an eClinicalWorks-style claim follow-up
 * screen puts in front of a biller before an appeal is released — the payer
 * reviews a film and a stated criterion, not a paragraph of prose.
 *
 * `specs/appeal-documentation-gate.md`. Two required items, one optional one:
 *  - the film the payer's criterion names (checkbox);
 *  - one reason stated from the denial's short list (radio group);
 *  - the student's own words — narrative only, never what decides the appeal.
 *
 * The list is not marked with which reasons the plan accepts: the plan's
 * criterion is on the denial, and the student applies it to the record. When a
 * lodge is refused, the rule and its consequence are shown right here.
 */

import { FileImage } from "lucide-react";
import type { DentalDenial } from "../../data/dental";

export function AppealDocumentationChecklist({
  idPrefix,
  denial,
  filmAttached,
  reasonId,
  narrative,
  onFilm,
  onReason,
  onNarrative,
  refusal,
}: {
  /** Keeps the input ids unique when two checklists are on screen. */
  idPrefix: string;
  denial: DentalDenial;
  filmAttached: boolean;
  reasonId: string | null;
  narrative: string;
  onFilm: (attached: boolean) => void;
  onReason: (id: string) => void;
  onNarrative: (text: string) => void;
  /** The refusal to show, from `appealGateFor()`; absent until one is refused. */
  refusal?: { rule: string; consequence: string } | null;
}) {
  const doc = denial.appealEvidence;
  if (!doc) return null;

  return (
    <div className="space-y-2">
      <label
        htmlFor={`${idPrefix}-film`}
        className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
      >
        <input
          id={`${idPrefix}-film`}
          type="checkbox"
          checked={filmAttached}
          onChange={(e) => onFilm(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-red-600"
          aria-describedby={`${idPrefix}-film-note`}
        />
        <span className="text-xs font-medium text-slate-700">
          <FileImage className="mr-1 inline h-3 w-3 text-slate-400" aria-hidden />
          Attach: {doc.film}
        </span>
      </label>
      <p id={`${idPrefix}-film-note`} className="text-[11px] text-slate-400">
        The payer's criterion names this film. An appeal without it is not reviewed.
      </p>

      <fieldset className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
        <legend className="px-1 text-xs font-semibold text-slate-700">What the record shows</legend>
        <div className="space-y-0.5">
          {doc.reasons.map((reason) => (
            <label
              key={reason.id}
              htmlFor={`${idPrefix}-reason-${reason.id}`}
              className="flex min-h-[40px] cursor-pointer items-center gap-2 text-xs text-slate-700"
            >
              <input
                id={`${idPrefix}-reason-${reason.id}`}
                type="radio"
                name={`${idPrefix}-reason`}
                checked={reasonId === reason.id}
                onChange={() => onReason(reason.id)}
                className="h-4 w-4 shrink-0 accent-red-600"
              />
              {reason.text}
            </label>
          ))}
        </div>
      </fieldset>

      <label htmlFor={`${idPrefix}-narrative`} className="block">
        <span className="text-xs font-medium text-slate-600">Narrative (your own words):</span>
        <textarea
          id={`${idPrefix}-narrative`}
          value={narrative}
          onChange={(e) => onNarrative(e.target.value)}
          rows={2}
          placeholder="Anything else the reviewer should know…"
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-red-300 focus:ring-1 focus:ring-red-300"
        />
      </label>

      {refusal && (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
          <p className="text-xs font-semibold text-amber-900">Appeal not lodged.</p>
          <p className="text-xs text-amber-900">{refusal.rule}</p>
          <p className="text-xs text-amber-900">{refusal.consequence}</p>
        </div>
      )}
    </div>
  );
}
