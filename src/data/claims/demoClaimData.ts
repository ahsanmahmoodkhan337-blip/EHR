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
 * Owner work order 2026-11-21 (`specs/slice-i-patient-record.md` § 3): a demo
 * value may only be **derived from the patient on screen, or removed**. Boxes
 * 23, 9c, 16, 17 and 17b used to print another patient's world — a prior
 * authorisation number, a retiree's employer, work-status dates and a referring
 * provider who was never on this encounter. They are gone: box 23 now carries
 * only a prior authorisation belonging to this encounter's own coded
 * procedures, and every other box stays empty with its provenance naming the
 * stage that should have filled it.
 *
 * What is left is the training marker in box 19, built from the patient on
 * screen, so a demo value can never be another patient's data.
 *
 * Keyed by the claim field each value fills (see `ClaimFormData` in
 * `src/store/pipelineStore.tsx`), not by box number, because the box number is
 * printed by the layout and can differ between papers.
 *
 * ⚠ DEMO DATA ONLY — invented teaching values.
 */

/** The patient on screen, as much of them as a demo value may be built from. */
export interface DemoClaimContext {
  mrn?: string;
  firstName?: string;
  lastName?: string;
}

export interface DemoClaimValue {
  /** Printed box this value lands in on the CMS-1500 (02/12). */
  box: string;
  /** The demo value, or a value built from the patient on screen. */
  value: string | ((patient: DemoClaimContext) => string);
  /** The stage that should really supply this box — printed in the tooltip. */
  stage: string;
}

/** Demo value per claim field. Order here is the order the panel lists them. */
export const DEMO_CLAIM_DATA: Record<string, DemoClaimValue> = {
  additionalInfo: {
    box: "19",
    // Built from the patient on screen — never a fixed string about a case the
    // student is not working.
    value: (patient) =>
      `DEMO — TRAINING CLAIM${patient.mrn ? ` FOR ${patient.mrn}` : ""}, NOT A REAL ENCOUNTER`,
    stage: "Scribe / provider (additional claim information)",
  },
};

/**
 * Demo values for a **service line** (box 24A–24J).
 *
 * Empty by decision: 24A's demo date was a fixed 2026-07-09 that belonged to no
 * encounter on screen. The line's date of service now comes from the Coder's
 * per-line data or the encounter's own date, and a line with neither stays
 * blank and is flagged in box 24A.
 */
export const DEMO_LINE_DATA: Record<string, DemoClaimValue> = {};

/** One line printed under the paper so a demo value is never mistaken for real. */
export const DEMO_FILL_NOTE =
  "Grey italic values tagged DEMO are teaching placeholders — nothing in the claim record supplies them yet.";
