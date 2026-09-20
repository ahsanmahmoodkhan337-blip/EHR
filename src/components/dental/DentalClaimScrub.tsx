/**
 * DentalClaimScrub.tsx — Claim-scrubbing edit checks (pre-submit checklist)
 *
 * Inspired by: the claim scrubber in Dentrix / Open Dental / clearinghouse
 * portals, which run a set of edit checks before a claim is allowed to leave the
 * practice. This is a *teaching* scrubber, so every finding is a WARNING that
 * explains what the payer will probably do — it never hard-blocks submission
 * (the student should feel the payer's response, not be stopped from sending).
 *
 * Drives entirely from already-merged data:
 *   - missing required attachments      → `attachmentsForCode()`
 *   - predetermination-required codes   → `isPredeterminationCandidate()` +
 *     `predeterminationDriverFor()`
 *   - frequency + waiting-period hits   → `frequencyRulesFor()` +
 *     `DentalPlan.waitingPeriods`
 *   - expected downgrade-vs-denial      → `alternateBenefitFor()` +
 *     `CDTCode.commonDenials`
 *
 * Guardrail: an alternate-benefit is rendered as a downgrade (a reduction), never
 * as a denial.
 */

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  alternateBenefitFor,
  attachmentsForCode,
  findCDT,
  findDenial,
  findPlan,
  frequencyRulesFor,
  isPredeterminationCandidate,
  predeterminationDriverFor,
  type BenefitClass,
  type DentalPlan,
} from "../../data/dental";
import { useDentalTrack, type DentalClaimLine } from "./DentalTrackStore";

export type ScrubCategory =
  | "Attachment"
  | "Predetermination"
  | "Frequency"
  | "Waiting period"
  | "Downgrade"
  | "Denial risk";

export interface ScrubFinding {
  category: ScrubCategory;
  code?: string;
  message: string;
}

const CATEGORY_BADGE: Record<ScrubCategory, string> = {
  Attachment: "status-badge is-warning",
  Predetermination: "status-badge is-info",
  Frequency: "status-badge is-warning",
  "Waiting period": "status-badge is-warning",
  Downgrade: "status-badge is-info",
  "Denial risk": "status-badge is-danger",
};

/** "Adjunctive" prices like Basic for waiting-period purposes (same rule the evaluator uses). */
function waitingMonths(plan: DentalPlan, cls: BenefitClass): number {
  switch (cls === "Adjunctive" ? "Basic" : cls) {
    case "Preventive":
      return plan.waitingPeriods.preventiveMonths;
    case "Basic":
      return plan.waitingPeriods.basicMonths;
    case "Major":
      return plan.waitingPeriods.majorMonths;
    case "Orthodontic":
      return plan.waitingPeriods.orthodonticMonths;
  }
}

/** Universal-numbering posterior teeth (premolars + molars). */
function isPosteriorTooth(n: number): boolean {
  return (n >= 1 && n <= 5) || (n >= 12 && n <= 16) || (n >= 17 && n <= 21) || (n >= 28 && n <= 32);
}

/**
 * Pure scrub function — reusable by the coding queue (pre-submit) and the
 * billing ledger (summary). Returns warnings only; never mutates state.
 */
export function scrubDentalClaim(
  lines: DentalClaimLine[],
  plan: DentalPlan | undefined,
): ScrubFinding[] {
  const findings: ScrubFinding[] = [];
  if (lines.length === 0) {
    findings.push({
      category: "Attachment",
      message: "No claim lines yet — add at least one CDT service before submitting.",
    });
    return findings;
  }

  for (const line of lines) {
    const cdt = findCDT(line.code);

    // ── 1. missing required attachments ─────────────────────────────────
    for (const r of attachmentsForCode(line.code)) {
      if (!line.attachments.includes(r.type)) {
        findings.push({
          category: "Attachment",
          code: line.code,
          message: `Missing required attachment: ${r.label}.${r.missingDenialId ? ` Most often denies as ${r.missingDenialId}.` : ""}`,
        });
      }
    }

    // ── 2. predetermination-required codes ──────────────────────────────
    if (isPredeterminationCandidate(line.code)) {
      const driver = predeterminationDriverFor(line.code);
      findings.push({
        category: "Predetermination",
        code: line.code,
        message: line.predeterminationOnFile
          ? `Commonly predeterminated (${(driver ?? "plan decision").replace(/-/g, " ")}) — a predetermination is on file.`
          : `Commonly predeterminated (${(driver ?? "plan decision").replace(/-/g, " ")}); no predetermination on file, so the payer may not honour a prior estimate.`,
      });
    }

    // ── 3. frequency + waiting-period hits ──────────────────────────────
    if (plan) {
      for (const f of frequencyRulesFor(plan, line.code)) {
        findings.push({
          category: "Frequency",
          code: line.code,
          message: `${f.label} — allowed ${f.timesAllowed}× per ${f.windowMonths} months (${f.basis === "rolling-from-last-service" ? "rolling from last service" : "benefit period"}).`,
        });
      }

      if (cdt) {
        const w = waitingMonths(plan, cdt.typicalBenefitClass);
        if (w > 0) {
          findings.push({
            category: "Waiting period",
            code: line.code,
            message: `${cdt.typicalBenefitClass} services carry a ${w}-month waiting period on this plan.`,
          });
        }
      }
    }

    // ── 4. expected downgrade-vs-denial ─────────────────────────────────
    if (plan && cdt) {
      const posterior = line.tooth ? isPosteriorTooth(Number(line.tooth)) : undefined;
      const alt = alternateBenefitFor(plan, line.code, posterior);
      if (alt) {
        findings.push({
          category: "Downgrade",
          code: line.code,
          message: `Alternate benefit applies: pays at the ${alt.paidAtCode} allowance — a reduction (downgrade), NOT a denial.`,
        });
      }
      for (const dId of cdt.commonDenials ?? []) {
        const d = findDenial(dId);
        findings.push({
          category: "Denial risk",
          code: line.code,
          message: d
            ? `${d.title} — ${d.groupCode === "PR" ? "patient responsibility" : "not billable to patient (correct & resubmit)"}.`
            : `${dId} is a common denial for this code.`,
        });
      }
    }
  }

  return findings;
}

export function DentalClaimScrub({ compact = false }: { compact?: boolean }) {
  const { state, planId } = useDentalTrack();
  const plan = useMemo(() => findPlan(planId), [planId]);
  const findings = useMemo(() => scrubDentalClaim(state.lines, plan), [state.lines, plan]);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          findings.length > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {findings.length > 0 ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
        {findings.length > 0 ? `${findings.length} flag${findings.length === 1 ? "" : "s"}` : "Clean"}
      </span>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Scrub passed — no attachment, predetermination, frequency, waiting-period or downgrade flags.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="data-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Check</th>
              <th>What the payer will likely do</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f, i) => (
              <tr key={i}>
                <td className="font-medium text-slate-700">{f.code ?? "—"}</td>
                <td>
                  <span className={CATEGORY_BADGE[f.category]}>{f.category}</span>
                </td>
                <td className="text-slate-600">{f.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[9px] text-slate-400">
        These are warnings, not blocks — this is a teaching sim. Send the claim anyway and the payer's response
        (claim status / ERA) will show you whether each flag actually bit.
      </p>
    </div>
  );
}
