/**
 * Dental Coverage Evaluator — runnable benefit rules engine
 *
 * Answers the question a dental front office asks fifty times a day: "is this
 * code payable for this patient today, and if not, why not?"
 *
 * This is the executable counterpart to `ADJUDICATION_ORDER` in
 * benefitRules.ts, and the single source of truth for dental adjudication.
 * It walks the same twelve steps in the same order a payer's system does and
 * returns a verdict per step, so a student sees exactly where a claim died
 * rather than just being told the total. The ordering is load-bearing: it is
 * why a perfectly coded, fully documented, pre-authorised claim can still pay
 * nothing when the annual maximum is reached at step 11.
 *
 * PURE DATA-LAYER LOGIC
 * No React, no I/O, no clock reads — every date comes in as a parameter so
 * results are deterministic and testable. Amounts in, amounts out.
 *
 * WHAT THIS IS NOT
 * Not a real adjudicator and not advice. Contracted allowances are INPUTS,
 * because no fee schedule ships with this repo and inventing one would teach
 * students false numbers. Where an allowance is not supplied the charged
 * amount is used and the step says so.
 *
 * INPUT SHAPE
 * Deliberately a superset of the UI-side trace contract, so a component that
 * already assembled a trace input can pass it straight through: `plan` accepts
 * a plan id or the object, and the patient object may carry `deductibleMetUsd`,
 * `remainingAnnualMaximumUsd`, `paidHistory` and `hasSecondaryCoverage`
 * instead of passing them at the top level.
 *
 * All plans referenced are the fictional teaching plans in benefitRules.ts.
 */

import type { CDTCode, BenefitClass } from "./cdtCodes";
import { findCDT } from "./cdtCodes";
import type { DentalPlan, FrequencyLimit } from "./benefitRules";
import {
  ADJUDICATION_ORDER,
  COB_EXPLANATIONS,
  ageRuleFor,
  alternateBenefitFor,
  findPlan,
  frequencyRulesFor,
} from "./benefitRules";
import { denialsForCode } from "./denialReasons";
import { findTooth } from "./toothNotation";

export type StepVerdict = "pass" | "reduced" | "blocked" | "n/a";

export interface CoverageStepResult {
  /** 1-12, matching ADJUDICATION_ORDER. */
  step: number;
  /** Rule name, taken from ADJUDICATION_ORDER so the two never drift. */
  rule: string;
  verdict: StepVerdict;
  /** Student-facing account of what this step decided and why. */
  explanation: string;
  /**
   * Running amount after this step: the allowance while the allowance is
   * still being established, then the plan's payment once coinsurance has
   * been applied. `null` once a step has blocked the line.
   */
  runningAllowedUsd: number | null;
}

/** A previously paid service, shaped like `eligibilitySnapshot.paidHistory`. */
export interface PaidHistoryEntry {
  code: string;
  tooth?: string;
  quadrant?: string;
  date: string;
  note?: string;
}

export interface CoveragePatient {
  /** Age on the date of service — age limits are tested on that date, not at enrolment. */
  ageAtServiceDate: number;
  /** Months of continuous coverage on the date of service — drives waiting periods. */
  monthsCoveredAtServiceDate: number;
  coverageEffectiveDate: string;
  /** Optional termination date, where coverage has ended. */
  coverageEndDate?: string;
  /** Deductible already satisfied this benefit period. Alternative to the top-level field. */
  deductibleMetUsd?: number;
  /** Remaining annual maximum, as an eligibility check reports it. `null` = uncapped. */
  remainingAnnualMaximumUsd?: number | null;
  /** Paid history, as an eligibility check reports it. Alternative to the top-level field. */
  paidHistory?: PaidHistoryEntry[];
  /** Set when a secondary plan exists but the plan object is not to hand. */
  hasSecondaryCoverage?: boolean;
}

export interface ToothContext {
  /** Universal designation, e.g. "30" or "K". */
  universal?: string;
  /** Overrides the lookup; otherwise derived from `universal`. */
  isPosterior?: boolean;
  /** When the tooth was lost — the missing tooth clause turns on this. */
  extractionDate?: string;
}

export interface CoverageInput {
  /** Plan object, or a plan id to resolve from DENTAL_PLANS. */
  plan: DentalPlan | string;
  /** CDT code string or the code object itself. */
  code: string | CDTCode;
  /** Per-line date of service. Crowns often use the cementation date, which can fall in the next benefit year. */
  dateOfService: string;
  patient: CoveragePatient;
  /**
   * Tooth context. A bare Universal designation is accepted for convenience;
   * the object form is needed to supply an extraction date.
   */
  tooth?: ToothContext | string;
  /** Area of the oral cavity ("01"-"04", "10", "20", "00") for quadrant- and arch-scoped rules. */
  quadrant?: string;
  /** Surfaces on the line. Not used in adjudication; accepted so a claim line can be passed whole. */
  surfaces?: string;
  /** Practice's charged fee. Defaults to the code's illustrative fee. */
  chargedUsd?: number;
  /** Contracted allowance. Defaults to the charged amount (i.e. no contract). */
  allowedUsd?: number;
  /** Allowance of the downgrade benchmark, where an alternate benefit applies. */
  alternateBenefitAllowedUsd?: number;
  /** Whether a predetermination is on file — step 7 teaching context only. */
  predeterminationOnFile?: boolean;
  /** Deductible already satisfied this benefit period, before this line. */
  deductibleAlreadyMetUsd?: number;
  /** Benefit already consumed this period, before this line. */
  benefitUsedUsd?: number;
  /** Remaining annual maximum. Takes precedence over `benefitUsedUsd` when supplied. */
  remainingAnnualMaximumUsd?: number | null;
  /** Secondary plan, for the coordination step. */
  secondaryPlan?: DentalPlan | string;
  /** History of paid services. Falls back to `patient.paidHistory`. */
  history?: PaidHistoryEntry[];
}

export interface CoverageResult {
  code: string;
  dateOfService: string;
  steps: CoverageStepResult[];
  /** True when the plan pays something toward this line. */
  payable: boolean;
  chargedUsd: number;
  allowedUsd: number;
  /** Charged minus allowed. In network this is not billable to the patient. */
  contractualWriteOffUsd: number;
  deductibleAppliedUsd: number;
  /** Patient's share arising from the coinsurance split alone. */
  coinsurancePatientUsd: number;
  /** Amount the annual maximum removed from what would otherwise have been paid. */
  annualMaxReductionUsd: number;
  planPaysUsd: number;
  patientOwesUsd: number;
  /** Step that blocked the line, where one did. */
  blockedAtStep?: number;
  blockedReason?: string;
  /** Denial id from denialReasons.ts, where a step blocked or reduced the line. */
  denialId?: string;
  /**
   * Alternate benefit detail, where one applied. This is a REDUCTION, never a
   * denial — the service was covered, at a lower allowance. UI must not
   * render it as a denial.
   */
  alternateBenefit?: {
    id: string;
    paidAtCode: string;
    explanation: string;
    studentAction: string[];
  };
  /** One-line plain-language outcome. */
  summary: string;
}

/* ------------------------------------------------------------------ */
/* Date helpers — all comparisons are on calendar dates, no clock.     */
/* ------------------------------------------------------------------ */

function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

/** Whole months from one date to another, not counting a partial final month. */
function monthsBetween(earlierIso: string, laterIso: string): number {
  const a = toDate(earlierIso);
  const b = toDate(laterIso);
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) months -= 1;
  return months;
}

/**
 * Start of the benefit period containing `dateOfService`.
 *
 * Calendar-year plans reset on 1 January. Anniversary plans reset on the
 * month and day the member's coverage began, which is why the same treatment
 * can land in different periods under two plans on the same date.
 */
function benefitPeriodStart(plan: DentalPlan, dateOfService: string, coverageEffectiveDate: string): Date {
  const dos = toDate(dateOfService);
  if (plan.benefitPeriod === "calendar-year") {
    return new Date(Date.UTC(dos.getUTCFullYear(), 0, 1));
  }
  const eff = toDate(coverageEffectiveDate);
  const anniversary = new Date(Date.UTC(dos.getUTCFullYear(), eff.getUTCMonth(), eff.getUTCDate()));
  if (anniversary.getTime() > dos.getTime()) {
    anniversary.setUTCFullYear(anniversary.getUTCFullYear() - 1);
  }
  return anniversary;
}

/** Maps the five benefit classes onto the four a plan prices. */
function priceableClass(benefitClass: BenefitClass): "Preventive" | "Basic" | "Major" | "Orthodontic" {
  // Adjunctive services (sedation, after-hours visits) are not priced as their
  // own tier by these plan designs, so they follow the Basic percentage.
  return benefitClass === "Adjunctive" ? "Basic" : benefitClass;
}

function waitingPeriodMonths(plan: DentalPlan, benefitClass: BenefitClass): number {
  switch (priceableClass(benefitClass)) {
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

const round2 = (n: number): number => Math.round(n * 100) / 100;
const money = (n: number): string => `$${round2(n).toFixed(2)}`;

/** Picks the denial that best describes a failure, using the bidirectional code/denial links. */
function denialFor(code: string, category: string): string | undefined {
  return denialsForCode(code).find((d) => d.category === category)?.id;
}

/** Arch a history entry or tooth belongs to, for arch-scoped frequency rules. */
function archOf(entry: { tooth?: string; quadrant?: string }): string | undefined {
  if (entry.quadrant === "10" || entry.quadrant === "20") return entry.quadrant;
  const quadrantArch: Record<string, string> = { "01": "10", "02": "10", "03": "20", "04": "20" };
  if (entry.quadrant && quadrantArch[entry.quadrant]) return quadrantArch[entry.quadrant];
  if (entry.tooth) {
    const t = findTooth(entry.tooth);
    if (t) return t.arch === "maxillary" ? "10" : "20";
  }
  return undefined;
}

/**
 * Whether a paid-history entry counts against a frequency rule.
 *
 * The entry must belong to the rule's code GROUP, not just be the same code —
 * a two-image bitewing set paid last year counts against a four-image set
 * today, because the plan limits bitewings, not a particular code.
 */
function historyCountsForRule(
  rule: FrequencyLimit,
  entry: PaidHistoryEntry,
  tooth: ToothContext | undefined,
  quadrant: string | undefined,
): boolean {
  if (!rule.appliesToCodes.includes(entry.code)) return false;
  switch (rule.scope) {
    case "per-patient":
      return true;
    case "per-tooth":
    case "per-surface":
      return Boolean(tooth?.universal) && entry.tooth === tooth?.universal;
    case "per-quadrant":
      return Boolean(quadrant) && entry.quadrant === quadrant;
    case "per-arch": {
      const a = archOf({ tooth: tooth?.universal, quadrant });
      const b = archOf(entry);
      return Boolean(a) && a === b;
    }
  }
}

/* ------------------------------------------------------------------ */
/* The evaluator                                                       */
/* ------------------------------------------------------------------ */

/**
 * Runs one claim line through the twelve adjudication steps.
 *
 * Evaluation stops accumulating money at the first blocking step, but every
 * remaining step is still reported (as `n/a`) so the student sees the full
 * sequence and learns where their line fell over.
 */
export function evaluateCoverage(input: CoverageInput): CoverageResult {
  const plan = typeof input.plan === "string" ? findPlan(input.plan) : input.plan;
  const { dateOfService, patient, predeterminationOnFile } = input;
  const tooth: ToothContext | undefined =
    typeof input.tooth === "string" ? { universal: input.tooth } : input.tooth;
  const quadrant = input.quadrant;
  const history = input.history ?? patient.paidHistory ?? [];
  const deductibleAlreadyMet = input.deductibleAlreadyMetUsd ?? patient.deductibleMetUsd ?? 0;
  const secondaryPlan =
    typeof input.secondaryPlan === "string" ? findPlan(input.secondaryPlan) : input.secondaryPlan;

  const cdt = typeof input.code === "string" ? findCDT(input.code) : input.code;
  const codeStr = typeof input.code === "string" ? input.code.trim().toUpperCase() : input.code.code;

  const steps: CoverageStepResult[] = [];
  const nameOf = (step: number) => ADJUDICATION_ORDER.find((s) => s.step === step)?.rule ?? `Step ${step}`;
  const record = (step: number, verdict: StepVerdict, explanation: string, running: number | null) =>
    steps.push({ step, rule: nameOf(step), verdict, explanation, runningAllowedUsd: running });

  const charged = round2(input.chargedUsd ?? cdt?.illustrativeFeeUsd ?? 0);
  const allowed = round2(input.allowedUsd ?? charged);

  /* --- unknown code: bail out cleanly rather than throwing --- */
  if (!plan || !cdt) {
    const what = !plan ? `Plan "${String(input.plan)}"` : `Procedure code "${codeStr}"`;
    record(1, "blocked", `${what} is not in this repository's teaching data, so the line cannot be adjudicated.`, null);
    for (let s = 2; s <= 12; s++) record(s, "n/a", "Not evaluated.", null);
    return {
      code: codeStr,
      dateOfService,
      steps,
      payable: false,
      chargedUsd: charged,
      allowedUsd: 0,
      contractualWriteOffUsd: 0,
      deductibleAppliedUsd: 0,
      coinsurancePatientUsd: 0,
      annualMaxReductionUsd: 0,
      planPaysUsd: 0,
      patientOwesUsd: 0,
      blockedAtStep: 1,
      blockedReason: `${what} not found.`,
      summary: `${what} not found.`,
    };
  }

  const cls = cdt.typicalBenefitClass;
  const benefitUsed =
    input.remainingAnnualMaximumUsd !== undefined && input.remainingAnnualMaximumUsd !== null
      ? Math.max(0, (plan.annualMaximumUsd ?? 0) - input.remainingAnnualMaximumUsd)
      : patient.remainingAnnualMaximumUsd !== undefined && patient.remainingAnnualMaximumUsd !== null
        ? Math.max(0, (plan.annualMaximumUsd ?? 0) - patient.remainingAnnualMaximumUsd)
        : (input.benefitUsedUsd ?? 0);

  let blocked = false;
  let blockedAtStep: number | undefined;
  let blockedReason: string | undefined;
  let denialId: string | undefined;
  let alternateBenefit: CoverageResult["alternateBenefit"];

  const block = (step: number, explanation: string, denial?: string) => {
    record(step, "blocked", explanation, null);
    blocked = true;
    blockedAtStep = step;
    blockedReason = explanation;
    denialId = denial;
  };

  // ── Step 1 — eligibility on the date of service ──────────────────
  const monthsSinceEffective = monthsBetween(patient.coverageEffectiveDate, dateOfService);
  if (toDate(dateOfService).getTime() < toDate(patient.coverageEffectiveDate).getTime()) {
    block(
      1,
      `Coverage began on ${patient.coverageEffectiveDate}, after this ${dateOfService} date of service. Nothing later in the sequence matters.`,
      "DEN-NOT-ELIGIBLE",
    );
  } else if (patient.coverageEndDate && toDate(dateOfService).getTime() > toDate(patient.coverageEndDate).getTime()) {
    block(
      1,
      `Coverage ended on ${patient.coverageEndDate}, before this ${dateOfService} date of service.`,
      "DEN-NOT-ELIGIBLE",
    );
  } else {
    record(1, "pass", `Active on ${dateOfService}, ${monthsSinceEffective} months after the coverage start date.`, allowed);
  }

  // ── Step 2 — is it a covered benefit at all? ─────────────────────
  if (!blocked) {
    const codeExcluded = plan.excludedCodes?.includes(cdt.code);
    const categoryExcluded = plan.excludedCategories?.includes(cdt.category);
    const ageExcluded = plan.ageRestrictedExclusions?.find(
      (x) => x.codes.includes(cdt.code) && patient.ageAtServiceDate >= x.excludedFromAgeInclusive,
    );
    if (codeExcluded || categoryExcluded) {
      block(
        2,
        `${plan.planName} excludes ${categoryExcluded ? `the whole ${cdt.category} category` : "this service"}. An exclusion is absolute — it is not reduced, it is simply not covered, and no clinical argument changes that.`,
        "DEN-NOT-COVERED",
      );
    } else if (ageExcluded) {
      block(2, ageExcluded.note, "DEN-NOT-COVERED");
    } else {
      record(2, "pass", `Covered in principle under ${plan.planName} as a ${cls} service.`, allowed);
    }
  } else {
    record(2, "n/a", "Not reached: the patient was not eligible on this date.", null);
  }

  // ── Step 3 — waiting period ──────────────────────────────────────
  if (!blocked) {
    const wait = waitingPeriodMonths(plan, cls);
    if (patient.monthsCoveredAtServiceDate < wait) {
      block(
        3,
        `${priceableClass(cls)} services need ${wait} months of continuous coverage; the patient has ${patient.monthsCoveredAtServiceDate}. The treatment can still be done — it is simply the patient's cost until the waiting period is satisfied.`,
        "DEN-WAITING",
      );
    } else {
      record(
        3,
        "pass",
        wait === 0
          ? `No waiting period applies to ${priceableClass(cls)} services on this plan.`
          : `${wait}-month waiting period satisfied (${patient.monthsCoveredAtServiceDate} months covered).`,
        allowed,
      );
    }
  } else {
    record(3, "n/a", "Not reached.", null);
  }

  // ── Step 4 — age limit ───────────────────────────────────────────
  if (!blocked) {
    const ageRule = ageRuleFor(plan, cdt.code);
    if (!ageRule) {
      record(4, "n/a", "No age limit governs this service on this plan.", allowed);
    } else if (ageRule.maxAgeInclusive !== undefined && patient.ageAtServiceDate > ageRule.maxAgeInclusive) {
      block(
        4,
        `${ageRule.label}: covered to age ${ageRule.maxAgeInclusive} inclusive, and the patient is ${patient.ageAtServiceDate} on the date of service. Age is tested on that date — a birthday between two appointments changes the answer.`,
        "DEN-AGE-LIMIT",
      );
    } else if (ageRule.minAgeInclusive !== undefined && patient.ageAtServiceDate < ageRule.minAgeInclusive) {
      block(4, `${ageRule.label}: not covered below age ${ageRule.minAgeInclusive}.`, "DEN-AGE-LIMIT");
    } else {
      record(4, "pass", `Within the age range for ${ageRule.label}.`, allowed);
    }
  } else {
    record(4, "n/a", "Not reached.", null);
  }

  // ── Step 5 — frequency and history ───────────────────────────────
  if (!blocked) {
    const rules = frequencyRulesFor(plan, cdt.code);
    if (rules.length === 0) {
      record(5, "n/a", "No frequency limit governs this service on this plan.", allowed);
    } else {
      const periodStart = benefitPeriodStart(plan, dateOfService, patient.coverageEffectiveDate);
      const dos = toDate(dateOfService);
      const violations: string[] = [];
      const passes: string[] = [];
      const unscoped: string[] = [];

      for (const rule of rules) {
        // A scoped rule cannot be evaluated without its scope key. Say so
        // rather than passing silently, which would look like a clean claim.
        if (rule.scope === "per-quadrant" && !quadrant) {
          unscoped.push(`${rule.label} is measured per quadrant, but no area of the oral cavity was supplied.`);
          continue;
        }
        if ((rule.scope === "per-tooth" || rule.scope === "per-surface") && !tooth?.universal) {
          unscoped.push(`${rule.label} is measured per tooth, but no tooth was supplied.`);
          continue;
        }

        const relevant = history.filter((h) => historyCountsForRule(rule, h, tooth, quadrant));
        const inWindow = relevant.filter((h) => {
          const d = toDate(h.date);
          if (d.getTime() >= dos.getTime()) return false;
          return rule.basis === "benefit-period"
            ? d.getTime() >= periodStart.getTime()
            : monthsBetween(h.date, dateOfService) < rule.windowMonths;
        });
        if (inWindow.length >= rule.timesAllowed) {
          const last = inWindow.map((h) => h.date).sort().reverse()[0]!;
          violations.push(
            rule.basis === "benefit-period"
              ? `${rule.label}: ${rule.timesAllowed} allowed per benefit period, ${inWindow.length} already used (most recent ${last}).`
              : `${rule.label}: ${rule.timesAllowed} allowed every ${rule.windowMonths} months ${rule.scope.replace("-", " ")}, and one was paid on ${last}, ${monthsBetween(last, dateOfService)} months ago. The window runs from the last date of service, not from January.`,
          );
        } else {
          passes.push(`${rule.label}: ${inWindow.length} of ${rule.timesAllowed} used.`);
        }
      }

      if (violations.length > 0) {
        // Where two rules govern a code, the strictest binds.
        block(5, violations.join(" "), denialFor(cdt.code, "Frequency"));
      } else {
        const notes = [...passes, ...unscoped];
        record(
          5,
          unscoped.length > 0 ? "n/a" : "pass",
          rules.length > 1
            ? `All ${rules.length} frequency rules governing this code were checked — ${notes.join(" ")}`
            : notes.join(" "),
          allowed,
        );
      }
    }
  } else {
    record(5, "n/a", "Not reached.", null);
  }

  // ── Step 6 — missing tooth clause ────────────────────────────────
  if (!blocked) {
    const clause = plan.missingToothClause;
    if (!clause.applies || !cdt.isToothReplacement) {
      record(
        6,
        "n/a",
        !clause.applies
          ? "This plan design does not apply a missing tooth clause."
          : "Not a tooth replacement service, so the clause is not tested.",
        allowed,
      );
    } else if (!tooth?.extractionDate) {
      record(
        6,
        "n/a",
        "A missing tooth clause applies to this plan, but no extraction date was supplied. Establish it before quoting — this is the question that decides the case.",
        allowed,
      );
    } else {
      const lostBeforeCoverage =
        toDate(tooth.extractionDate).getTime() < toDate(patient.coverageEffectiveDate).getTime();
      const waived =
        clause.waivedAfterContinuousMonths !== undefined &&
        patient.monthsCoveredAtServiceDate >= clause.waivedAfterContinuousMonths;
      if (!lostBeforeCoverage) {
        record(6, "pass", `Tooth was extracted on ${tooth.extractionDate}, after coverage began, so the clause does not apply.`, allowed);
      } else if (waived) {
        record(
          6,
          "pass",
          `Tooth was lost before coverage began, but the clause is waived after ${clause.waivedAfterContinuousMonths} months of continuous coverage and the patient has ${patient.monthsCoveredAtServiceDate}.`,
          allowed,
        );
      } else {
        const waitNote =
          clause.waivedAfterContinuousMonths !== undefined
            ? ` The clause drops away at ${clause.waivedAfterContinuousMonths} months of continuous coverage — ${clause.waivedAfterContinuousMonths - patient.monthsCoveredAtServiceDate} months from now — so the patient has a genuine choice about timing.`
            : "";
        block(
          6,
          `Tooth was extracted on ${tooth.extractionDate}, before coverage began on ${patient.coverageEffectiveDate}. The clause applies to any replacement, however it is done — bridge, partial or implant.${waitNote}`,
          "DEN-MISSING-TOOTH",
        );
      }
    }
  } else {
    record(6, "n/a", "Not reached.", null);
  }

  // ── Step 7 — alternate benefit ───────────────────────────────────
  let benefitBase = allowed;
  if (!blocked) {
    const isPosterior = tooth?.isPosterior ?? (tooth?.universal ? findTooth(tooth.universal)?.posterior : undefined);
    const alt = alternateBenefitFor(plan, cdt.code, isPosterior);
    if (!alt) {
      record(7, "n/a", "No alternate benefit provision applies to this service.", allowed);
    } else {
      denialId = denialId ?? "DEN-ALT-BENEFIT";
      alternateBenefit = {
        id: alt.id,
        paidAtCode: alt.paidAtCode,
        explanation: alt.explanation,
        studentAction: alt.studentAction,
      };
      const benchmark = input.alternateBenefitAllowedUsd;
      const predetNote = predeterminationOnFile
        ? " The predetermination on file is what lets you quote this accurately in advance."
        : " No predetermination is on file — send one so the patient sees this in writing before the tooth is prepared.";
      if (benchmark !== undefined) {
        benefitBase = round2(benchmark);
        record(
          7,
          "reduced",
          `${alt.label}. The service is still covered, but the allowance is based on ${alt.paidAtCode} at ${money(benefitBase)} instead of ${money(allowed)}. Bill the service actually delivered — never the downgraded code — and bill the difference to the patient as an upgrade.${predetNote}`,
          benefitBase,
        );
      } else {
        record(
          7,
          "reduced",
          `${alt.label}. The plan will pay based on ${alt.paidAtCode}, but no benchmark allowance was supplied, so this estimate still uses ${money(allowed)} and will overstate what the plan pays.${predetNote}`,
          allowed,
        );
      }
    }
  } else {
    record(7, "n/a", "Not reached.", null);
  }

  // ── Step 8 — contracted allowance ────────────────────────────────
  const writeOff = round2(charged - allowed);
  if (!blocked) {
    record(
      8,
      writeOff > 0 ? "reduced" : "pass",
      writeOff > 0
        ? `Charged ${money(charged)}, contracted allowance ${money(allowed)}. The ${money(writeOff)} difference is a contractual write-off and cannot be billed to the patient.`
        : input.allowedUsd === undefined
          ? `No contracted allowance was supplied, so the charged amount of ${money(charged)} is being treated as the allowance. Out of network, or an estimate that needs the real fee schedule.`
          : `Charged amount matches the contracted allowance at ${money(allowed)}.`,
      benefitBase,
    );
  } else {
    record(8, "n/a", "Not reached.", null);
  }

  /* --- DHMO copay path: a fixed price, not a percentage --- */
  const copay = plan.copaySchedule.find((c) => c.code === cdt.code);
  if (!blocked && plan.planType === "DHMO" && copay) {
    const planPays = round2(Math.max(0, allowed - copay.patientCopayUsd));
    record(9, "n/a", "Copay plans do not apply a deductible.", benefitBase);
    record(
      10,
      "pass",
      `Fixed copay of ${money(copay.patientCopayUsd)} for this service instead of a coinsurance percentage. "No annual maximum" does not mean no cost to the patient.`,
      planPays,
    );
    record(11, "n/a", "This plan design has no annual maximum.", planPays);
    record(
      12,
      secondaryPlan || patient.hasSecondaryCoverage ? "pass" : "n/a",
      secondaryPlan
        ? COB_EXPLANATIONS[secondaryPlan.coordinationOfBenefits]
        : patient.hasSecondaryCoverage
          ? "Secondary coverage exists but the plan was not supplied, so coordination cannot be calculated here."
          : "No secondary coverage supplied.",
      planPays,
    );
    return {
      code: cdt.code,
      dateOfService,
      steps,
      payable: planPays > 0,
      chargedUsd: charged,
      allowedUsd: allowed,
      contractualWriteOffUsd: writeOff,
      deductibleAppliedUsd: 0,
      coinsurancePatientUsd: round2(copay.patientCopayUsd),
      annualMaxReductionUsd: 0,
      planPaysUsd: planPays,
      patientOwesUsd: round2(copay.patientCopayUsd),
      alternateBenefit,
      summary: `Covered with a ${money(copay.patientCopayUsd)} patient copay.`,
    };
  }

  // ── Step 9 — deductible ──────────────────────────────────────────
  let deductibleApplied = 0;
  if (!blocked) {
    const classApplies = plan.deductible.appliesToClasses.includes(cls);
    const waivedPreventive = plan.deductible.waivedForPreventive && priceableClass(cls) === "Preventive";
    if (!classApplies || waivedPreventive) {
      record(
        9,
        "n/a",
        waivedPreventive
          ? "The deductible is waived for preventive services on this plan."
          : `The deductible does not apply to ${cls} services on this plan.`,
        benefitBase,
      );
    } else {
      const remaining = Math.max(0, plan.deductible.individualUsd - deductibleAlreadyMet);
      deductibleApplied = round2(Math.min(remaining, benefitBase));
      if (deductibleApplied > 0) {
        record(
          9,
          "reduced",
          `${money(deductibleApplied)} of the ${money(plan.deductible.individualUsd)} deductible taken from this line. It comes out in the order claims are processed, which is why claim order changes who owes what.`,
          round2(benefitBase - deductibleApplied),
        );
      } else {
        record(9, "pass", `Deductible already satisfied (${money(deductibleAlreadyMet)} met).`, benefitBase);
      }
    }
  } else {
    record(9, "n/a", "Not reached.", null);
  }

  // ── Step 10 — coinsurance ────────────────────────────────────────
  let planPays = 0;
  let coinsurancePatient = 0;
  if (!blocked) {
    const pct = plan.coinsurancePlanPaysPct[priceableClass(cls)];
    const afterDeductible = round2(benefitBase - deductibleApplied);
    planPays = round2((afterDeductible * pct) / 100);
    coinsurancePatient = round2(afterDeductible - planPays);
    record(
      10,
      pct === 100 ? "pass" : "reduced",
      `${priceableClass(cls)} services pay at ${pct}% of ${money(afterDeductible)}, which is ${money(planPays)}. Benefit class is a plan decision, not a property of the code — always confirm it against the actual plan.`,
      planPays,
    );
  } else {
    record(10, "n/a", "Not reached.", null);
  }

  // ── Step 11 — annual maximum ─────────────────────────────────────
  let annualMaxReduction = 0;
  if (!blocked) {
    if (plan.annualMaximumUsd === null) {
      record(11, "n/a", "This plan design has no annual maximum.", planPays);
    } else {
      const remaining = round2(Math.max(0, plan.annualMaximumUsd - benefitUsed));
      if (remaining <= 0) {
        annualMaxReduction = planPays;
        planPays = 0;
        block(
          11,
          `The ${money(plan.annualMaximumUsd)} annual maximum was already exhausted before this line. The service passed every other rule and still pays nothing — there is nothing to appeal.`,
          "DEN-ANNUAL-MAX",
        );
      } else if (planPays > remaining) {
        annualMaxReduction = round2(planPays - remaining);
        record(
          11,
          "reduced",
          `Only ${money(remaining)} of the ${money(plan.annualMaximumUsd)} annual maximum remained, so payment is capped from ${money(planPays)} to ${money(remaining)}. Consider deferring remaining treatment into the next benefit period.`,
          remaining,
        );
        planPays = remaining;
        denialId = denialId ?? "DEN-ANNUAL-MAX";
      } else {
        record(
          11,
          "pass",
          `${money(remaining)} of the ${money(plan.annualMaximumUsd)} annual maximum remained; ${money(remaining - planPays)} will remain after this line.`,
          planPays,
        );
      }
    }
  } else {
    record(11, "n/a", "Not reached.", null);
  }

  // ── Step 12 — coordination of benefits ───────────────────────────
  if (secondaryPlan) {
    const method = secondaryPlan.coordinationOfBenefits;
    record(
      12,
      method === "non-duplication" ? "reduced" : "pass",
      `Secondary: ${secondaryPlan.planName}. ${COB_EXPLANATIONS[method]}${
        method === "non-duplication"
          ? " Set the patient's expectation before treatment: with the primary paying at this level there is usually nothing left for the secondary to pay."
          : ""
      }`,
      blocked ? null : planPays,
    );
  } else if (patient.hasSecondaryCoverage) {
    record(
      12,
      "n/a",
      "Secondary coverage exists but the plan was not supplied, so coordination cannot be calculated. Establish which plan is primary before submitting — for dependent children most plans use the birthday rule.",
      blocked ? null : planPays,
    );
  } else {
    record(12, "n/a", "No secondary coverage supplied.", blocked ? null : planPays);
  }

  if (blocked) {
    planPays = 0;
    coinsurancePatient = 0;
  }
  const patientOwes = round2(allowed - planPays);

  return {
    code: cdt.code,
    dateOfService,
    steps,
    payable: planPays > 0,
    chargedUsd: charged,
    allowedUsd: allowed,
    contractualWriteOffUsd: writeOff,
    deductibleAppliedUsd: deductibleApplied,
    coinsurancePatientUsd: coinsurancePatient,
    annualMaxReductionUsd: annualMaxReduction,
    planPaysUsd: planPays,
    patientOwesUsd: patientOwes,
    blockedAtStep,
    blockedReason,
    denialId,
    alternateBenefit,
    summary: blocked
      ? `Not payable: ${nameOf(blockedAtStep ?? 1).toLowerCase()}. Patient owes ${money(patientOwes)}.`
      : `Plan pays ${money(planPays)}, patient owes ${money(patientOwes)}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Whole-claim evaluation                                              */
/* ------------------------------------------------------------------ */

export interface ClaimLineInput
  extends Omit<
    CoverageInput,
    "plan" | "patient" | "history" | "secondaryPlan" | "deductibleAlreadyMetUsd" | "benefitUsedUsd" | "remainingAnnualMaximumUsd"
  > {
  /** Claim line reference, for matching results back to the form. */
  line: number;
}

export interface ClaimEvaluationResult {
  lines: (CoverageResult & { line: number })[];
  totals: {
    chargedUsd: number;
    allowedUsd: number;
    planPaysUsd: number;
    patientOwesUsd: number;
    writeOffUsd: number;
  };
}

/**
 * Evaluates a whole claim in line order, threading the deductible and the
 * consumed annual maximum from one line to the next.
 *
 * Line order matters and is not cosmetic: the deductible comes out of
 * whichever line the payer processes first, and that changes the patient's
 * share on each line even though the claim total is the same. Evaluating
 * lines independently double-applies the deductible.
 */
export function evaluateClaim(args: {
  plan: DentalPlan | string;
  patient: CoveragePatient;
  lines: ClaimLineInput[];
  history?: PaidHistoryEntry[];
  deductibleAlreadyMetUsd?: number;
  benefitUsedUsd?: number;
  remainingAnnualMaximumUsd?: number | null;
  secondaryPlan?: DentalPlan | string;
}): ClaimEvaluationResult {
  const plan = typeof args.plan === "string" ? findPlan(args.plan) : args.plan;
  let deductibleMet = args.deductibleAlreadyMetUsd ?? args.patient.deductibleMetUsd ?? 0;
  let benefitUsed =
    args.remainingAnnualMaximumUsd !== undefined && args.remainingAnnualMaximumUsd !== null
      ? Math.max(0, (plan?.annualMaximumUsd ?? 0) - args.remainingAnnualMaximumUsd)
      : args.patient.remainingAnnualMaximumUsd !== undefined && args.patient.remainingAnnualMaximumUsd !== null
        ? Math.max(0, (plan?.annualMaximumUsd ?? 0) - args.patient.remainingAnnualMaximumUsd)
        : (args.benefitUsedUsd ?? 0);
  const results: (CoverageResult & { line: number })[] = [];

  for (const line of args.lines) {
    const result = evaluateCoverage({
      ...line,
      plan: args.plan,
      patient: args.patient,
      history: args.history ?? args.patient.paidHistory,
      secondaryPlan: args.secondaryPlan,
      deductibleAlreadyMetUsd: deductibleMet,
      benefitUsedUsd: benefitUsed,
    });
    deductibleMet = round2(deductibleMet + result.deductibleAppliedUsd);
    benefitUsed = round2(benefitUsed + result.planPaysUsd);
    results.push({ ...result, line: line.line });
  }

  const sum = (f: (r: CoverageResult) => number) => round2(results.reduce((a, r) => a + f(r), 0));
  return {
    lines: results,
    totals: {
      chargedUsd: sum((r) => r.chargedUsd),
      allowedUsd: sum((r) => r.allowedUsd),
      planPaysUsd: sum((r) => r.planPaysUsd),
      patientOwesUsd: sum((r) => r.patientOwesUsd),
      writeOffUsd: sum((r) => r.contractualWriteOffUsd),
    },
  };
}
