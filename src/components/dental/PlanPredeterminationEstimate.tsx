/**
 * PlanPredeterminationEstimate.tsx — Live per-item predetermination estimate
 *
 * Inspired by: Dentrix Treatment Planner / Open Dental "Predetermination"
 * preview, where the front office sends the planned treatment and the payer
 * returns a line-by-line estimate (fee → allowed → plan pays → patient owes)
 * BEFORE any work is done. This renders the live `adjudicateDentalClaim()`
 * result for the STUDENT'S OWN planned treatment — so the predetermination is
 * the student's plan, not a canned teaching scenario.
 *
 * Teaching rule enforced here (the same rule `PredeterminationEstimate`
 * enforces for canned scenarios): a downgrade is an ADJUSTMENT, never a
 * denial. An alternate-benefit line (the plan pays a lower allowance for the
 * same, correctly-billed service) renders amber with the benchmark code — the
 * difference is a patient upgrade, not a rejected line.
 */

import { BadgeCheck, Info, Paperclip } from "lucide-react";
import {
  attachmentsForCode,
  findCDT,
  findPlan,
  type DentalCaseScenario,
} from "../../data/dental";
import type { DentalClaimAdjudication, DentalLineAdjudication } from "./adjudication";

interface Props {
  adjudication: DentalClaimAdjudication;
  activeCase: DentalCaseScenario;
}

function fmtUsd(n: number): string {
  return `$${Math.round(n * 100) / 100}`;
}

/** One-line verdict per line, mapping the evaluator result to a badge. */
function verdictFor(line: DentalLineAdjudication): { label: string; tone: string } {
  if (line.isDowngrade) return { label: "Downgraded", tone: "status-badge is-warning" };
  if (line.denial) return { label: line.denial.title, tone: "status-badge is-danger" };
  if (line.result.annualMaxReductionUsd > 0) return { label: "Annual max", tone: "status-badge is-warning" };
  return { label: "Allowed", tone: "status-badge is-success" };
}

export function PlanPredeterminationEstimate({ adjudication, activeCase }: Props) {
  const plan = findPlan(activeCase.planId);
  const hasDowngrade = adjudication.lines.some((l) => l.isDowngrade);
  const hasDenial = adjudication.lines.some((l) => l.denial);

  // Attachment-required notices: which planned lines still need attachments
  // before the service will adjudicate cleanly.
  const missingAttachments = adjudication.lines
    .map((l) => ({
      line: l,
      missing: attachmentsForCode(l.claimLine.code).filter(
        (r) => !(l.claimLine.attachments ?? []).includes(r.type),
      ),
    }))
    .filter((x) => x.missing.length > 0);

  return (
    <div className="overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm">
      {/* letter header */}
      <div className="border-b border-teal-100 bg-teal-50 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-teal-800">Predetermination of Benefits</span>
          <span className="text-[10px] text-teal-600">
            {plan ? `${plan.payerName} · ${plan.planName}` : activeCase.planId} (fictional payer)
          </span>
          <span className="ml-auto text-[10px] text-teal-600">
            {activeCase.patient.firstName} {activeCase.patient.lastName} · {activeCase.patient.memberId}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] leading-snug text-teal-700">
          Estimate of what the plan will pay for the planned treatment. Not a guarantee of payment — the patient's
          out-of-pocket number becomes binding only when the payer returns the predetermination.
        </p>
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
            {adjudication.lines.map((l, i) => {
              const v = verdictFor(l);
              const cdt = findCDT(l.code);
              return (
                <tr key={l.lineId}>
                  <td className="num font-medium text-slate-500">{i + 1}</td>
                  <td>
                    <div className="font-medium text-slate-800">
                      {l.code}
                      {l.claimLine.tooth ? <span className="text-slate-400"> · #{l.claimLine.tooth}</span> : ""}
                      {l.claimLine.surfaces ? <span className="text-slate-400"> · {l.claimLine.surfaces}</span> : ""}
                      {l.claimLine.quadrant ? <span className="text-slate-400"> · q{l.claimLine.quadrant}</span> : ""}
                    </div>
                    <div className="text-[10px] text-slate-500">{cdt?.shortName ?? "Service"}</div>
                  </td>
                  <td>
                    <span className={v.tone}>{v.label}</span>
                    {l.isDowngrade && l.result.alternateBenefit && (
                      <div className="mt-0.5 text-[9px] text-amber-600">
                        paid at {l.result.alternateBenefit.paidAtCode}
                      </div>
                    )}
                    {l.denial && (
                      <div className="mt-0.5 text-[9px] font-medium text-slate-400">{l.denial.id}</div>
                    )}
                  </td>
                  <td className="num">{fmtUsd(l.result.chargedUsd)}</td>
                  <td className="num">{fmtUsd(l.result.allowedUsd)}</td>
                  <td className="num text-emerald-700">{fmtUsd(l.result.planPaysUsd)}</td>
                  <td className="num text-red-700">{fmtUsd(l.result.patientOwesUsd)}</td>
                  <td className="num text-slate-500">{fmtUsd(l.result.contractualWriteOffUsd)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-semibold">
              <td className="num" colSpan={3}>
                Totals
              </td>
              <td className="num">{fmtUsd(adjudication.totals.chargedUsd)}</td>
              <td className="num">{fmtUsd(adjudication.totals.allowedUsd)}</td>
              <td className="num text-emerald-700">{fmtUsd(adjudication.totals.planPaysUsd)}</td>
              <td className="num text-red-700">{fmtUsd(adjudication.totals.patientOwesUsd)}</td>
              <td className="num text-slate-500">{fmtUsd(adjudication.totals.writeOffUsd)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* per-line notes */}
      <div className="space-y-1 border-t border-slate-100 px-3 py-2">
        {adjudication.lines.map((l, i) => (
          <p key={l.lineId} className="text-[10px] leading-snug text-slate-600">
            <span className="font-semibold text-slate-500">Line {i + 1}: </span>
            {l.isDowngrade
              ? l.result.alternateBenefit?.explanation
              : l.denial
                ? l.denial.plainLanguage
                : l.result.summary}
          </p>
        ))}
      </div>

      {/* attachment-required notice */}
      {missingAttachments.length > 0 && (
        <div className="border-t border-amber-100 bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
            <Paperclip className="h-3.5 w-3.5 shrink-0" />
            Attachments still required before this will adjudicate
          </p>
          <div className="mt-1 space-y-1">
            {missingAttachments.map(({ line, missing }) => (
              <p key={line.lineId} className="text-[10px] leading-snug text-amber-700">
                <span className="font-semibold">
                  {line.code}
                  {line.claimLine.tooth ? ` · #${line.claimLine.tooth}` : ""}
                </span>
                {" — "}
                {missing.map((m) => `${m.label} (${m.whyRequired})`).join(" · ")}
              </p>
            ))}
          </div>
          <p className="mt-1 text-[9px] text-amber-600">
            A skipped attachment is the single most common "missing documentation" denial (DEN-DOC-MISSING). Gather it
            below before submission.
          </p>
        </div>
      )}

      {/* downgrade ≠ denial teaching callout */}
      {hasDowngrade && (
        <div className="border-t border-amber-100 bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-800">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
            A downgrade is an adjustment — not a denial
          </p>
          <p className="mt-0.5 text-[10px] leading-snug text-amber-700">
            The code was correct; the plan simply pays a lower allowance for it. Bill the service actually delivered
            (never the downgraded code) and post the difference as a documented patient upgrade.
          </p>
        </div>
      )}

      {/* excluded / denied teaching callout */}
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
