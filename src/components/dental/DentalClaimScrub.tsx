/**
 * DentalClaimScrub.tsx — Claim-scrubbing edit checks (pre-submit checklist)
 *
 * Inspired by: the claim scrubber in Dentrix / Open Dental / clearinghouse
 * portals, which run a set of edit checks before a claim is allowed to leave the
 * practice. This is a *teaching* scrubber, so every finding is a WARNING that
 * explains what the payer will probably do — it never hard-blocks submission
 * (the student should feel the payer's response, not be stopped from sending).
 *
 * WHERE A FINDING COMES FROM (TASK 0, items 2 and 3)
 *  - Missing attachments and predetermination requirements are facts about the
 *    code, so they are raised from `attachmentsForCode()` and
 *    `isPredeterminationCandidate()`.
 *  - A denial is raised ONLY when this case's own facts produce it — paid
 *    history, the patient's age, the plan's rules, the deductible — by reading
 *    the same adjudication the claim and AR screens read. A code that merely
 *    *can* deny no longer produces a flag; the old list of every denial ever
 *    seen against a code is gone.
 *  - The money wording ("patient responsibility" / "provider write-off") comes
 *    from `denialMoney()` in denialReasons.ts, the same function adjudication
 *    uses, so the scrub cannot tell the student to bill a patient the AR screen
 *    says is not billable.
 *
 * Guardrail: an alternate-benefit is rendered as a downgrade (a reduction), never
 * as a denial.
 */

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  attachmentsForCode,
  denialActionLabel,
  denialMoney,
  findPlan,
  isPredeterminationCandidate,
  predeterminationDriverFor,
  type DentalPlan,
} from "../../data/dental";
import { adjudicateDentalClaim, type DentalClaimAdjudication } from "./adjudication";
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

/**
 * Pure scrub function — reusable by the coding queue (pre-submit) and the
 * billing ledger (summary). Returns warnings only; never mutates state.
 *
 * `adjudication` is the result of `adjudicateDentalClaim()` for the same lines.
 * When it is supplied, every denial finding is one this case actually
 * triggers, with the CARC, the money rule and the next action the AR screen
 * will show. When it is absent (no active case, so nothing to adjudicate), only
 * the code-level facts — attachments and predetermination — are raised.
 */
export function scrubDentalClaim(
  lines: DentalClaimLine[],
  _plan: DentalPlan | undefined,
  adjudication?: DentalClaimAdjudication,
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

    // ── 1. missing required attachments (a fact about the code) ─────────
    for (const r of attachmentsForCode(line.code)) {
      if (!line.attachments.includes(r.type)) {
        findings.push({
          category: "Attachment",
          code: line.code,
          message: `Missing required attachment: ${r.label}.${r.missingDenialId ? ` Most often denies as ${r.missingDenialId}.` : ""}`,
        });
      }
    }

    // ── 2. predetermination-required codes (a fact about the code) ──────
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

    // ── 3. what THIS case's facts do to this line ───────────────────────
    const result = adjudication?.lines.find((l) => l.lineId === line.id);
    if (result?.denial) {
      const denial = result.denial;
      findings.push({
        category: "Denial risk",
        code: line.code,
        message: `${denial.carc} ${denial.title}. ${denialMoney(denial).label}. Expected next step: ${denialActionLabel(denial)}.${
          result.result.blockedReason ? ` Why this line: ${result.result.blockedReason}` : ""
        }`,
      });
    } else if (result?.isDowngrade) {
      findings.push({
        category: "Downgrade",
        code: line.code,
        message: `Alternate benefit applies: the plan pays at the ${result.result.alternateBenefit?.paidAtCode ?? "cheaper"} allowance — a reduction (downgrade), NOT a denial.`,
      });
    }

    // A code with no case context and no adjudicated result raises no denial
    // risk: "this code can deny" is not a finding, it is a library entry.
  }

  return findings;
}

export function DentalClaimScrub({ compact = false }: { compact?: boolean }) {
  const { state, planId, activeCase } = useDentalTrack();
  const plan = useMemo(() => findPlan(planId), [planId]);
  const adjudication = useMemo(
    () => adjudicateDentalClaim(state.lines, activeCase),
    [state.lines, activeCase],
  );
  const findings = useMemo(
    () => scrubDentalClaim(state.lines, plan, adjudication),
    [state.lines, plan, adjudication],
  );

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
        Scrub passed — no attachment, predetermination, frequency, age or downgrade flags on these lines.
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
