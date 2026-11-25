/**
 * codingDraft — the coder's picks before they are submitted.
 *
 * The Coding stage held its ICD-10 and CPT picks in screen state only, so a
 * student who picked codes and then left the stage (Back, the stepper, Continue)
 * came back to an empty screen. The draft keeps those picks per student and per
 * patient until "Submit Coded Encounter to Billing" is pressed; after that the
 * pipeline holds the codes and the draft is dropped.
 *
 * Browser storage can be missing or full; every call fails quietly, because a
 * lost draft only costs re-picking codes, never a saved record.
 */

import { getLoggedInPhone } from "../../store/accessStore";

export interface CodingDraft {
  icd: string[];
  cpt: string[];
  /** Per-CPT line data (links, modifiers, POS, units, charge), keyed by CPT. */
  cptData: Record<string, unknown>;
}

const PREFIX = "hh_coding_draft_";

/** One storage key per student; inside it, one draft per patient. */
export interface CodingDraftRef {
  storageKey: string;
  patientId: string;
}

export function codingDraftKey(patientId: string | null | undefined): CodingDraftRef {
  let phone = "";
  try {
    phone = getLoggedInPhone() ?? "";
  } catch {
    phone = "";
  }
  return { storageKey: `${PREFIX}${phone}`, patientId: patientId ?? "" };
}

function readAll(storageKey: string): Record<string, CodingDraft> {
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, CodingDraft>) : {};
  } catch {
    return {};
  }
}

function writeAll(storageKey: string, all: Record<string, CodingDraft>): void {
  try {
    if (Object.keys(all).length === 0) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(all));
  } catch {
    /* storage unavailable — the draft is a convenience only */
  }
}

export function readCodingDraft(ref: CodingDraftRef): CodingDraft | null {
  const d = readAll(ref.storageKey)[ref.patientId];
  if (!d || !Array.isArray(d.icd) || !Array.isArray(d.cpt)) return null;
  return { icd: d.icd, cpt: d.cpt, cptData: d.cptData ?? {} };
}

export function writeCodingDraft(ref: CodingDraftRef, draft: CodingDraft): void {
  const all = readAll(ref.storageKey);
  if (draft.icd.length === 0 && draft.cpt.length === 0) delete all[ref.patientId];
  else all[ref.patientId] = draft;
  writeAll(ref.storageKey, all);
}

export function clearCodingDraft(ref: CodingDraftRef): void {
  const all = readAll(ref.storageKey);
  delete all[ref.patientId];
  writeAll(ref.storageKey, all);
}
