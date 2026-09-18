/**
 * adjudication.ts — Dental claim adjudication adapter (ADA J430D / payer walk)
 *
 * Inspired by: payer claim-adjudication engines. This is a THIN adapter over
 * the dental data layer's `evaluateClaim()` — it assembles the case context
 * (plan, coverage patient, paid history, deductible, annual-maximum consumed,
 * secondary coverage) and maps the coder's claim lines into the evaluator's
 * input shape. It deliberately contains NO benefit logic of its own; the
 * twelve-step walk, denial selection and downgrade maths all live in
 * `~/data/dental/coverage.ts` so the UI and the data layer cannot drift.
 *
 * Contract notes (integration spec §2):
 *  - `evaluateClaim()` threads the deductible and consumed annual maximum
 *    line-to-line, so it is always used for multi-line claims (never per-line
 *    `evaluateCoverage()`, which would double-apply the deductible).
 *  - Contracted allowances (`allowedUsd`, `alternateBenefitAllowedUsd`) are
 *    scenario inputs. When the case supplies them we pass them through;
 *    otherwise the evaluator falls back to the charged amount and says so.
 *  - A downgrade (alternate benefit) is a covered-at-reduced-allowance result,
 *    surfaced via `isDowngrade`, and is NEVER treated as a denial.
 */

import {
  evaluateClaim,
  findDenial,
  findPlan,
  type CoverageResult,
  type CoverageStepResult,
  type DentalCaseScenario,
  type DentalDenial,
} from "../../data/dental";
import type { DentalClaimLine } from "./DentalTrackStore";

/** A single adjudication step, aligned to `ADJUDICATION_ORDER`. */
export type TraceStep = CoverageStepResult;

export interface DentalLineAdjudication {
  lineId: string;
  claimLine: DentalClaimLine;
  code: string;
  /** Raw evaluator result for this line. */
  result: CoverageResult;
  /** Hard denial (plan pays nothing) resolved from `result.denialId`. */
  denial?: DentalDenial;
  /** True when an alternate benefit downgraded the allowance (still covered). */
  isDowngrade: boolean;
}

export interface DentalClaimAdjudication {
  lines: DentalLineAdjudication[];
  totals: {
    chargedUsd: number;
    allowedUsd: number;
    planPaysUsd: number;
    patientOwesUsd: number;
    writeOffUsd: number;
  };
}

/**
 * Adjudicate a dental claim built from the coder's claim lines.
 *
 * Returns an empty result when there is no active case (free-play is not
 * adjudicable without a coverage patient) or when there are no lines.
 */
export function adjudicateDentalClaim(
  lines: DentalClaimLine[],
  activeCase: DentalCaseScenario | undefined,
): DentalClaimAdjudication {
  const empty: DentalClaimAdjudication = {
    lines: [],
    totals: { chargedUsd: 0, allowedUsd: 0, planPaysUsd: 0, patientOwesUsd: 0, writeOffUsd: 0 },
  };
  if (!activeCase || lines.length === 0) return empty;

  const plan = findPlan(activeCase.planId);
  if (!plan) return empty;

  // ── Case → evaluator context ─────────────────────────────────────────────
  const patient = {
    ageAtServiceDate: activeCase.patient.ageAtServiceDate,
    monthsCoveredAtServiceDate: activeCase.patient.monthsCoveredAtServiceDate,
    coverageEffectiveDate: activeCase.patient.coverageEffectiveDate,
  };

  const history = activeCase.eligibilitySnapshot.paidHistory;
  const deductibleAlreadyMetUsd = activeCase.eligibilitySnapshot.deductibleMetUsd;
  // `remainingAnnualMaximumUsd` is what is LEFT; convert to what is consumed.
  const benefitUsedUsd =
    plan.annualMaximumUsd !== null && activeCase.eligibilitySnapshot.remainingAnnualMaximumUsd !== null
      ? Math.max(0, plan.annualMaximumUsd - activeCase.eligibilitySnapshot.remainingAnnualMaximumUsd)
      : 0;
  const secondaryPlan = activeCase.patient.secondaryCoverage
    ? findPlan(activeCase.patient.secondaryCoverage.planId)
    : undefined;

  // ── Coder lines → ClaimLineInput[] ───────────────────────────────────────
  const claimLines = lines.map((l, i) => {
    const expected = activeCase.expectedOutcome.find((o) => o.code === l.code);
    return {
      line: i + 1,
      code: l.code,
      dateOfService: l.dateOfService,
      chargedUsd: l.feeUsd,
      tooth: l.tooth ? { universal: l.tooth } : undefined,
      quadrant: l.quadrant,
      allowedUsd: expected?.allowedUsd,
      alternateBenefitAllowedUsd: expected?.alternateBenefitAllowedUsd,
    };
  });

  const evaluated = evaluateClaim({
    plan,
    patient,
    lines: claimLines,
    history,
    deductibleAlreadyMetUsd,
    benefitUsedUsd,
    secondaryPlan,
  });

  const adjudications = evaluated.lines.map((r) => {
    const claimLine = lines[r.line - 1] as DentalClaimLine;
    // A downgrade still pays something, so it is NOT a denial even though the
    // evaluator tags it with `denialId: "DEN-ALT-BENEFIT"`.
    const denial = r.denialId && !r.payable ? findDenial(r.denialId) : undefined;
    return {
      lineId: claimLine.id,
      claimLine,
      code: r.code,
      result: r,
      denial,
      isDowngrade: Boolean(r.alternateBenefit),
    };
  });

  return {
    lines: adjudications,
    totals: {
      chargedUsd: evaluated.totals.chargedUsd,
      allowedUsd: evaluated.totals.allowedUsd,
      planPaysUsd: evaluated.totals.planPaysUsd,
      patientOwesUsd: evaluated.totals.patientOwesUsd,
      writeOffUsd: evaluated.totals.writeOffUsd,
    },
  };
}

/** Resolved denial for a line result, honoring the downgrade-is-not-a-denial rule. */
export function denialForResult(result: CoverageResult): DentalDenial | undefined {
  if (result.denialId && !result.payable) return findDenial(result.denialId);
  return undefined;
}
