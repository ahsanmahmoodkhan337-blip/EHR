/**
 * RemittancePanel — the payer's 835 and its paper EOB, as the student sees them.
 *
 * Inspiration: the 835 remittance advice a practice management system imports
 * (Epic's remittance worklist, athenahealth's ERA view) and the paper
 * Explanation of Benefits the same data becomes for a patient. It renders the
 * 835 stored on the encounter (`domain/adjudication.ts`), so a reload shows the
 * same remittance — the panel is a projection, never a second copy of the money.
 *
 * What it teaches, in the payer's own vocabulary:
 *  - every line prints billed, allowed, deductible, coinsurance, paid and the
 *    patient's share, and every adjustment as **group code + CARC + amount**;
 *  - the group letter is the money answer: CO is a provider write-off, PR is the
 *    patient's, and the panel says so on each adjustment row;
 *  - nothing reaches the ledger until the student posts it, and the post is one
 *    store write off the render path.
 */

import { READ_ONLY_REASON_ID } from "../shell/ReadOnlyStage";
import { READ_ONLY_REASON } from "../../domain/tutorialReadOnly";
import { useId } from "react";
import { CheckCircle2, FileText, Landmark } from "lucide-react";
import {
  OUTCOME_LABELS,
  lineBalances,
  type Remittance835,
} from "../../domain/adjudication";

const GROUP_MEANING: Record<string, string> = {
  CO: "provider write-off — never the patient's",
  PR: "patient responsibility",
  OA: "another payer's share",
  PI: "payer-initiated",
};

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export interface RemittancePanelProps {
  remittance: Remittance835;
  /** Post this 835 to the patient ledger. Called from a click, never a render. */
  onPost: () => void;
  /**
   * The standard reference chart: posting is a write, so the button is disabled
   * and says why rather than accepting the click and dropping it.
   */
  readOnly?: boolean;
  className?: string;
}

export function RemittancePanel({ remittance, onPost, readOnly = false, className = "" }: RemittancePanelProps) {
  const headingId = useId();
  const posted = Boolean(remittance.postedAt);
  const { totals } = remittance;
  const unbalanced = remittance.lines.filter((line) => !lineBalances(line).balances);

  return (
    <section
      aria-labelledby={headingId}
      className={`rounded-xl border border-slate-200 bg-white ${className}`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <Landmark className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <h3 id={headingId} className="text-xs font-bold text-slate-800">
          835 remittance — {remittance.payerName}
        </h3>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {OUTCOME_LABELS[remittance.outcome]}
        </span>
        <span className="ml-auto font-mono text-[10px] text-slate-500">{remittance.checkOrEftNumber}</span>
      </header>

      {/* Header fields — what a remittance advice always carries. */}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 text-[10px] sm:grid-cols-3">
        <div>
          <dt className="text-slate-400">Claim control number</dt>
          <dd className="font-mono font-semibold text-slate-700">{remittance.claimControlNumber}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Payment date</dt>
          <dd className="font-semibold text-slate-700">{remittance.paymentDate}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Plan</dt>
          {/* The plan's name, as the plan table spells it. The internal key
              (`PLAN-…`) is never printed as if it were a plan. */}
          <dd className="font-semibold text-slate-700">{remittance.planName || "no plan on file"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Payer ID (N1*PR)</dt>
          <dd className="font-mono font-semibold text-slate-700">{remittance.payerId || "not on file"}</dd>
        </div>
      </dl>

      {/* Per-line money, in the claim's own line order. */}
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full min-w-[720px] text-left text-[10px]">
          <caption className="sr-only">
            835 service lines: billed, allowed, deductible, coinsurance, paid, patient responsibility and
            adjustments
          </caption>
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th scope="col" className="px-2 py-1">Line</th>
              <th scope="col" className="px-2 py-1">CPT</th>
              <th scope="col" className="px-2 py-1 text-right">Billed</th>
              <th scope="col" className="px-2 py-1 text-right">Allowed</th>
              <th scope="col" className="px-2 py-1 text-right">Deductible</th>
              <th scope="col" className="px-2 py-1 text-right">Coins.</th>
              <th scope="col" className="px-2 py-1 text-right">Paid</th>
              <th scope="col" className="px-2 py-1 text-right">Patient</th>
              <th scope="col" className="px-2 py-1">Adjustments</th>
            </tr>
          </thead>
          <tbody>
            {remittance.lines.map((line) => (
              <tr key={`${line.lineNumber}-${line.cpt}`} className="border-t border-slate-100 align-top">
                <td className="px-2 py-1 text-slate-500">{line.lineNumber}</td>
                <td className="px-2 py-1 font-semibold text-slate-700">
                  {line.cpt}
                  {line.modifiers.length > 0 && (
                    <span className="ml-1 font-normal text-slate-500">-{line.modifiers.join("-")}</span>
                  )}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">{money(line.billedCents)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">{money(line.allowedCents)}</td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                  {line.deductibleCents > 0 ? money(line.deductibleCents) : "—"}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                  {line.coinsuranceCents > 0 ? money(line.coinsuranceCents) : "—"}
                </td>
                <td className="px-2 py-1 text-right font-semibold tabular-nums text-emerald-700">
                  {money(line.paidCents)}
                </td>
                <td className="px-2 py-1 text-right tabular-nums text-amber-700">
                  {money(line.patientRespCents)}
                </td>
                <td className="px-2 py-1">
                  {line.adjustments.length === 0 ? (
                    <span className="text-slate-400">none</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {line.adjustments.map((adj) => (
                        <li key={`${line.lineNumber}-${adj.carc}`} className="text-slate-600">
                          <span className="font-mono font-semibold">{adj.carc}</span> {money(adj.amountCents)}{" "}
                          <span className="text-slate-400">— {GROUP_MEANING[adj.group]}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold text-slate-700">
            <tr className="border-t border-slate-200">
              <th scope="row" colSpan={2} className="px-2 py-1 text-left">
                Totals
              </th>
              <td className="px-2 py-1 text-right tabular-nums">{money(totals.billedCents)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{money(totals.allowedCents)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{money(totals.deductibleCents)}</td>
              <td className="px-2 py-1 text-right tabular-nums">{money(totals.coinsuranceCents)}</td>
              <td className="px-2 py-1 text-right tabular-nums text-emerald-700">{money(totals.paidCents)}</td>
              <td className="px-2 py-1 text-right tabular-nums text-amber-700">
                {money(totals.patientRespCents)}
              </td>
              <td className="px-2 py-1 text-left font-normal text-slate-500">
                write-off {money(totals.writeOffCents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* The EOB narrative: where every number came from, line by line. */}
      <details className="border-t border-slate-100 px-3 py-2">
        <summary className="cursor-pointer text-[10px] font-semibold text-slate-600">
          <FileText className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Explain this remittance line by line
        </summary>
        <ul className="mt-1.5 space-y-1.5">
          {remittance.lines.map((line) => (
            <li key={`exp-${line.lineNumber}`} className="text-[10px] leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-700">Line {line.lineNumber} · {line.cpt}:</span>{" "}
              {line.explanation}
            </li>
          ))}
        </ul>
      </details>

      {unbalanced.length > 0 && (
        <p className="mx-3 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-700">
          {unbalanced.length} line{unbalanced.length === 1 ? "" : "s"} do not balance: billed must equal paid +
          adjustments + patient responsibility + remaining insurance balance. This is a defect in the
          simulator, not in the claim — do not post it.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-3 py-2">
        {posted ? (
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Posted to the patient ledger on {remittance.postedAt?.slice(0, 10)}
          </p>
        ) : (
          <button
            type="button"
            onClick={onPost}
            disabled={readOnly || unbalanced.length > 0}
            title={readOnly ? READ_ONLY_REASON : undefined}
            aria-describedby={readOnly ? READ_ONLY_REASON_ID : undefined}
            aria-label={`Post 835 ${remittance.checkOrEftNumber} to the patient ledger`}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-[11px] font-semibold text-white hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Landmark className="h-3.5 w-3.5" aria-hidden="true" />
            Post this 835 to the ledger
          </button>
        )}
        <p className="text-[10px] text-slate-500">
          Posting writes the charge, the insurance payment and every contractual adjustment to the patient's
          ledger. Nothing is posted until you press it.
        </p>
      </div>
    </section>
  );
}
