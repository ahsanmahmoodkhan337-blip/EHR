/**
 * Payer adjudication and the 835 remittance — money-cycle spec items 1, 3 and 5
 * (`specs/task-5-posting-denials-ar.md`), slice 2 of the money cycle.
 *
 * Inspiration: the payer's adjudication engine behind an X12 **835** Health Care
 * Claim Payment/Advice, and the paper **EOB** a patient can be shown. This file is
 * the payer's side of the cycle: a claim that came back A1 on its 277CA is priced
 * against the plan's own rules and comes back as an 835 with, per line, the
 * allowed amount, the deductible, the coinsurance, the payment, the contractual
 * write-off and every adjustment as a real **group code + CARC** from the single
 * table in `src/data/claims/carc.ts`.
 *
 * Four rules this file exists to keep:
 *
 *  1. **The group letter is the money answer.** A CO line is a provider write-off
 *     and never leaves a patient balance; a PR line is the patient's. Nothing in
 *     this file may give a CO line a patient balance (the defect TASK 0 fixed).
 *  2. **Every line balances, and one function says so.** `lineBalances()` is the
 *     only definition of "does this line balance": billed = paid + contractual
 *     adjustments + patient responsibility + remaining insurance balance. The
 *     screen, the posting step and the tests all call it.
 *  3. **The payer computes no money it cannot explain.** Every allowance comes
 *     from the plan's rule for that code (the graded cases' expected allowances)
 *     or, when the plan records none, the billed charge itself — and the line
 *     says which, so a student can always trace a number.
 *  4. **No React, no store, no clock of its own.** The caller hands in the claim
 *     facts and one timestamp; it gets back the 835. Posting that 835 to the
 *     ledger is `domain/ledger.ts`.
 *
 * The rules applied, in the order a payer applies them (each line):
 *   a. a required authorisation the payer has no number for → CO-197, the line
 *      pays nothing and nothing is billed to the patient;
 *   b. the payer's same-day edit (one code treated as part of another billed the
 *      same day) → CO-236 on the component line, same money answer;
 *   c. a service the plan excludes → PR-96, the patient owes it;
 *   d. otherwise the line is covered: the deductible is applied first, then the
 *      plan's coinsurance on the remainder, and the charge above the contracted
 *      allowance is CO-45 — a contractual write-off, never a patient balance.
 *
 * Benefit-limit exhaustion (CO-119) needs the member's year-to-date usage, which
 * the case clock (TASK 4 item 10) does not carry yet; the rule is named here and
 * fires only when the caller passes usage, so nothing is guessed.
 */

import { CARC_BY_CODE, type CarcCode } from "../data/claims/carc";
import {
  MEDICAL_CASE_SCENARIOS,
  MEDICAL_PLANS,
  findPlan,
  type MedicalPlan,
} from "../data/medical";
import { localDay } from "../utils/localDay";
import { CPT_CODES } from "../components/CodingQueue/cptData";

// ─── The 835 vocabulary ────────────────────────────────────────────

/** The four adjustment groups. The letter is the money answer. */
export type AdjustmentGroup = "CO" | "PR" | "OA" | "PI";

export interface RemittanceAdjustment {
  group: AdjustmentGroup;
  /** Group and number together, e.g. "CO-45" — the key the app stores. */
  carc: string;
  /** Always a positive magnitude; the group letter says who carries it. */
  amountCents: number;
  /** Plain-language teaching wording, from the single CARC table. */
  description: string;
  /** RARC-style remark, free text. No RARC list ships (see carc.ts). */
  remark?: string;
}

/** Where a line's allowed amount came from — printed on the EOB. */
export type AllowanceSource = "plan-rule" | "fee-schedule" | "billed";

export interface RemittanceLine {
  /** 1-based, matching the claim line it prices (CMS-1500 box 24). */
  lineNumber: number;
  cpt: string;
  modifiers: string[];
  units: number;
  billedCents: number;
  allowedCents: number;
  deductibleCents: number;
  coinsuranceCents: number;
  copayCents: number;
  paidCents: number;
  /** Deductible + coinsurance + copay — what the patient carries. */
  patientRespCents: number;
  /** Every CO adjustment (contractual), including a denied line's write-off. */
  writeOffCents: number;
  /** What the payer has left to decide, after this adjudication. Always 0 here. */
  insuranceBalanceCents: number;
  adjustments: RemittanceAdjustment[];
  /** True when the plan paid nothing on this line. */
  denied: boolean;
  allowanceSource: AllowanceSource;
  /** One plain sentence: where each number came from. */
  explanation: string;
}

export interface RemittanceTotals {
  billedCents: number;
  allowedCents: number;
  paidCents: number;
  patientRespCents: number;
  deductibleCents: number;
  coinsuranceCents: number;
  writeOffCents: number;
  deniedCents: number;
}

/** Claim-level outcome, in the 835's own terms. */
export type RemittanceOutcome =
  | "paid_in_full"
  | "partially_paid"
  | "denied"
  | "patient_responsibility";

export interface Remittance835 {
  /** Deterministic per claim: `835-CLM-000001`. */
  id: string;
  track: "medical" | "dental";
  claimNumber: string;
  /** The claim control number the payer quotes back (835 CLP01). */
  claimControlNumber: string;
  payerName: string;
  /**
   * The payer's EDI identification (835 N1*PR), the same id box 32 of the claim
   * carries. Empty when the claim recorded none — the panel says so rather than
   * printing a number the paper does not hold.
   */
  payerId?: string;
  /** The plan the money was priced on, by its name in the plan table. */
  planName?: string | null;
  /** Internal plan key. Kept for traceability; never printed as a plan's name. */
  planId: string | null;
  /** EFT trace number or check number (835 BPR16 / TRN). */
  checkOrEftNumber: string;
  /** ISO date the money moved. */
  paymentDate: string;
  lines: RemittanceLine[];
  totals: RemittanceTotals;
  outcome: RemittanceOutcome;
  /** Claim-level prior-balance adjustments (835 PLB). Empty in this build. */
  plb: { code: string; amountCents: number; reason: string }[];
  /** When the 835 arrived. */
  receivedAt: string;
  /** When the student posted it to the ledger. Absent until they do. */
  postedAt?: string;
}

// ─── Inputs ────────────────────────────────────────────────────────

export interface AdjudicationLineInput {
  cpt: string;
  modifiers?: string[];
  units?: number;
  /** Box 24F, in cents. */
  chargeCents: number;
}

export interface AdjudicationInput {
  claimNumber: string;
  payerName: string;
  /** Box 32 of the claim: the payer's EDI id, carried onto the 835's N1*PR. */
  payerId?: string;
  /** The plan the claim is priced against, or null when none is recorded. */
  plan: MedicalPlan | null;
  lines: AdjudicationLineInput[];
  /** Deductible the member has still to meet, in cents. */
  deductibleRemainingCents: number;
  /** Box 23 of the claim: the authorisation number, or "". */
  priorAuthNumber: string;
  /** The member's year-to-date usage, when the case records it. */
  benefitUsage?: { category: string; used: number; limit: number }[];
  /** One clock read for the whole remittance; the caller may pin it in tests. */
  at?: string;
  /**
   * The 271 found the subscriber name on the claim's coverage does not match
   * the payer's member file. The payer cannot identify the patient, so every
   * line denies CO-31 — the denial the registration lesson warns about.
   */
  subscriberNameMismatch?: { payerHolds: string; claimCarries: string } | null;
}

// ─── Contracted allowances ─────────────────────────────────────────

/**
 * The plan's allowance for a code, taken from the graded case library: the case
 * key *is* the plan's contracted allowance for that code, and re-deriving it
 * from a second fee schedule is how two screens start disagreeing about a
 * number. A zero allowance in a case key means the benefit paid nothing for a
 * reason of its own, so it is never treated as an allowance here.
 */
const CASE_ALLOWANCES: Record<string, Record<string, number>> = (() => {
  const table: Record<string, Record<string, number>> = {};
  for (const scenario of MEDICAL_CASE_SCENARIOS) {
    const byCode = (table[scenario.planId] ??= {});
    for (const line of scenario.expectedOutcome) {
      if (line.allowedUsd > 0 && byCode[line.code] === undefined) byCode[line.code] = line.allowedUsd;
    }
  }
  return table;
})();

/**
 * A code the plan excludes outright, by plan id. Mirrors the exclusions the
 * graded cases teach (an appearance-only removal is excluded by the narrow
 * network plan), so the 835 a student sees in free play matches the case key.
 */
const PLAN_EXCLUSIONS: Record<string, string[]> = {
  "PLAN-ATLAS-SELECT-PPO": ["17110"],
};

/**
 * The teaching fee schedule: a code's total RVU (from the CPT table students
 * see in Coding) × a conversion factor × the plan type's factor. Real payers
 * price this way — Medicare's fee schedule is RVU × conversion factor, and
 * commercial and Medicaid contracts are commonly a percentage of it. Without
 * it, any code the case keys did not list was "allowed" at whatever charge the
 * student typed, so a payment never carried a contractual adjustment (CO-45)
 * and the core posting lesson — billed is not allowed — disappeared.
 */
export const TEACHING_CONVERSION_FACTOR_USD = 33.4;

export const PLAN_TYPE_FEE_FACTOR: Record<MedicalPlan["planType"], number> = {
  "Medicare Part B (fee-for-service)": 1.0,
  "Medicare Advantage HMO": 1.0,
  "Medicaid MCO": 0.75,
  "Commercial PPO": 1.3,
};

const RVU_BY_CPT: Record<string, number> = Object.fromEntries(
  CPT_CODES.filter((c) => c.rvu > 0).map((c) => [c.code, c.rvu]),
);

/** The fee-schedule allowance for a code on a plan, in cents, or null. */
export function feeScheduleAllowanceCents(cpt: string, plan: MedicalPlan | null): number | null {
  const rvu = RVU_BY_CPT[cpt];
  if (!plan || !rvu) return null;
  const factor = PLAN_TYPE_FEE_FACTOR[plan.planType] ?? 1;
  return Math.round(rvu * TEACHING_CONVERSION_FACTOR_USD * factor * 100);
}

/**
 * The allowance for one line, and where it came from: the plan's contracted
 * rate from the case key first, then the teaching fee schedule. Only a code
 * with neither (no RVU on file) allows the charge itself, and says so. The
 * allowance never exceeds the charge — a payer pays the lesser of the two.
 */
export function contractedAllowanceCents(
  cpt: string,
  billedCents: number,
  plan: MedicalPlan | null,
): { allowedCents: number; source: AllowanceSource } {
  const planRule = plan ? CASE_ALLOWANCES[plan.id]?.[cpt] : undefined;
  if (planRule !== undefined) {
    return { allowedCents: Math.min(billedCents, Math.round(planRule * 100)), source: "plan-rule" };
  }
  const fee = feeScheduleAllowanceCents(cpt, plan);
  if (fee !== null) {
    return { allowedCents: Math.min(billedCents, fee), source: "fee-schedule" };
  }
  return { allowedCents: billedCents, source: "billed" };
}

/**
 * The plan a payer name belongs to, or **null** when the plan table has no rule
 * for that payer.
 *
 * This is the strict reading, and the one the 271 uses
 * (`domain/eligibility.ts` → `eligibility271`): a payer nobody wrote a benefit
 * rule for has no copay, deductible or coinsurance, and returning the teaching
 * baseline instead would print another plan's money as this patient's.
 */
export function planForPayerNameStrict(payerName: string | null | undefined): MedicalPlan | null {
  const name = (payerName ?? "").toLowerCase();
  if (!name) return null;
  const byName: [string, string][] = [
    ["cascadia", "PLAN-CASCADIA-HEALTH-PPO"],
    // A Medicare *Advantage* product is a plan of its own and keeps its own row.
    ["medicare advantage", "PLAN-MERIDIAN-ADVANTAGE"],
    // `medicare part b` is matched before `medicare` so the Tutorial Patient's
    // card is priced on the Part B row, never on another product's money
    // (`specs/tutorial-payer-consistency.md`, the root cause).
    ["medicare part b", "PLAN-MEDICARE-PART-B"],
    ["meridian", "PLAN-MERIDIAN-ADVANTAGE"],
    ["northwind", "PLAN-NORTHWIND-MEDICAID"],
    ["atlas", "PLAN-ATLAS-SELECT-PPO"],
    ["vanguard", "PLAN-VANGUARD-HMO"],
    ["medicaid", "PLAN-NORTHWIND-MEDICAID"],
    ["medicare", "PLAN-MEDICARE-PART-B"],
  ];
  const hit = byName.find(([needle]) => name.includes(needle));
  return hit ? findPlan(hit[1]) ?? null : null;
}

/** The plan a payer name belongs to. Unknown payers price on the teaching baseline. */
export function planForPayerName(payerName: string | null | undefined): MedicalPlan | null {
  return planForPayerNameStrict(payerName) ?? MEDICAL_PLANS[0] ?? null;
}

// ─── The balance rule ──────────────────────────────────────────────

/** What a line has to account for. The one definition, used everywhere. */
export interface LineBalanceCheck {
  balances: boolean;
  /** billed − (paid + CO adjustments + PR adjustments + insurance balance). */
  differenceCents: number;
}

/**
 * Does this line balance? **This is the only place the rule is written.**
 * billed = paid + contractual adjustments + patient responsibility + remaining
 * insurance balance.
 */
export function lineBalances(line: Pick<RemittanceLine, "billedCents" | "paidCents" | "patientRespCents" | "insuranceBalanceCents" | "adjustments">): LineBalanceCheck {
  const co = line.adjustments
    .filter((a) => a.group === "CO" || a.group === "OA")
    .reduce((sum, a) => sum + a.amountCents, 0);
  const pr = line.adjustments.filter((a) => a.group === "PR").reduce((sum, a) => sum + a.amountCents, 0);
  const accounted = line.paidCents + co + pr + line.insuranceBalanceCents;
  const differenceCents = line.billedCents - accounted;
  return { balances: differenceCents === 0, differenceCents };
}

/** True when every line of the remittance balances. */
export function remittanceBalances(remittance: Remittance835): boolean {
  return remittance.lines.every((line) => lineBalances(line).balances);
}

// ─── Helpers ───────────────────────────────────────────────────────

function adjustment(carc: string, amountCents: number, remark?: string): RemittanceAdjustment {
  const entry: CarcCode | undefined = CARC_BY_CODE[carc];
  return {
    group: (entry?.group ?? (carc.slice(0, 2) as AdjustmentGroup)) as AdjustmentGroup,
    carc,
    amountCents: Math.round(amountCents),
    description: entry?.description ?? "",
    ...(remark ? { remark } : {}),
  };
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function hasModifier(modifiers: string[] | undefined, code: string): boolean {
  return (modifiers ?? []).some((m) => m.replace(/^-/, "").trim() === code);
}

/**
 * True when this line is the component of a pair the payer's same-day edit treats
 * as one service, with both codes on the claim. A separating modifier (59) on the
 * line answers the edit, and the caller checks that separately.
 */
function cciComponentFor(cpt: string, plan: MedicalPlan | null, allCodes: string[]): boolean {
  if (!plan) return false;
  return plan.cciEdits.some(
    (edit) => edit.componentCode === cpt && allCodes.includes(edit.comprehensiveCode),
  );
}

function excludedByPlan(cpt: string, plan: MedicalPlan | null): boolean {
  if (!plan) return false;
  return (PLAN_EXCLUSIONS[plan.id] ?? []).includes(cpt);
}

function authRequiredFor(cpt: string, plan: MedicalPlan | null): boolean {
  return !!plan && plan.priorAuthCptCodes.includes(cpt);
}

// ─── One line ──────────────────────────────────────────────────────

interface LineContext {
  plan: MedicalPlan | null;
  priorAuthNumber: string;
  /** Deductible left before this line. */
  deductibleRemainingCents: number;
  allCodes: string[];
  subscriberNameMismatch?: AdjudicationInput["subscriberNameMismatch"];
}

interface PricedLine {
  line: RemittanceLine;
  /** Deductible the next line still has to meet. */
  deductibleLeftCents: number;
}

function priceLine(
  input: AdjudicationLineInput,
  lineNumber: number,
  ctx: LineContext,
): PricedLine {
  const units = Number.isFinite(input.units) && (input.units ?? 0) > 0 ? Number(input.units) : 1;
  const billedCents = Math.max(0, Math.round(input.chargeCents * units));
  const modifiers = input.modifiers ?? [];
  const { plan } = ctx;
  const base: Omit<RemittanceLine, "adjustments" | "explanation" | "denied" | "allowedCents" | "allowanceSource"> = {
    lineNumber,
    cpt: input.cpt,
    modifiers,
    units,
    billedCents,
    deductibleCents: 0,
    coinsuranceCents: 0,
    copayCents: 0,
    paidCents: 0,
    patientRespCents: 0,
    writeOffCents: 0,
    insuranceBalanceCents: 0,
  };

  // (0) The payer cannot identify the patient: the subscriber name does not
  //     match its member file. Nothing on the claim is priced.
  if (ctx.subscriberNameMismatch) {
    const { payerHolds, claimCarries } = ctx.subscriberNameMismatch;
    return {
      line: {
        ...base,
        allowedCents: 0,
        adjustments: [adjustment("CO-31", billedCents)],
        writeOffCents: billedCents,
        denied: true,
        allowanceSource: "billed",
        explanation: `The payer's member file holds “${payerHolds}” and the claim carries “${claimCarries}”, so it cannot identify the patient as its insured: ${dollars(billedCents)} denied CO-31. Have the patient's insurer correct its record, then correct and resubmit.`,
      },
      deductibleLeftCents: ctx.deductibleRemainingCents,
    };
  }

  // (a) A required authorisation the payer has no number for.
  if (authRequiredFor(input.cpt, plan) && !ctx.priorAuthNumber.trim()) {
    const adj = [adjustment("CO-197", billedCents)];
    return {
      line: {
        ...base,
        allowedCents: 0,
        adjustments: adj,
        writeOffCents: billedCents,
        denied: true,
        allowanceSource: "billed",
        explanation: `CPT ${input.cpt} needs an authorisation on this plan and box 23 carries none, so the payer allowed nothing: ${dollars(billedCents)} is a CO-197 contractual write-off and the patient owes nothing for it.`,
      },
      deductibleLeftCents: ctx.deductibleRemainingCents,
    };
  }

  // (b) The payer's same-day edit: one code treated as part of another.
  if (cciComponentFor(input.cpt, plan, ctx.allCodes) && !hasModifier(modifiers, "59")) {
    const adj = [adjustment("CO-236", billedCents)];
    return {
      line: {
        ...base,
        allowedCents: 0,
        adjustments: adj,
        writeOffCents: billedCents,
        denied: true,
        allowanceSource: "billed",
        explanation: `The payer's same-day edit treats ${input.cpt} as part of another code billed the same day, so it allowed nothing: ${dollars(billedCents)} is a CO-236 contractual write-off, not a patient balance.`,
      },
      deductibleLeftCents: ctx.deductibleRemainingCents,
    };
  }

  // (c) A service the plan excludes.
  if (excludedByPlan(input.cpt, plan)) {
    const adj = [adjustment("PR-96", billedCents)];
    return {
      line: {
        ...base,
        allowedCents: billedCents,
        adjustments: adj,
        patientRespCents: billedCents,
        denied: true,
        allowanceSource: "billed",
        explanation: `This plan excludes ${input.cpt}, so it pays nothing and nothing is written off: the ${dollars(billedCents)} charge is the patient's (PR-96).`,
      },
      deductibleLeftCents: ctx.deductibleRemainingCents,
    };
  }

  // (d) Covered. Allowance, then deductible, then coinsurance.
  const { allowedCents, source } = contractedAllowanceCents(input.cpt, billedCents, plan);
  const contractualCents = billedCents - allowedCents;
  const adjustments: RemittanceAdjustment[] = [];
  if (contractualCents > 0) adjustments.push(adjustment("CO-45", contractualCents));

  const preventivePaidInFull =
    !!plan?.preventivePaidInFull && isPreventive(input.cpt);
  const deductibleCents = preventivePaidInFull
    ? 0
    : Math.min(allowedCents, Math.max(0, ctx.deductibleRemainingCents));
  const afterDeductible = allowedCents - deductibleCents;
  const planSharePercent = preventivePaidInFull ? 100 : plan?.planCoinsurancePercent ?? 80;
  const paidCents = Math.round((afterDeductible * planSharePercent) / 100);
  const coinsuranceCents = afterDeductible - paidCents;
  const patientRespCents = deductibleCents + coinsuranceCents;

  if (deductibleCents > 0) adjustments.push(adjustment("PR-1", deductibleCents));
  if (coinsuranceCents > 0) adjustments.push(adjustment("PR-2", coinsuranceCents));

  const parts: string[] = [];
  parts.push(
    source === "plan-rule"
      ? `Allowed ${dollars(allowedCents)} — the plan's contracted allowance for ${input.cpt}.`
      : source === "fee-schedule"
        ? `Allowed ${dollars(allowedCents)} — the plan's fee schedule for ${input.cpt} (RVU ${RVU_BY_CPT[input.cpt]} × $${TEACHING_CONVERSION_FACTOR_USD.toFixed(2)} conversion factor × ${plan ? PLAN_TYPE_FEE_FACTOR[plan.planType] : 1} for a ${plan?.planType ?? "plan"}).`
        : `Allowed ${dollars(allowedCents)} — no contracted allowance is on file for ${input.cpt}, so the billed charge is the allowed amount.`,
  );
  if (contractualCents > 0) {
    parts.push(`The ${dollars(contractualCents)} above the allowance is CO-45, a contractual write-off.`);
  }
  if (deductibleCents > 0) parts.push(`${dollars(deductibleCents)} of the allowance went to the deductible (PR-1).`);
  if (coinsuranceCents > 0) {
    parts.push(
      `The plan paid ${planSharePercent}% of the rest (${dollars(paidCents)}) and the member's coinsurance is ${dollars(coinsuranceCents)} (PR-2).`,
    );
  } else if (preventivePaidInFull) {
    parts.push(`Preventive care pays in full on this plan: ${dollars(paidCents)} paid, nothing to the member.`);
  } else {
    parts.push(`The plan paid ${dollars(paidCents)} and the member owes nothing on this line.`);
  }

  return {
    line: {
      ...base,
      allowedCents,
      deductibleCents,
      coinsuranceCents,
      paidCents,
      patientRespCents,
      writeOffCents: contractualCents,
      adjustments,
      denied: paidCents === 0 && patientRespCents === 0,
      allowanceSource: source,
      explanation: parts.join(" "),
    },
    deductibleLeftCents: Math.max(0, ctx.deductibleRemainingCents - deductibleCents),
  };
}

/**
 * Preventive codes on the teaching plans. A closed list, so "preventive pays in
 * full" can never leak onto a problem-oriented visit.
 */
const PREVENTIVE_CPT = ["99381", "99382", "99383", "99384", "99385", "99386", "99387", "99391", "99392", "99393", "99394", "99395", "99396", "99397", "77067", "77065", "77066", "G0439"];

function isPreventive(cpt: string): boolean {
  return PREVENTIVE_CPT.includes(cpt);
}

// ─── The claim ─────────────────────────────────────────────────────

/** The EFT trace number a claim's 835 carries. Deterministic, never random. */
export function eftNumber(claimNumber: string): string {
  return `EFT-${claimNumber.replace(/[^A-Za-z0-9]/g, "")}`;
}

export function remittanceId(claimNumber: string): string {
  return `835-${claimNumber}`;
}

/**
 * Adjudicate a claim. Pure: the same facts and the same date produce the same
 * 835, so a case is reproducible and a test can pin it.
 */
export function adjudicateClaim(input: AdjudicationInput): Remittance835 {
  const at = input.at ?? new Date().toISOString();
  const allCodes = input.lines.map((l) => l.cpt);
  let deductibleLeft = Math.max(0, Math.round(input.deductibleRemainingCents));
  const ctx: LineContext = {
    plan: input.plan,
    priorAuthNumber: input.priorAuthNumber ?? "",
    deductibleRemainingCents: deductibleLeft,
    allCodes,
    subscriberNameMismatch: input.subscriberNameMismatch ?? null,
  };

  const lines: RemittanceLine[] = input.lines.map((line, index) => {
    ctx.deductibleRemainingCents = deductibleLeft;
    const priced = priceLine(line, index + 1, ctx);
    deductibleLeft = priced.deductibleLeftCents;
    return priced.line;
  });

  const totals = lines.reduce<RemittanceTotals>(
    (sum, line) => ({
      billedCents: sum.billedCents + line.billedCents,
      allowedCents: sum.allowedCents + line.allowedCents,
      paidCents: sum.paidCents + line.paidCents,
      patientRespCents: sum.patientRespCents + line.patientRespCents,
      deductibleCents: sum.deductibleCents + line.deductibleCents,
      coinsuranceCents: sum.coinsuranceCents + line.coinsuranceCents,
      writeOffCents: sum.writeOffCents + line.writeOffCents,
      // A denied line is one nobody paid and nobody owes — a contractual
      // write-off. A non-covered line the patient owes is the patient's money,
      // not a denial, so it counts in `patientRespCents` only.
      deniedCents:
        sum.deniedCents + (line.denied && line.patientRespCents === 0 ? line.billedCents : 0),
    }),
    {
      billedCents: 0,
      allowedCents: 0,
      paidCents: 0,
      patientRespCents: 0,
      deductibleCents: 0,
      coinsuranceCents: 0,
      writeOffCents: 0,
      deniedCents: 0,
    },
  );

  return {
    id: remittanceId(input.claimNumber),
    track: "medical",
    claimNumber: input.claimNumber,
    claimControlNumber: input.claimNumber,
    payerName: input.payerName,
    payerId: (input.payerId ?? "").trim(),
    planName: input.plan?.name ?? null,
    planId: input.plan?.id ?? null,
    checkOrEftNumber: eftNumber(input.claimNumber),
    paymentDate: localDay(at),
    lines,
    totals,
    outcome: outcomeOf(totals),
    plb: [],
    receivedAt: at,
  };
}

/** The claim-level outcome, from the money alone. */
export function outcomeOf(totals: RemittanceTotals): RemittanceOutcome {
  if (totals.paidCents > 0 && totals.deniedCents > 0) return "partially_paid";
  if (totals.paidCents > 0) return "paid_in_full";
  if (totals.patientRespCents > 0 && totals.deniedCents === 0) return "patient_responsibility";
  return "denied";
}

/** Plain name for the outcome, for a chip or a heading. */
export const OUTCOME_LABELS: Record<RemittanceOutcome, string> = {
  paid_in_full: "Paid",
  partially_paid: "Partially paid",
  denied: "Denied — contractual write-off",
  patient_responsibility: "Patient responsibility",
};

/** The 835 a claim last received, read back off the encounter's remittances. */
export function remittanceForClaim(
  remittances: Remittance835[] | null | undefined,
  claimNumber: string | null | undefined,
): Remittance835 | null {
  if (!claimNumber) return null;
  const found = (remittances ?? []).filter((r) => r.claimNumber === claimNumber);
  return found[found.length - 1] ?? null;
}
