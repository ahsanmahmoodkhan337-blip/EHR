/**
 * DentalClaimScrub.tsx — Claim-scrubbing edit checks (pre-submit)
 *
 * Inspired by: the claim scrubber in Dentrix / Open Dental / clearinghouse
 * portals, which run a set of edit checks before a claim is allowed to leave the
 * practice. This component derives its checks from the data layer:
 *   - required attachments from `attachmentsForCode()` (attachmentRequirements.ts)
 *   - required line fields from `CDTCode.requires` (tooth / surface / quadrant /
 *     arch / oral-cavity-area / date-of-prior-placement)
 *   - predetermination + alternate-benefit warnings from the CDT code metadata.
 *
 * Hard errors block submission; warnings let the claim through so the student
 * can feel the payer's response (consistent with the coding queue's existing
 * "hard errors block, warnings don't" rule).
 */

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import {
  attachmentsForCode,
  findCDT,
  isPredeterminationCandidate,
  type DentalCaseScenario,
} from "../../data/dental";
import { useDentalTrack, type DentalClaimLine } from "./DentalTrackStore";

export interface ScrubFinding {
  level: "error" | "warning";
  lineId?: string;
  code?: string;
  message: string;
}

const REQUIREMENT_LABEL: Record<string, string> = {
  tooth: "tooth number",
  surface: "surface(s)",
  quadrant: "quadrant",
  arch: "arch",
  "oral-cavity-area": "oral-cavity area",
  "date-of-prior-placement": "date of prior placement",
};

/**
 * Pure scrub function — reusable by the coding queue (to gate submission) and
 * the billing ledger (to show a summary). Never mutates state.
 */
export function scrubDentalClaim(
  lines: DentalClaimLine[],
  activeCase: DentalCaseScenario | undefined,
): ScrubFinding[] {
  // Reserved for case-aware checks (e.g. the active case's expected procedures).
  void activeCase;
  const findings: ScrubFinding[] = [];
  if (lines.length === 0) {
    findings.push({ level: "error", message: "No claim lines — add at least one CDT service before submitting." });
    return findings;
  }

  for (const line of lines) {
    const cdt = findCDT(line.code);

    // ── required line fields ─────────────────────────────────────────────
    if (cdt) {
      for (const req of cdt.requires) {
        if (req === "none") continue;
        let present = true;
        if (req === "tooth") present = Boolean(line.tooth);
        else if (req === "surface") present = Boolean(line.surfaces);
        else if (req === "quadrant" || req === "arch" || req === "oral-cavity-area") present = Boolean(line.quadrant);
        else if (req === "date-of-prior-placement") present = Boolean(line.priorPlacementDate);
        if (!present) {
          findings.push({
            level: "error",
            lineId: line.id,
            code: line.code,
            message: `${line.code} is missing its required ${REQUIREMENT_LABEL[req] ?? req}. A payer would reject the line as incomplete.`,
          });
        }
      }
    }

    // ── required attachments ─────────────────────────────────────────────
    const reqs = attachmentsForCode(line.code);
    const gathered = new Set(line.attachments ?? []);
    for (const r of reqs) {
      if (!gathered.has(r.type)) {
        findings.push({
          level: "error",
          lineId: line.id,
          code: line.code,
          message: `${line.code} is missing a required attachment: ${r.label}. Missing documentation is the most common denial (${r.missingDenialId ?? "DEN-DOC-MISSING"}).`,
        });
      }
    }

    // ── predetermination warning ─────────────────────────────────────────
    if (cdt && isPredeterminationCandidate(line.code) && !line.predeterminationOnFile) {
      findings.push({
        level: "warning",
        lineId: line.id,
        code: line.code,
        message: `${line.code} is a commonly-predetermined service and no predetermination is on file — the plan decision notice may not be honoured.`,
      });
    }

    // ── alternate-benefit warning ────────────────────────────────────────
    if (cdt?.alternateBenefitRisk) {
      findings.push({
        level: "warning",
        lineId: line.id,
        code: line.code,
        message: `${line.code} carries alternate-benefit risk: the plan may pay at a lower allowance. That is a reduction, not a denial.`,
      });
    }
  }

  return findings;
}

export function DentalClaimScrub({ compact = false }: { compact?: boolean }) {
  const { state, activeCase } = useDentalTrack();
  const findings = useMemo(() => scrubDentalClaim(state.lines, activeCase), [state.lines, activeCase]);

  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          errors.length > 0
            ? "bg-red-50 text-red-700"
            : warnings.length > 0
              ? "bg-amber-50 text-amber-700"
              : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {errors.length > 0 ? (
          <AlertTriangle className="h-3 w-3" />
        ) : warnings.length > 0 ? (
          <Info className="h-3 w-3" />
        ) : (
          <CheckCircle2 className="h-3 w-3" />
        )}
        {errors.length > 0 ? `${errors.length} edit error${errors.length === 1 ? "" : "s"}` : warnings.length > 0 ? `${warnings.length} warning${warnings.length === 1 ? "" : "s"}` : "Clean"}
      </span>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Scrub passed — no edit errors or warnings on this claim.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {errors.map((f, i) => (
        <div key={`e-${i}`} className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
          <p className="text-[10px] text-red-700">
            {f.code && <span className="font-semibold">{f.code}: </span>}
            {f.message}
          </p>
        </div>
      ))}
      {warnings.map((f, i) => (
        <div key={`w-${i}`} className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          <p className="text-[10px] text-amber-700">
            {f.code && <span className="font-semibold">{f.code}: </span>}
            {f.message}
          </p>
        </div>
      ))}
      {errors.length > 0 && (
        <p className="text-[9px] text-slate-400">
          {errors.length} hard error{errors.length === 1 ? "" : "s"} must be corrected before the claim can be sent.
          Warnings are allowed through so you can feel the payer's response.
        </p>
      )}
    </div>
  );
}
