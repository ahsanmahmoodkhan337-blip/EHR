/**
 * Demo claim data — the teaching value a claim box carries when nothing real
 * was captured for it.
 *
 * Owner rule (2026-11-20): a box with no captured value still shows a value, so
 * the student sees a complete paper — but the demo value must always look like
 * a demo value. It is grey italic, tagged "demo", carries a tooltip naming the
 * stage that should really supply the box, is listed separately in the claim's
 * validation panel, and is **never** written back onto the claim record.
 *
 * One source only: this file. The builder that reads it lives in
 * `src/utils/demoClaimFill.ts`. Values are seeded from the tutorial case
 * (patient "DEMO", MRN TUTORIAL-001, Medicare Part B) so the paper agrees with
 * the patient banner above it.
 *
 * Keyed by the claim field each value fills (see `ClaimFormData` in
 * `src/store/pipelineStore.tsx`), not by box number, because the box number is
 * printed by the layout and can differ between papers.
 *
 * ⚠ DEMO DATA ONLY — invented teaching values. The referring NPI is built to
 * pass the NPI check-digit test (as the provider profile's are) so the demo
 * value does not itself raise a validation error.
 */

export interface DemoClaimValue {
  /** Printed box this value lands in on the CMS-1500 (02/12). */
  box: string;
  /** The demo value itself. */
  value: string;
  /** The stage that should really supply this box — printed in the tooltip. */
  stage: string;
}

/** Demo value per claim field. Order here is the order the panel lists them. */
export const DEMO_CLAIM_DATA: Record<string, DemoClaimValue> = {
  insuredId: {
    box: "1a",
    value: "1EG4-TE5-MK72",
    stage: "Registration & eligibility (the patient's insurance record)",
  },
  otherInsuranceName: {
    box: "9",
    value: "NONE — NO OTHER COVERAGE ON FILE",
    stage: "Registration & eligibility (other coverage)",
  },
  insuredPolicyGroup: {
    box: "11",
    value: "MCB-4471",
    stage: "Registration & eligibility (group number)",
  },
  insuredEmployer: {
    box: "11b",
    value: "RETIREE — MEDFORD CITY SCHOOLS",
    stage: "Registration & eligibility (employer)",
  },
  insuredPlanName: {
    box: "11c",
    value: "MEDICARE PART B",
    stage: "Registration & eligibility (plan name)",
  },
  similarIllnessDate: {
    box: "15",
    value: "2026-07-08",
    stage: "Scribe / provider (date of first symptoms)",
  },
  unableToWorkFrom: {
    box: "16",
    value: "2026-07-09",
    stage: "Scribe / provider (work status)",
  },
  unableToWorkTo: {
    box: "16",
    value: "2026-07-13",
    stage: "Scribe / provider (work status)",
  },
  referringProvider: {
    box: "17",
    value: "CHEN, SARAH, MD",
    stage: "Registration / front desk (referring provider)",
  },
  referringNpi: {
    box: "17b",
    value: "1932847563",
    stage: "Registration / front desk (referring provider NPI)",
  },
  additionalInfo: {
    box: "19",
    value: "DEMO — TRAINING CLAIM, NOT A REAL ENCOUNTER",
    stage: "Scribe / provider (additional claim information)",
  },
  priorAuthNumber: {
    box: "23",
    value: "PA-2026-004418",
    stage: "Prior authorization (authorisation number)",
  },
};

/**
 * Demo values for a **service line** (box 24A–24J), applied per line by
 * `applyLineDemoFill` rather than to the claim's own values map.
 *
 * Box 24A is here because the date of service used to be printed as `today()`
 * whenever the Coder handed over no per-line dates — a date nobody captured. The
 * claim now reads the encounter's date of service, and only when the encounter
 * has none either does the line show this tagged demo date.
 */
export const DEMO_LINE_DATA: Record<string, DemoClaimValue> = {
  dateOfService: {
    box: "24A",
    value: "2026-07-09",
    stage: "Coder (per-line date of service)",
  },
};

/** One line printed under the paper so a demo value is never mistaken for real. */
export const DEMO_FILL_NOTE =
  "Grey italic values tagged DEMO are teaching placeholders — nothing in the claim record supplies them yet.";
