/**
 * Demo claim data — the teaching value a claim box carries when nothing real
 * was captured for it.
 *
 * Owner rule (2026-11-20): where a value has to be shown, it must look like a
 * teaching value — grey italic, tagged "demo", carrying a tooltip that names the
 * stage which should really supply the box, listed separately in the claim's
 * validation panel, and **never** written back onto the claim record.
 *
 * One source only: this file. The builder that reads it lives in
 * `src/utils/demoClaimFill.ts`.
 *
 * As of 2026-11-21 (slice J item 4b) **no claim-level box carries a constant
 * any more**: every one that did printed the tutorial case's member ID, group,
 * plan and dates onto other patients' papers. A box now either holds this
 * patient's own captured value or stays blank with the stage that should have
 * filled it. What remains here is the service-line date (24A) and that
 * blank-box provenance map.
 *
 * Keyed by the claim field each value fills (see `ClaimFormData` in
 * `src/store/pipelineStore.tsx`), not by box number, because the box number is
 * printed by the layout and can differ between papers.
 *
 * ⚠ DEMO DATA ONLY — invented teaching values, flagged as such wherever shown.
 */

export interface DemoClaimValue {
  /** Printed box this value lands in on the CMS-1500 (02/12). */
  box: string;
  /** The demo value itself. */
  value: string;
  /** The stage that should really supply this box — printed in the tooltip. */
  stage: string;
}

/**
 * Demo value per claim field — **empty, deliberately**.
 *
 * Owner audit, 2026-11-21 (`specs/slice-j-claim-follows-record.md` item 4b and
 * `specs/slice-i-patient-record.md` item 3): boxes 1a, 9, 11, 11c, 15 and 19 each
 * printed a constant — the tutorial case's member ID `1EG4-TE5-MK72`, its group
 * `MCB-4471`, its plan `MEDICARE PART B`, a symptom date and a "training claim"
 * note — on **every** patient's paper. None of that is the patient on screen.
 *
 * Each of those boxes is now either read from the patient's own record by
 * `utils/claimAutoFill.ts` (`patientIdentityBoxes`) or left blank with the stage
 * that should have filled it, listed in `UNFILLED_BOX_SOURCES` below. The map
 * stays, and stays the only place a claim-level demo value could live, so the
 * panel's demo path keeps working and a future gap has somewhere honest to go.
 */
export const DEMO_CLAIM_DATA: Record<string, DemoClaimValue> = {};

/**
 * Boxes that are **left blank** when nothing was captured, with the stage that
 * should supply them — never a value.
 *
 * Owner audit, 2026-11-21 (spec `slice-i-patient-record.md` item 3): boxes 9c,
 * 16, 17, 17b and 23 each printed another patient's world — a retired school
 * district's employer line, someone else's return-to-work dates, a referring
 * physician this practice never saw, and a prior authorisation number for a
 * different encounter. None of that can be derived from the patient on screen,
 * so it is removed rather than replaced: the box stays empty and says which
 * stage fills it. A blank box teaches "this was never captured"; a borrowed
 * value teaches that inventing one is fine.
 *
 * Item 4b cleared the last constants the same way: 1a (member ID), 9 (other
 * coverage), 11 (group number), 11c (plan name), 15 (the other date and its
 * qualifier) and 19 (additional information). Every one of them is either
 * captured on the patient's coverage record — in which case the box prints that
 * — or blank with its provenance, never the tutorial case's card.
 *
 * The provenance is printed in the claim's own grey strip (`ClaimFormShell`), so
 * the student sees the stage without a value ever being printed on the paper.
 *
 * Owner, 2026-11-23 (`specs/blank-field-sweep.md` §B, §E): a box that no stage
 * will ever fill says so instead of naming a stage that has no field — 16, 17,
 * 17b and 19 read "Not applicable", and 17a and 11b, which have a field on the
 * paper and no capture anywhere, read "Undetermined". Boxes 9 and 9c no longer
 * reach this list on a one-payer chart: they print `N/A`, and box 15 is filled
 * from the note's own onset.
 */
export const UNFILLED_BOX_SOURCES: Record<string, DemoClaimValue> = {
  insuredId: {
    box: "1a",
    value: "",
    stage: "Registration & eligibility (the member ID on the coverage record)",
  },
  otherInsuranceName: {
    box: "9",
    value: "",
    stage: "Registration & eligibility (other coverage)",
  },
  insuredPolicyGroup: {
    box: "11",
    value: "",
    stage: "Registration & eligibility (the group number on the coverage record)",
  },
  otherClaimId: {
    box: "11b",
    value: "",
    // Box 11b has a field on the paper and no stage captures it; box 11d beside
    // it says there is no other benefit plan, so nothing belongs here.
    stage: "Undetermined — no stage captures an other claim ID (box 11d says there is no other benefit plan)",
  },
  insuredPlanName: {
    box: "11c",
    value: "",
    stage: "Registration & eligibility (the plan name on the coverage record)",
  },
  similarIllnessQualifier: {
    box: "15",
    // A date with no qualifier is invalid on a real claim, so both halves of the
    // pair stay blank together until the provider supplies them.
    value: "",
    stage: "Scribe / provider — qualifier for the other date",
  },
  similarIllnessDate: {
    box: "15",
    value: "",
    stage: "Scribe / provider (date of first symptoms)",
  },
  additionalInfo: {
    box: "19",
    value: "",
    // Owner, 2026-11-23: no blank field, but no invented one either. Box 19 is
    // paper-only and nothing in this chart writes a note to the payer, so it
    // states that rather than naming a stage that has no field.
    stage: "Not applicable — the note carries no additional claim information for box 19 (paper-only)",
  },
  insuredEmployer: {
    box: "9c",
    value: "",
    stage: "Registration & eligibility (the employer on the coverage record)",
  },
  unableToWorkFrom: {
    box: "16",
    value: "",
    stage: "Not applicable — the chart captures no work status, so box 16 has no source (paper-only)",
  },
  unableToWorkTo: {
    box: "16",
    value: "",
    stage: "Not applicable — the chart captures no work status, so box 16 has no source (paper-only)",
  },
  referringProvider: {
    box: "17",
    value: "",
    stage: "Not applicable — no referring provider: this visit was not a referral (the chart holds a referral out, not in)",
  },
  referringOtherId: {
    box: "17a",
    value: "",
    // Undetermined rather than N/A: box 17a has a field on the paper and no
    // stage in this app captures a second identifier for a referring provider.
    stage: "Undetermined — no stage captures an other ID for a referring provider (box 17 has none)",
  },
  referringNpi: {
    box: "17b",
    value: "",
    stage: "Not applicable — follows box 17; never back-filled from the billing provider's NPI",
  },
  priorAuthNumber: {
    box: "23",
    value: "",
    stage: "Prior authorization (this encounter's own authorisation number)",
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
