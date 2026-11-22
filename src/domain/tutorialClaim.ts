/**
 * tutorialClaim.ts — the Tutorial Patient's money half (seed version tutorial-2)
 *
 * Inspired by: the worked example a billing instructor hands out — the same
 * patient, the same encounter, followed past the code into the claim, the
 * clearinghouse, the payer's 835, the posting and the AR queue. Epic's training
 * environment and athenahealth's demo claims both keep one claim that has been
 * all the way round the cycle; this is that claim.
 *
 * Owner, 2026-11-22: *"tutorial patient needs to have all data filled from start
 * to end so that can act as a standard which data should be where."* The clinical
 * half (`domain/tutorialEncounter.ts`, seed `tutorial-1`) fills registration, the
 * note, the codes and the authorisation. This file fills the money:
 *
 *   - the CMS-1500 record, built by `utils/claimAutoFill.ts` from the patient's own
 *     card and the Coder's own lines — box 23 is the encounter's own authorisation
 *     (`domain/priorAuthNumber.ts`), never another chart's;
 *   - the claim number and the 837P / 277CA A1 timeline entries, through
 *     `domain/clearinghouse.ts`, the same module the Biller's submit button uses;
 *   - the 835, priced line by line by `domain/adjudication.ts`, with one denial;
 *   - the posting, through `domain/ledger.ts` — charge, insurance payment and
 *     contractual adjustment entries, and the remittance's own `postedAt`;
 *   - the claim's status, read from the money (`claimStatusForRemittance`), so the
 *     header and the ledger can never disagree;
 *   - the AR queue items: they are *derived* from the posted 835 and the ledger by
 *     `domain/arWorkQueue.ts`, so the denial needs no separate record here.
 *
 * THE ONE DENIAL, AND WHY IT IS THE E/M
 * The claim bills an office visit (99214) and a 12-lead ECG (93000) on the same
 * day, and the Coder's lines carry no modifiers — the seed never makes that
 * decision for a student (`utils/claimAutoFill.ts` says the same about box 24D).
 * The plan's same-day edit treats the E/M as part of the procedure when the E/M
 * carries no modifier 25, so the E/M is allowed nothing and written off under
 * CO-236. That is the app's own bundling rule and its own CARC (`CO-236`, the
 * same one `PLAN-CASCADIA-HEALTH-PPO`'s CCI edit and `MCASE-006` teach), and the
 * note still documents both services: the documentation is not in question, the
 * claim's 24D is. A line that carries modifier 25 is left alone, because the
 * separating modifier answers the edit.
 *
 * SEEDED ONCE, AND UPGRADED IN PLACE
 * `tutorialMoneyPending` is the guard. A record that already carries
 * `tutorial-2` is left exactly as it is. A record still on `tutorial-1` — the
 * clinical half, written by a browser that saw the previous build — is upgraded
 * with the money half only: the note, the codes, the signature, the authorisation
 * and the stage the chart opens on are never touched. A chart holding money work
 * of the student's own is never filled over, whatever its seed key says.
 */

import { CARC_BY_CODE } from "../data/claims/carc";
import type { Patient } from "../store/patientStore";
import type { PipelineEncounter } from "../store/pipelineEncounter";
import { buildClaimForm } from "../utils/claimAutoFill";
import { adjudicateClaim, outcomeOf, planForPayerName } from "./adjudication";
import type { Remittance835, RemittanceLine, RemittanceTotals } from "./adjudication";
import type { ClaimStatus } from "./claimStatus";
import { claimStatusForRemittance } from "./claimStatus";
import { buildSubmissionEvents } from "./clearinghouse";
import { appendLedgerEntries, postRemittanceToLedger } from "./ledger";
import { priorAuthForClaim } from "./priorAuthNumber";
import { appendStatusEvent, makeStatusEvent } from "./statusEvent";
import {
  TUTORIAL_CLINICAL_SEED_VERSION,
  TUTORIAL_PATIENT_ID,
  TUTORIAL_SEED_VERSION,
} from "./tutorialEncounter";

/** The E/M the plan's same-day edit bundles into the procedure. */
const EM_CPT = "99214";

/** The separator that answers the edit, when the Coder put it on the line. */
const SEPARATING_MODIFIER = "25";

/** The CARC a same-day edit writes the bundled line off under. */
const SAME_DAY_EDIT_CARC = "CO-236";

/** The staff member a seed is written as: the engine itself, not a student. */
const SEED_BY = "system";

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function hasModifier(modifiers: string[] | undefined, code: string): boolean {
  return (modifiers ?? []).some((m) => m.replace(/^-/, "").trim() === code);
}

/** One adjustment, worded from the single CARC table. */
function adjustment(carc: string, amountCents: number) {
  const entry = CARC_BY_CODE[carc];
  return {
    group: (entry?.group ?? "CO") as "CO" | "PR" | "OA" | "PI",
    carc,
    amountCents: Math.round(amountCents),
    description: entry?.description ?? "",
  };
}

/** The claim totals, summed the way `adjudicateClaim` sums them. */
function totalsOf(lines: RemittanceLine[]): RemittanceTotals {
  return lines.reduce<RemittanceTotals>(
    (sum, line) => ({
      billedCents: sum.billedCents + line.billedCents,
      allowedCents: sum.allowedCents + line.allowedCents,
      paidCents: sum.paidCents + line.paidCents,
      patientRespCents: sum.patientRespCents + line.patientRespCents,
      deductibleCents: sum.deductibleCents + line.deductibleCents,
      coinsuranceCents: sum.coinsuranceCents + line.coinsuranceCents,
      writeOffCents: sum.writeOffCents + line.writeOffCents,
      deniedCents: sum.deniedCents + (line.denied && line.patientRespCents === 0 ? line.billedCents : 0),
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
}

/**
 * The payer's same-day edit on the claim: the E/M line carries no modifier 25, so
 * the plan treats it as part of the procedure billed the same day and allows
 * nothing for it. Pure — the same 835 in gives the same 835 out.
 */
export function applySameDayEdit(remittance: Remittance835): Remittance835 {
  const target = remittance.lines.find((line) => line.cpt === EM_CPT && !line.denied);
  if (!target) return remittance;
  if (hasModifier(target.modifiers, SEPARATING_MODIFIER)) return remittance;

  const denied: RemittanceLine = {
    ...target,
    allowedCents: 0,
    deductibleCents: 0,
    coinsuranceCents: 0,
    copayCents: 0,
    paidCents: 0,
    patientRespCents: 0,
    writeOffCents: target.billedCents,
    insuranceBalanceCents: 0,
    adjustments: [adjustment(SAME_DAY_EDIT_CARC, target.billedCents)],
    denied: true,
    allowanceSource: "billed",
    explanation: `The plan's same-day edit treats ${target.cpt} as part of the procedure billed the same day, so it allowed nothing: ${dollars(
      target.billedCents,
    )} is a CO-236 contractual write-off, not a patient balance. Modifier 25 on the E/M, with a note showing a separately identifiable service, is what answers this edit.`,
  };

  const lines = remittance.lines.map((line) => (line === target ? denied : line));
  const totals = totalsOf(lines);
  return { ...remittance, lines, totals, outcome: outcomeOf(totals) };
}

/**
 * True when this record still needs the money half written onto it.
 *
 * Only a record that already carries the clinical half is upgraded, so the
 * upgrade can never land on a chart that was never seeded. A record at
 * `tutorial-2` is done, and a chart that holds money work of its own — a claim
 * number, a claim paper, a remittance, a ledger entry or AR state — is the
 * student's and is left alone.
 */
export function tutorialMoneyPending(encounter: PipelineEncounter | null | undefined): boolean {
  if (!encounter) return false;
  if (encounter.tutorialSeed !== TUTORIAL_CLINICAL_SEED_VERSION) return false;
  if (encounter.claimNumber || encounter.claimForm || encounter.claimStatus) return false;
  if (encounter.remittances.length > 0 || encounter.ledger.length > 0) return false;
  if (encounter.arItems.length > 0) return false;
  return true;
}

/**
 * The Tutorial Patient's encounter with the money half filled in.
 *
 * `at` is the seed's timestamp and `claimNumber` is minted by the caller from the
 * student's own sequence (`store/claimSequence.ts`), so two encounters can never
 * share a number. Nothing the clinical half wrote is touched: the note, its
 * signature, the codes, the authorisation, the stage the chart opens on and the
 * role all stay exactly as they were.
 */
export function applyTutorialMoneySeed(
  encounter: PipelineEncounter,
  patient: Patient,
  at: string,
  claimNumber: string,
): PipelineEncounter {
  if (!tutorialMoneyPending(encounter)) return encounter;
  if ((patient.id ?? "") !== TUTORIAL_PATIENT_ID) return encounter;
  if (!claimNumber) return encounter;

  const claimForm = buildClaimForm({
    patient,
    displayName: encounter.displayName,
    pipeline: { ...encounter, demoFillMissingBoxes: true },
    paNumber: priorAuthForClaim({ paData: encounter.paData, cptCodes: encounter.cptCodes }) || undefined,
    encounterDate: encounter.codingLines[0]?.dateOfService,
    placeOfService: encounter.codingLines[0]?.placeOfService,
  });

  const payerName = claimForm.payerName.trim();
  const plan = planForPayerName(payerName);
  const lineInputs = claimForm.serviceLines
    .filter((line) => (line.cpt ?? "").trim() !== "")
    .map((line) => ({
      cpt: line.cpt.trim(),
      modifiers: (Array.isArray(line.modifiers) ? line.modifiers : []).filter(Boolean),
      units: Number(line.units) > 0 ? Number(line.units) : 1,
      chargeCents: Math.round((Number(line.charge) || 0) * 100),
    }));
  if (lineInputs.length === 0) return encounter;

  // ── The 837P and the 277CA, from the same module the Biller's desk uses ──
  const { events: submitted, ack } = buildSubmissionEvents({
    facts: {
      track: "medical",
      claimNumber,
      subscriberId: claimForm.insuredId,
      subscriberIdOnFile: patient.insuranceRecord?.primary?.subscriberId ?? "",
      patientDob: claimForm.patientDob,
      patientDobOnFile: patient.dateOfBirth ?? "",
    },
    from: "draft",
    patientId: encounter.patientId,
    by: SEED_BY,
    jobRole: "biller",
    lineCount: lineInputs.length,
    payerName,
    existing: encounter.statusEvents,
    at,
  });
  // A rejected claim is never adjudicated, and a record this seed cannot carry
  // through is left exactly as it was rather than half-filled.
  if (ack.category !== "A1") return encounter;

  // ── The 835, priced line by line, then the plan's same-day edit ──
  const remittance = applySameDayEdit(
    adjudicateClaim({
      claimNumber,
      payerName,
      plan,
      lines: lineInputs,
      deductibleRemainingCents: Math.round((plan?.deductibleUsd ?? 0) * 100),
      priorAuthNumber: claimForm.priorAuthNumber ?? "",
      at,
    }),
  );

  // ── The posting: the money reaches the patient's ledger in this same write ──
  const entries = postRemittanceToLedger(remittance, {
    patientId: encounter.patientId,
    userId: SEED_BY,
    at,
  });
  const ledger = appendLedgerEntries(encounter.ledger, entries);
  const posted: Remittance835 = { ...remittance, postedAt: at };
  const status: ClaimStatus = claimStatusForRemittance(remittance);

  let events = submitted;
  events = appendStatusEvent(
    events,
    makeStatusEvent(
      {
        entityType: "claim",
        entityId: claimNumber,
        patientId: encounter.patientId,
        claimNumber,
        at,
        from: "accepted",
        to: "adjudicated",
        by: SEED_BY,
        jobRole: "system",
        reasonCode: "ERA_RECEIVED",
        reason: `835 ${remittance.checkOrEftNumber} received from ${remittance.payerName}: billed ${dollars(
          remittance.totals.billedCents,
        )}, allowed ${dollars(remittance.totals.allowedCents)}, paid ${dollars(
          remittance.totals.paidCents,
        )}, patient ${dollars(remittance.totals.patientRespCents)}.`,
        amountCents: remittance.totals.paidCents,
        refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
      },
      events,
    ),
  );
  events = appendStatusEvent(
    events,
    makeStatusEvent(
      {
        entityType: "claim",
        entityId: claimNumber,
        patientId: encounter.patientId,
        claimNumber,
        at,
        from: "adjudicated",
        to: "adjudicated",
        by: SEED_BY,
        jobRole: "payment-poster",
        reasonCode: "ERA_POSTED",
        reason: `835 ${remittance.checkOrEftNumber} posted: ${entries.length} ledger entr${
          entries.length === 1 ? "y" : "ies"
        } — charges ${dollars(remittance.totals.billedCents)}, insurance payment ${dollars(
          remittance.totals.paidCents,
        )}, contractual write-off ${dollars(remittance.totals.writeOffCents)}.`,
        amountCents: remittance.totals.paidCents,
        refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
      },
      events,
    ),
  );
  events = appendStatusEvent(
    events,
    makeStatusEvent(
      {
        entityType: "claim",
        entityId: claimNumber,
        patientId: encounter.patientId,
        claimNumber,
        at,
        from: "adjudicated",
        to: status,
        by: SEED_BY,
        jobRole: "payment-poster",
        reasonCode:
          remittance.outcome === "paid_in_full"
            ? "ERA_PAID_IN_FULL"
            : remittance.outcome === "partially_paid"
              ? "ERA_PARTIAL"
              : remittance.outcome === "patient_responsibility"
                ? "PATIENT_BALANCE_CREATED"
                : "ERA_DENIED",
        reason: `The money is on the patient's ledger: ${dollars(
          remittance.totals.paidCents,
        )} paid by ${remittance.payerName}, ${dollars(
          remittance.totals.writeOffCents,
        )} written off, ${dollars(remittance.totals.patientRespCents)} the patient's. The denied line is in the AR queue.`,
        amountCents:
          remittance.outcome === "patient_responsibility"
            ? remittance.totals.patientRespCents
            : remittance.totals.paidCents,
        refs: { eraId: remittance.id, checkNumber: remittance.checkOrEftNumber },
      },
      events,
    ),
  );

  const deniedLine = remittance.lines.find((line) => line.denied && line.patientRespCents === 0);

  return {
    ...encounter,
    claimForm,
    claimNumber,
    claimStatus: status,
    claimStatusMigrated: false,
    statusEvents: events,
    remittances: [posted],
    ledger,
    denialInfo: deniedLine
      ? {
          code: SAME_DAY_EDIT_CARC,
          reason: deniedLine.explanation,
          amount: deniedLine.billedCents / 100,
        }
      : encounter.denialInfo,
    status: "billed",
    tutorialSeed: TUTORIAL_SEED_VERSION,
  };
}
