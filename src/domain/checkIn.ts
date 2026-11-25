/**
 * Check-in — the copay the front desk collects becomes a ledger entry
 * (`specs/patient-hub.md` § Appointments).
 *
 * Inspired by: eClinicalWorks' Check-In activity, where the visit is marked
 * arrived, eligibility is run for that visit and the copay is taken before the
 * provider sees the patient. The copay is money, so it is posted to the visit's
 * ledger as a patient payment — never left as a field on the appointment. The
 * appointment only remembers the amount and the id of the entry it posted, so a
 * student can always trace the figure back to the ledger.
 *
 * Pure: no store, no clock of its own, and the entry id is derived from the
 * appointment, so pressing Collect twice adds no money.
 */

import type { LedgerEntry } from "./ledger";
import { localDay } from "../utils/localDay";

/** The code a check-in copay carries on the ledger. */
export const COPAY_LEDGER_CODE = "COPAY";

export interface CopayInput {
  /** The appointment the money was collected against. */
  appointmentId: string;
  patientId: string | null;
  /** Dollars collected at the desk. */
  amountUsd: number;
  /** ISO timestamp of the collection. */
  at: string;
  /** Appointment type, for the entry's description. */
  appointmentType?: string;
  /** The encounter's claim number when it has one yet, else "". */
  claimNumber?: string | null;
  /** The student's phone, or "front-desk". */
  userId?: string;
}

/**
 * The patient-payment entry for a copay, or null when there is no money to post
 * (zero, negative or not a number). Sign convention follows `domain/ledger.ts`:
 * a patient payment is negative, because it reduces what the patient owes.
 */
export function copayLedgerEntry(input: CopayInput): LedgerEntry | null {
  const amount = Number(input.amountUsd);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    // Deterministic: the same appointment posts one copay, ever.
    id: `COPAY-${input.appointmentId}`,
    patientId: input.patientId,
    claimNumber: input.claimNumber ?? "",
    date: localDay(input.at),
    type: "patient_payment",
    code: COPAY_LEDGER_CODE,
    description: `Copay collected at check-in${input.appointmentType ? ` — ${input.appointmentType}` : ""}`,
    amountCents: -Math.round(amount * 100),
    userId: input.userId ?? "front-desk",
  };
}

/** The appointment fields the copay lookup needs. */
export interface CopayAppointment {
  id: string;
  patientId?: string | null;
  checkedInAt?: string | null;
  copayUsd?: number | null;
  copayPostedLedgerEntryId?: string | null;
}

export interface PostedCopay {
  appointmentId: string;
  copayUsd: number;
  checkedInAt: string;
  ledgerEntryId: string;
}

/**
 * The copay posted for a patient at check-in, newest visit first. Only an
 * appointment that recorded both the amount and the ledger entry it posted
 * counts — an amount with no entry behind it is not money the ledger holds.
 */
export function postedCopayForPatient(
  appointments: CopayAppointment[],
  patientId: string | null | undefined,
): PostedCopay | null {
  if (!patientId) return null;
  const posted = appointments
    .filter(
      (a) =>
        a.patientId === patientId &&
        typeof a.copayUsd === "number" &&
        a.copayUsd > 0 &&
        Boolean(a.copayPostedLedgerEntryId),
    )
    .sort((a, b) => (a.checkedInAt ?? "").localeCompare(b.checkedInAt ?? ""));
  const latest = posted[posted.length - 1];
  if (!latest) return null;
  return {
    appointmentId: latest.id,
    copayUsd: latest.copayUsd as number,
    checkedInAt: latest.checkedInAt ?? "",
    ledgerEntryId: latest.copayPostedLedgerEntryId as string,
  };
}
