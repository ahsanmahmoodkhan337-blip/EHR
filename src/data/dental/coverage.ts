/**
 * Dental Coverage Evaluator — runnable benefit rules engine
 *
 * Answers the question a dental front office asks fifty times a day: "is this
 * code payable for this patient today, and if not, why not?"
 *
 * This is the executable counterpart to `ADJUDICATION_ORDER` in
 * benefitRules.ts. It walks the same twelve steps in the same order a payer's
 * system does and returns a verdict per step, so a student can see exactly
 * where a claim died rather than just being told the total. The ordering is
 * load-bearing: it is why a perfectly coded, fully documented, pre-authorised
 * claim can still pay nothing when the annual maximum is reached at step 11.
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
  /** Student-facing explanation of what this step decided and why. */
  reason: string;
}

export interface CoveragePatient {
  /** Age on the date of service — age limits are tested on that date, not at enrolment. */
  ageAtServiceDate: number;
  /** Months of continuous coverage on the date of service — drives waiting periods. */
  monthsCoveredAtServiceDate: number;
  coverageEffectiveDate: string;
  /** Optional termination date, where coverage has ended. */
  coverageEndDate?: string;
}

/** A previously paid service, shaped like `eligibilitySnapshot.paidHistory`. */
export interface PaidHistoryEntry {
  code: string;
  tooth?: string;
  quadrant?: string;
  date: string;
  note?: string;
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
  plan: DentalPlan;
  /** CDT code string or the code object itself. */
  code: string | CDTCode;
  /** Per-line date of service. Crowns often use the cementation date, which can fall in the next benefit year. */
  dateOfService: string;
  patient: CoveragePatient;
  history?: PaidHistoryEntry[];
  tooth?: ToothContext;
  /** Practice's charged fee. Defaults to the code's illustrative fee. */
  chargedUsd?: number;
  /** Contracted allowance. Defaults to the charged amount (i.e. no contract). */
  allowedUsd?: number;
  /** Allowance of the downgrade benchmark, where an alternate benefit applies. */
  alternateBenefitAllowedUsd?: number;
  /** Deductible already satisfied this benefit period, before this line. */
  deductibleAlreadyMetUsd?: number;
  /** Benefit already consumed this period, before this line. */
  benefitUsedUsd?: number;
  /** Secondary plan, for the coordination step. */
  secondaryPlan?: DentalPlan;
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
  planPaysUsd: number;
  patientOwesUsd: number;
  /** Denial id from denialReasons.ts, where a step blocked or reduced the line. */
  denialId?: string;
  /** Alternate benefit provision id, where one applied. */
  alternateBenefitId?: string;
  /** One-line plain-language outcome. */
  summary: string;
}

/* ------------------------------------------------------------------ */
/* Date helpers — all comparisons are on calendar dates, no clock.     */
/* ------------------------------------------------------------------ */

function toDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

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

/** Whether a paid-history entry counts against a frequency rule, given its scope. */
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
      return Boolean(tooth?.universal) && entry.tooth === tooth?.universal;
    case "per-quadrant":
      return Boolean(quadrant) && entry.quadrant === quadrant;
    case "per-arch": {
      const a = archOf({ tooth: tooth?.universal, quadrant });
      const b = archOf(entry);
      return Boolean(a) && a === b;
    }
    case "per-surface":
      return Boolean(tooth?.universal) && entry.tooth === tooth?.universal;
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
  const {
    plan,
    dateOfService,
    patient,
    history = [],
    tooth,
    deductibleAlreadyMetUsd = 0,
    benefitUsedUsd = 0,
    secondaryPlan,
  } = input;

  const cdt = typeof input.code === "string" ? findCDT(input.code) : input.code;
  const codeStr = typeof input.code === "string" ? input.code.trim().toUpperCase() : input.code.code;

  const steps: CoverageStepResult[] = [];
  const nameOf = (step: number) => ADJUDICATION_ORDER.find((s) => s.step === step)?.rule ?? `Step ${step}`;
  const record = (step: number, verdict: StepVerdict, reason: string) =>
    steps.push({ step, rule: nameOf(step), verdict, reason });

  const charged = round2(input.chargedUsd ?? cdt?.illustrativeFeeUsd ?? 0);
  const allowed = round2(input.allowedUsd ?? charged);

  let blocked = false;
  let denialId: string | undefined;
  let alternateBenefitId: string | undefined;

  const block = (step: number, reason: string, denial?: string) => {
    record(step, "blocked", reason);
    blocked = true;
    denialId = denial;
  };
  /** Fills the remaining steps as not-applicable once a line is dead. */
  const skipRest = (fromStep: number, why: string) => {
    for (let s = fromStep; s <= 12; s++) record(s, "n/a", why);
  };

  if (!cdt) {
    record(1, "blocked", `"${codeStr}" is not a code in this repository's teaching subset, so it cannot be adjudicated.`);
    skipRest(2, "Not evaluated: unknown procedure code.");
    return {
      code: codeStr,
      dateOfService,
      steps,
      payable: false,
      chargedUsd: charged,
      allowedUsd: 0,
      contractualWriteOffUsd: 0,
      deductibleAppliedUsd: 0,
      planPaysUsd: 0,
      patientOwesUsd: 0,
      summary: `Unknown procedure code "${codeStr}".`,
    };
  }

  const cls = cdt.typicalBenefitClass;
  const quadrant = undefined as string | undefined;

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
    record(1, "pass", `Active on ${dateOfService}, ${monthsSinceEffective} months after the coverage start date.`);
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
        `${plan.planName} excludes ${categoryExcluded ? `the whole ${cdt.category} category` : `this service`}. An exclusion is absolute — it is not reduced, it is simply not covered, and no clinical argument changes that.`,
        "DEN-NOT-COVERED",
      );
    } else if (ageExcluded) {
      block(2, `${ageExcluded.note}`, "DEN-NOT-COVERED");
    } else {
      record(2, "pass", `Covered in principle under ${plan.planName} as a ${cls} service.`);
    }
  } else {
    record(2, "n/a", "Not reached: the patient was not eligible on this date.");
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
      );
    }
  } else {
    record(3, "n/a", "Not reached.");
  }

  // ── Step 4 — age limit ───────────────────────────────────────────
  if (!blocked) {
    const ageRule = ageRuleFor(plan, cdt.code);
    if (!ageRule) {
      record(4, "n/a", "No age limit governs this service on this plan.");
    } else if (ageRule.maxAgeInclusive !== undefined && patient.ageAtServiceDate > ageRule.maxAgeInclusive) {
      block(
        4,
        `${ageRule.label}: covered to age ${ageRule.maxAgeInclusive} inclusive, and the patient is ${patient.ageAtServiceDate} on the date of service. Age is tested on that date — a birthday between two appointments changes the answer.`,
        "DEN-AGE-LIMIT",
      );
    } else if (ageRule.minAgeInclusive !== undefined && patient.ageAtServiceDate < ageRule.minAgeInclusive) {
      block(4, `${ageRule.label}: not covered below age ${ageRule.minAgeInclusive}.`, "DEN-AGE-LIMIT");
    } else {
      record(4, "pass", `Within the age range for ${ageRule.label}.`);
    }
  } else {
    record(4, "n/a", "Not reached.");
  }

  // ── Step 5 — frequency and history ───────────────────────────────
  if (!blocked) {
    const rules = frequencyRulesFor(plan, cdt.code);
    if (rules.length === 0) {
      record(5, "n/a", "No frequency limit governs this service on this plan.");
    } else {
      const periodStart = benefitPeriodStart(plan, dateOfService, patient.coverageEffectiveDate);
      const dos = toDate(dateOfService);
      const violations: string[] = [];
      const passes: string[] = [];

      for (const rule of rules) {
        const relevant = history.filter((h) => historyCountsForRule(rule, h, tooth, quadrant));
        const inWindow = relevant.filter((h) => {
          const d = toDate(h.date);
          if (d.getTime() >= dos.getTime()) return false;
          return rule.basis === "benefit-period"
            ? d.getTime() >= periodStart.getTime()
            : monthsBetween(h.date, dateOfService) < rule.windowMonths;
        });
        if (inWindow.length >= rule.timesAllowed) {
          const last = inWindow.map((h) => h.date).sort().reverse()[0];
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
        record(
          5,
          "pass",
          rules.length > 1
            ? `All ${rules.length} frequency rules governing this code are satisfied — ${passes.join(" ")}`
            : passes[0],
        );
      }
    }
  } else {
    record(5, "n/a", "Not reached.");
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
      );
    } else if (!tooth?.extractionDate) {
      record(
        6,
        "n/a",
        "A missing tooth clause applies to this plan, but no extraction date was supplied. Establish it before quoting — this is the question that decides the case.",
      );
    } else {
      const lostBeforeCoverage =
        toDate(tooth.extractionDate).getTime() < toDate(patient.coverageEffectiveDate).getTime();
      const waived =
        clause.waivedAfterContinuousMonths !== undefined &&
        patient.monthsCoveredAtServiceDate >= clause.waivedAfterContinuousMonths;
      if (!lostBeforeCoverage) {
        record(6, "pass", `Tooth was extracted on ${tooth.extractionDate}, after coverage began, so the clause does not apply.`);
      } else if (waived) {
        record(
          6,
          "pass",
          `Tooth was lost before coverage began, but the clause is waived after ${clause.waivedAfterContinuousMonths} months of continuous coverage and the patient has ${patient.monthsCoveredAtServiceDate}.`,
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
    record(6, "n/a", "Not reached.");
  }

  // ── Step 7 — alternate benefit ───────────────────────────────────
  let benefitBase = allowed;
  if (!blocked) {
    const isPosterior = input.tooth?.isPosterior ?? (tooth?.universal ? findTooth(tooth.universal)?.posterior : undefined);
    const alt = alternateBenefitFor(plan, cdt.code, isPosterior);
    if (!alt) {
      record(7, "n/a", "No alternate benefit provision applies to this service.");
    } else {
      alternateBenefitId = alt.id;
      denialId = denialId ?? "DEN-ALT-BENEFIT";
      const benchmark = input.alternateBenefitAllowedUsd;
      if (benchmark !== undefined) {
        benefitBase = round2(benchmark);
        record(
          7,
          "reduced",
          `${alt.label}. The service is still covered, but the allowance is based on ${alt.paidAtCode} at ${benefitBase.toFixed(2)} instead of ${allowed.toFixed(2)}. Bill the service actually delivered — never the downgraded code — and bill the difference to the patient as an upgrade.`,
        );
      } else {
        record(
          7,
          "reduced",
          `${alt.label}. The plan will pay based on ${alt.paidAtCode}, but no benchmark allowance was supplied, so this estimate still uses ${allowed.toFixed(2)} and will overstate what the plan pays. Get the benchmark in a written predetermination.`,
        );
      }
    }
  } else {
    record(7, "n/a", "Not reached.");
  }

  // ── Step 8 — contracted allowance ────────────────────────────────
  const writeOff = round2(charged - allowed);
  if (!blocked) {
    record(
      8,
      writeOff > 0 ? "reduced" : "pass",
      writeOff > 0
        ? `Charged ${charged.toFixed(2)}, contracted allowance ${allowed.toFixed(2)}. The ${writeOff.toFixed(2)} difference is a contractual write-off and cannot be billed to the patient.`
        : input.allowedUsd === undefined
          ? `No contracted allowance was supplied, so the charged amount of ${charged.toFixed(2)} is being treated as the allowance. Out of network, or an estimate that needs the real fee schedule.`
          : `Charged amount matches the contracted allowance at ${allowed.toFixed(2)}.`,
    );
  } else {
    record(8, "n/a", "Not reached.");
  }

  // ── DHMO copay path ──────────────────────────────────────────────
  const copay = plan.copaySchedule.find((c) => c.code === cdt.code);
  if (!blocked && plan.planType === "DHMO" && copay) {
    record(9, "n/a", "Copay plans do not apply a deductible.");
    record(
      10,
      "pass",
      `Fixed copay of ${copay.patientCopayUsd.toFixed(2)} for this service instead of a coinsurance percentage. "No annual maximum" does not mean no cost to the patient.`,
    );
    const planPays = round2(Math.max(0, allowed - copay.patientCopayUsd));
    record(11, "n/a", "This plan design has no annual maximum.");
    record(
      12,
      secondaryPlan ? "pass" : "n/a",
      secondaryPlan
        ? COB_EXPLANATIONS[secondaryPlan.coordinationOfBenefits]
        : "No secondary coverage supplied.",
    );
    return {
      code: cdt.code,
      dateOfService,
      steps,
      payable: true,
      chargedUsd: charged,
      allowedUsd: allowed,
      contractualWriteOffUsd: writeOff,
      deductibleAppliedUsd: 0,
      planPaysUsd: planPays,
      patientOwesUsd: round2(copay.patientCopayUsd),
      alternateBenefitId,
      summary: `Covered with a ${copay.patientCopayUsd.toFixed(2)} patient copay.`,
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
      );
    } else {
      const remaining = Math.max(0, plan.deductible.individualUsd - deductibleAlreadyMetUsd);
      deductibleApplied = round2(Math.min(remaining, benefitBase));
      if (deductibleApplied > 0) {
        record(
          9,
          "reduced",
          `${deductibleApplied.toFixed(2)} of the ${plan.deductible.individualUsd.toFixed(2)} deductible taken from this line. It comes out in the order claims are processed, which is why claim order changes who owes what.`,
        );
      } else {
        record(9, "pass", `Deductible already satisfied (${deductibleAlreadyMetUsd.toFixed(2)} met).`);
      }
    }
  } else {
    record(9, "n/a", "Not reached.");
  }

  // ── Step 10 — coinsurance ────────────────────────────────────────
  let planPays = 0;
  if (!blocked) {
    const pct = plan.coinsurancePlanPaysPct[priceableClass(cls)];
    planPays = round2(((benefitBase - deductibleApplied) * pct) / 100);
    record(
      10,
      pct === 100 ? "pass" : "reduced",
      `${priceableClass(cls)} services pay at ${pct}% of ${round2(benefitBase - deductibleApplied).toFixed(2)}, which is ${planPays.toFixed(2)}. Benefit class is a plan decision, not a property of the code — always confirm it against the actual plan.`,
    );
  } else {
    record(10, "n/a", "Not reached.");
  }

  // ── Step 11 — annual maximum ─────────────────────────────────────
  if (!blocked) {
    if (plan.annualMaximumUsd === null) {
      record(11, "n/a", "This plan design has no annual maximum.");
    } else {
      const remaining = round2(Math.max(0, plan.annualMaximumUsd - benefitUsedUsd));
      if (remaining <= 0) {
        planPays = 0;
        block(
          11,
          `The ${plan.annualMaximumUsd.toFixed(2)} annual maximum was already exhausted before this line. The service passed every other rule and still pays nothing — there is nothing to appeal.`,
          "DEN-ANNUAL-MAX",
        );
      } else if (planPays > remaining) {
        const capped = remaining;
        record(
          11,
          "reduced",
          `Only ${remaining.toFixed(2)} of the ${plan.annualMaximumUsd.toFixed(2)} annual maximum remained, so payment is capped from ${planPays.toFixed(2)} to ${capped.toFixed(2)}. Consider deferring remaining treatment into the next benefit period.`,
        );
        planPays = capped;
        denialId = denialId ?? "DEN-ANNUAL-MAX";
      } else {
        record(
          11,
          "pass",
          `${remaining.toFixed(2)} of the ${plan.annualMaximumUsd.toFixed(2)} annual maximum remained; ${round2(remaining - planPays).toFixed(2)} will remain after this line.`,
        );
      }
    }
  } else {
    record(11, "n/a", "Not reached.");
  }

  // ── Step 12 — coordination of benefits ───────────────────────────
  if (!secondaryPlan) {
    record(12, "n/a", "No secondary coverage supplied.");
  } else {
    const method = secondaryPlan.coordinationOfBenefits;
    record(
      12,
      method === "non-duplication" ? "reduced" : "pass",
      `Secondary: ${secondaryPlan.planName}. ${COB_EXPLANATIONS[method]}${
        method === "non-duplication"
          ? " Set the patient's expectation before treatment: with the primary paying at this level there is usually nothing left for the secondary to pay."
          : ""
      }`,
    );
  }

  if (blocked) planPays = 0;
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
    planPaysUsd: planPays,
    patientOwesUsd: patientOwes,
    denialId,
    alternateBenefitId,
    summary: blocked
      ? `Not payable: ${steps.find((s) => s.verdict === "blocked")?.rule.toLowerCase()}. Patient owes ${patientOwes.toFixed(2)}.`
      : `Plan pays ${planPays.toFixed(2)}, patient owes ${patientOwes.toFixed(2)}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Whole-claim evaluation                                              */
/* ------------------------------------------------------------------ */

export interface ClaimLineInput
  extends Omit<CoverageInput, "plan" | "patient" | "history" | "secondaryPlan" | "deductibleAlreadyMetUsd" | "benefitUsedUsd"> {
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
 * share on each line even though the claim total is the same.
 */
export function evaluateClaim(args: {
  plan: DentalPlan;
  patient: CoveragePatient;
  lines: ClaimLineInput[];
  history?: PaidHistoryEntry[];
  deductibleAlreadyMetUsd?: number;
  benefitUsedUsd?: number;
  secondaryPlan?: DentalPlan;
}): ClaimEvaluationResult {
  let deductibleMet = args.deductibleAlreadyMetUsd ?? 0;
  let benefitUsed = args.benefitUsedUsd ?? 0;
  const results: (CoverageResult & { line: number })[] = [];

  for (const line of args.lines) {
    const result = evaluateCoverage({
      ...line,
      plan: args.plan,
      patient: args.patient,
      history: args.history,
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
