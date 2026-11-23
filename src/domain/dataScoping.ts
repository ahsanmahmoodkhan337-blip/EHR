/**
 * dataScoping.ts — what a claim, a prior auth and a queue row are allowed to
 * belong to
 *
 * Spec `encounter-flow-audit-2026-11-20.md` item 5 ("Data scoping"), and
 * STANDING-RULES 3 (never invent data) and 6 (the student decides):
 *
 *  1. **A claim or a prior auth belongs to a patient and an encounter.** With no
 *     patient on screen there is nothing to bill or to authorise, so the record
 *     is refused with a reason the screen can show — never written into the
 *     bucket for work with no patient, where it reads as a real claim to the
 *     student (the "No patient attached" rows).
 *  2. **A queue inside an encounter lists that patient's records only.** The
 *     all-patients list belongs on a global view, so `scopeRecordsToPatient`
 *     returns this patient's records and the screen says how many belong to
 *     someone else.
 *  3. **A record that already exists without a patient is flagged, never
 *     deleted.** Deleting a student's saved claim is worse than labelling it, so
 *     `isOrphanClaim` marks it a demo orphan wherever a list prints it.
 *  4. **The charge coded in Coding arrives in the claim.** `carryCodingIntoClaim`
 *     fills box 24 (charge 24F, units 24G, place of service 24B, modifiers 24D)
 *     and box 28 from the Coder's own lines, and never overwrites a value the
 *     student typed on the claim.
 *
 * Pure: no React, no store, no DOM, no clock — every rule below is tested
 * directly in `tests/data-scoping.test.ts`.
 *
 * Inspiration: Epic's encounter record (a claim hangs off one encounter, and the
 * encounter carries the patient) and athenahealth's worklists, which are always
 * filtered by the patient or the practice you are working in.
 */

import type { ClaimFormData, ClaimServiceLine } from "../store/pipelineEncounter";

// ─── 1. Patient + encounter are required ───────────────────────────

/** The two ids every claim and every prior auth hangs off. */
export interface ScopingIds {
  patientId?: string | null;
  /** The encounter the record belongs to. */
  encounterId?: string | null;
}

export type ScopingRefusalCode = "no-patient" | "no-encounter";

export interface ScopingRefusal {
  code: ScopingRefusalCode;
  /** One line for the card or the toast — what is missing. */
  message: string;
  /** What the student does about it. */
  nextStep: string;
}

/**
 * In this build an encounter's id **is** its patient's id: the pipeline keys one
 * encounter per patient (`encounterKey` in `store/pipelineEncounter.ts`). Named
 * here once so the screens and the store ask the same question.
 */
export function encounterIdFor(patientId: string | null | undefined): string | null {
  return patientId ? patientId : null;
}

/** A blank id, a string of spaces and `"undefined"` are all "no id". */
function present(id: string | null | undefined): boolean {
  const trimmed = (id ?? "").trim();
  return trimmed.length > 0 && trimmed !== "undefined" && trimmed !== "null";
}

/**
 * Why a claim or a prior auth cannot be created here, or null when it can.
 * Checked before a record is written **and** by the store that writes it, so a
 * screen that forgets the check cannot create an unattached record.
 */
export function scopingRefusal(ids: ScopingIds): ScopingRefusal | null {
  if (!present(ids.patientId)) {
    return {
      code: "no-patient",
      message: "No patient on screen, so there is nothing to bill or authorise.",
      nextStep: "Open a patient's chart from the Inbox or the Patients list, then come back to this stage.",
    };
  }
  if (!present(ids.encounterId)) {
    return {
      code: "no-encounter",
      message: "No encounter on screen, so this record would not belong to a visit.",
      nextStep: "Start the visit (Start Visit) so the patient has an encounter, then come back to this stage.",
    };
  }
  return null;
}

/** The same question as a boolean, for a disabled control. */
export function canCreateRecord(ids: ScopingIds): boolean {
  return scopingRefusal(ids) === null;
}

// ─── 2. A queue inside an encounter is that patient's queue ────────

/** Anything that names the patient it belongs to — a PA record, a denial row. */
export interface PatientScoped {
  patientId?: string | null;
}

/** The records that belong to this patient. No patient means no records. */
export function scopeRecordsToPatient<T extends PatientScoped>(
  records: readonly T[],
  patientId: string | null | undefined,
): T[] {
  if (!present(patientId)) return [];
  return records.filter((record) => record.patientId === patientId);
}

/** The records that name no patient — the ones a queue must never print as real. */
export function recordsWithNoPatient<T extends PatientScoped>(records: readonly T[]): T[] {
  return records.filter((record) => !present(record.patientId));
}

/**
 * The sentence a scoped queue shows about the records it is not showing. Null
 * when every record belongs to the patient on screen.
 */
export function otherPatientsNote(total: number, shown: number, noun = "prior authorisation"): string | null {
  const elsewhere = total - shown;
  if (elsewhere <= 0) return null;
  return `${elsewhere} more ${noun}${elsewhere === 1 ? "" : "s"} belong to another patient — open that patient's chart to see ${elsewhere === 1 ? "it" : "them"}.`;
}

// ─── 3. A claim with no patient is a flagged demo orphan ───────────

/** The label every list prints for a claim that names no patient. */
export const ORPHAN_CLAIM_LABEL = "demo orphan — no patient or encounter attached";

/** True for a claim record whose encounter names no patient. */
export function isOrphanClaim(encounter: {
  patientId: string | null;
  claimNumber: string | null;
}): boolean {
  return Boolean(encounter.claimNumber) && !present(encounter.patientId);
}

/** The row title for a claim, saying so when it belongs to nobody. */
export function claimRowTitle(
  claimNumber: string,
  patientLabel: string,
  orphan: boolean,
): string {
  return orphan ? `${claimNumber} · ${patientLabel} (${ORPHAN_CLAIM_LABEL})` : `${claimNumber} · ${patientLabel}`;
}

// ─── 4. The coded charge arrives in the claim ─────────────────────

export interface CarryResult {
  form: ClaimFormData;
  /** True when anything on the claim changed, so the caller can skip a write. */
  changed: boolean;
  /** The CPT codes whose box-24 values were filled in from Coding. */
  carried: string[];
}

function cents(value: number | null | undefined): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(n * 100);
}

function blank(value: string | null | undefined): boolean {
  return (value ?? "").trim().length === 0;
}

/**
 * Fill the claim's box 24 and box 28 from the lines the Coder handed over.
 *
 * What it fills: **24F** charge, **24G** units, **24B** place of service and
 * **24D** modifiers, matched on the CPT code, plus **28** total charge as the sum
 * of the lines' charges.
 *
 * What it never touches: a value the student already typed on the claim. A line
 * whose charge is set stays set, a modifier list that is not empty stays as it
 * is, and a total charge that is not zero is the student's. So a re-run after a
 * student edit changes nothing, and a claim built before Coding was finished
 * picks the coder's values up on the next open instead of reading "no charge
 * captured".
 */
export function carryCodingIntoClaim(
  form: ClaimFormData,
  codingLines: readonly ClaimServiceLine[] | null | undefined,
): CarryResult {
  const coderLines = (codingLines ?? []).filter((line) => !blank(line.cpt));
  if (coderLines.length === 0) return { form, changed: false, carried: [] };

  const carried: string[] = [];
  const existing = form.serviceLines ?? [];

  let lines: ClaimServiceLine[];
  if (existing.length === 0) {
    // Box 24 is empty: the coder's own lines are the rows. 24I is XX because
    // 24J is an NPI on every path this app builds.
    lines = coderLines.slice(0, 6).map((line) => ({ ...line, idQualifier: line.idQualifier || "XX" }));
    carried.push(...lines.map((line) => line.cpt));
  } else {
    lines = existing.map((line) => {
      const coder = coderLines.find((c) => c.cpt === line.cpt);
      if (!coder) return line;
      const next: ClaimServiceLine = { ...line };
      let touched = false;
      // A line the student has not worked: no charge of its own. Its units and
      // place of service are still the blank defaults, so the coder's values
      // belong here. A line that carries a charge is the student's — its units,
      // POS and modifiers are left exactly as typed.
      const unworked = cents(next.charge) <= 0;

      // 24F — the charge the coder decided, only where the claim has none.
      if (unworked && cents(coder.charge) > 0) {
        next.charge = coder.charge;
        touched = true;
      }
      // 24G — days or units.
      if (unworked && coder.units > 0 && next.units !== coder.units) {
        next.units = coder.units;
        touched = true;
      }
      // 24B — place of service, only where the claim line carries none.
      if (blank(next.placeOfService) && !blank(coder.placeOfService)) {
        next.placeOfService = coder.placeOfService;
        touched = true;
      }
      // 24D — the modifiers the coder applied, only where the claim has none.
      if ((next.modifiers ?? []).length === 0 && (coder.modifiers ?? []).length > 0) {
        next.modifiers = [...coder.modifiers];
        touched = true;
      }
      if (touched) carried.push(next.cpt || coder.cpt);
      return next;
    });
  }

  // Box 28 is 24F × 24G per line, the same arithmetic the paper and the edit
  // check use — a bare-charge total printed $100 for 3 units at $100.
  const lineTotal = lines.reduce(
    (sum, line) => sum + cents(line.charge) * (line.units > 0 ? line.units : 1),
    0,
  );
  let totalCharge = form.totalCharge;
  // Box 28 — filled from the lines only when the claim's own total is zero.
  if (cents(totalCharge) <= 0 && lineTotal > 0) totalCharge = lineTotal / 100;

  const linesChanged =
    lines.length !== existing.length ||
    lines.some((line, i) => {
      const before = existing[i];
      if (!before) return true;
      return (
        line.charge !== before.charge ||
        line.units !== before.units ||
        line.placeOfService !== before.placeOfService ||
        (line.modifiers ?? []).length !== (before.modifiers ?? []).length ||
        (line.modifiers ?? []).some((m, j) => m !== (before.modifiers ?? [])[j])
      );
    });
  const changed = linesChanged || totalCharge !== form.totalCharge;

  if (!changed) return { form, changed: false, carried: [] };
  return { form: { ...form, serviceLines: lines, totalCharge }, changed: true, carried };
}
