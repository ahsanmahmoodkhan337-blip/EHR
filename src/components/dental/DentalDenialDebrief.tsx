/**
 * DentalDenialDebrief.tsx — denial-depth scenarios (post-claim debrief)
 *
 * Inspired by: the "why did this deny, and what should we have done" debrief a
 * biller walks through after the payer responds — the front-office situation,
 * the exact lines the remittance would return, and the ordered corrective
 * action. Renders the content specialist's `DentalDenialScenario` records
 * (eraRemittance.ts `DENIAL_SCENARIOS`).
 *
 * Enriches each scenario's `denialId` with the canonical `DentalDenial`
 * (denialReasons.ts) for the group-code + patient-billable reading, so the
 * debrief teaches the same CO-vs-PR distinction the ERA view enforces.
 */

import { AlertOctagon, BookOpenCheck, ListChecks } from "lucide-react";
import type { DentalDenialScenario, EraClaimLine, EraLineDisposition } from "../../data/dental";
import { findDenial } from "../../data/dental";

const DISPOSITION_BADGE: Record<EraLineDisposition, { cls: string; label: string }> = {
  paid: { cls: "status-badge is-success", label: "Paid" },
  "paid-with-adjustment": { cls: "status-badge is-warning", label: "Paid w/ adjustment" },
  denied: { cls: "status-badge is-danger", label: "Denied" },
};

export function DentalDenialDebrief({ scenarios }: { scenarios: DentalDenialScenario[] }) {
  if (scenarios.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <BookOpenCheck className="h-4 w-4 text-blue-600" />
        <div>
          <h3 className="text-sm font-bold text-slate-800">Denial debrief — situations to learn from</h3>
          <p className="text-[10px] text-slate-400">The situation, the lines the payer would return, and the ordered corrective action.</p>
        </div>
      </div>
      <div className="space-y-3">
        {scenarios.map((s) => (
          <div key={s.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-xs font-bold text-slate-800">{s.title}</span>
              <DenialTag denialId={s.denialId} />
              <span className="ml-auto flex flex-wrap gap-1">
                {s.procedureCodes.map((c) => (
                  <span key={c} className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">
                    {c}
                  </span>
                ))}
              </span>
            </div>

            <div className="space-y-2 px-3 py-2.5">
              <p className="text-[11px] leading-snug text-slate-600">
                <span className="font-semibold text-slate-700">Situation: </span>
                {s.situation}
              </p>

              {s.expectedLines.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-slate-100">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="num">#</th>
                        <th>Service</th>
                        <th>Status</th>
                        <th className="num">Paid</th>
                        <th className="num">Patient</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.expectedLines.map((line) => (
                        <DebriefLine key={line.line} line={line} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div>
                <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
                  <ListChecks className="h-3 w-3" /> Correct action
                </p>
                <ol className="list-decimal space-y-0.5 pl-4 text-[10px] leading-snug text-slate-600">
                  {s.correctAction.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
              </div>

              <p className="flex items-start gap-1.5 rounded-md bg-blue-50 px-2.5 py-2 text-[10px] leading-snug text-blue-800">
                <AlertOctagon className="mt-0.5 h-3 w-3 shrink-0" />
                {s.teachingPoint}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DenialTag({ denialId }: { denialId: string }) {
  const d = findDenial(denialId);
  const pr = d?.groupCode === "PR";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
        pr ? "bg-purple-50 text-purple-700" : "bg-red-50 text-red-700"
      }`}
    >
      {denialId}
      {d ? ` · ${d.groupCode}${pr ? " (patient responsibility)" : " (not billable)"}` : ""}
    </span>
  );
}

function DebriefLine({ line }: { line: EraClaimLine }) {
  const badge = DISPOSITION_BADGE[line.disposition];
  return (
    <tr>
      <td className="num font-medium text-slate-500">{line.line}</td>
      <td>
        <span className="font-medium text-slate-800">{line.code}</span>
        {line.tooth ? <span className="text-slate-400"> · #{line.tooth}</span> : ""}
      </td>
      <td>
        <span className={badge.cls}>{badge.label}</span>
      </td>
      <td className="num text-emerald-700">{fmtUsd(line.paidUsd)}</td>
      <td className="num text-red-700">{fmtUsd(line.patientOwesUsd)}</td>
    </tr>
  );
}

function fmtUsd(n: number): string {
  return `$${Math.round(Math.abs(n) * 100) / 100}`;
}
