/**
 * PredeterminationEstimate.tsx — Shared pre-treatment estimate renderer
 *
 * Inspired by: the "predetermination of benefits" letter a payer returns, read
 * side-by-side with an Explanation of Benefits. It renders a
 * `PredeterminationScenario`'s line-by-line estimate (the `estimate` field)
 * with a verdict per line, using the shared `.data-table` + `.status-badge`
 * primitives so pre-treatment estimates and claim outcomes share one visual
 * language.
 *
 * Teaching rule enforced here: a downgrade is NOT a denial. An
 * alternate-benefit line (`verdict: "downgraded"`) is rendered as a reduced
 * allowance with the `paidAtAllowedUsd` benchmark and an amber "adjustment"
 * badge — never as a rejected line. This mirrors `ExpectedLineOutcome` from
 * caseScenarios.ts (same per-line money shape), so the two can be read the
 * same way by a student.
 */

import { BadgeCheck, Info } from "lucide-react";
import type { PredeterminationScenario, PredeterminationVerdict } from "../../data/dental";

const VERDICT_TONE: Record<PredeterminationVerdict, string> = {
  allowed: "status-badge is-success",
  downgraded: "status-badge is-warning",
  "frequency-limited": "status-badge is-warning",
  excluded: "status-badge is-danger",
};

const VERDICT_LABEL: Record<PredeterminationVerdict, string> = {
  allowed: "Allowed",
  downgraded: "Downgraded",
  "frequency-limited": "Frequency-limited",
  excluded: "Excluded",
};

export function PredeterminationEstimate({ scenario }: { scenario: PredeterminationScenario }) {
  const hasDowngrade = scenario.estimate.some((l) => l.verdict === "downgraded");
  const hasDenial = scenario.estimate.some((l) => l.verdict === "excluded");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* summary banner */}
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-800">{scenario.id}</span>
          <span className="text-[10px] text-slate-500">{scenario.planId} (fictional payer)</span>
          <span className="ml-auto rounded-full bg-slate-200/70 px-2 py-0.5 text-[9px] font-semibold uppercase text-slate-600">
            {scenario.difficulty}
          </span>
        </div>
        <p className="mt-1 text-[11px] font-medium text-slate-700">{scenario.estimateSummary}</p>
      </div>

      {/* line-by-line estimate */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Service</th>
              <th>Verdict</th>
              <th className="num">Charged</th>
              <th className="num">Allowed</th>
              <th className="num">Plan pays</th>
              <th className="num">Patient owes</th>
              <th className="num">Write-off</th>
            </tr>
          </thead>
          <tbody>
            {scenario.estimate.map((l) => (
              <tr key={l.line}>
                <td className="num font-medium text-slate-500">{l.line}</td>
                <td>
                  <div className="font-medium text-slate-800">
                    {l.code}
                    {l.tooth ? <span className="text-slate-400"> · #{l.tooth}</span> : ""}
                  </div>
                  <div className="text-[10px] text-slate-500">{l.description}</div>
                </td>
                <td>
                  <span className={VERDICT_TONE[l.verdict]}>{VERDICT_LABEL[l.verdict]}</span>
                  {l.verdict === "downgraded" && l.paidAtAllowedUsd !== undefined && (
                    <div className="mt-0.5 text-[9px] text-amber-600">paid at ${l.paidAtAllowedUsd}</div>
                  )}
                  {l.denialId && (
                    <div className="mt-0.5 text-[9px] font-medium text-slate-400">{l.denialId}</div>
                  )}
                </td>
                <td className="num">{fmtUsd(l.chargedUsd)}</td>
                <td className="num">{fmtUsd(l.allowedUsd)}</td>
                <td className="num text-emerald-700">{fmtUsd(l.planPaysUsd)}</td>
                <td className="num text-red-700">{fmtUsd(l.patientOwesUsd)}</td>
                <td className="num text-slate-500">{fmtUsd(l.writeOffUsd)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="num" colSpan={3}>Totals</td>
              <td className="num">{fmtUsd(scenario.estimateTotals.chargedUsd)}</td>
              <td className="num">{fmtUsd(scenario.estimateTotals.allowedUsd)}</td>
              <td className="num text-emerald-700">{fmtUsd(scenario.estimateTotals.planPaysUsd)}</td>
              <td className="num text-red-700">{fmtUsd(scenario.estimateTotals.patientOwesUsd)}</td>
              <td className="num text-slate-500">{fmtUsd(scenario.estimateTotals.writeOffUsd)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* per-line notes */}
      <div className="space-y-1 border-t border-slate-100 px-3 py-2">
        {scenario.estimate.map((l) => (
          <p key={l.line} className="text-[10px] leading-snug text-slate-600">
            <span className="font-semibold text-slate-500">Line {l.line}: </span>
            {l.note}
          </p>
        ))}
      </div>

      {/* downgrade ≠ denial teaching callout */}
      {hasDowngrade && (
        <div className="border-t border-amber-100 bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
            A downgrade is an adjustment — not a denial
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-amber-700">
            The code was correct; the plan simply pays a lower allowance for it. The difference is a documented
            patient upgrade, handled as a patient balance — not a rejected line you bill differently.
          </p>
        </div>
      )}

      {/* excluded teaching callout */}
      {hasDenial && !hasDowngrade && (
        <div className="border-t border-red-100 bg-red-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-red-800">
            <Info className="h-3.5 w-3.5 shrink-0" />
            This estimate removes the benefit entirely
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-red-700">
            Unlike a downgrade, a non-covered service leaves nothing for the plan to pay. Confirm the exclusion in
            writing before the patient is seated.
          </p>
        </div>
      )}
    </div>
  );
}

function fmtUsd(n: number): string {
  return `$${Math.round(n * 100) / 100}`;
}
