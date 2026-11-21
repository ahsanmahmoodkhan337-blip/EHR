/**
 * rail-pages.test.ts — the five money-cycle rail pages read only real records
 *
 * Spec `eleven-rail-pages.md` (owner decisions, 2026-11-20). What is checked
 * here:
 *
 *  - a count or a dollar on a page equals the same figure computed from the
 *    store it names, pinned per page;
 *  - a page with no records names the stage that fills it, and never shows a
 *    sample record as if the student had made it;
 *  - the claim filters (status, payer, date) only ever narrow the student's own
 *    claims, and the filter options come from those claims;
 *  - no page renders a debug or simulate control and no rail entry says Soon.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEncounter, type PipelineEncounter } from "../src/store/pipelineEncounter";
import { makeStatusEvent } from "../src/domain/statusEvent";
import type { Remittance835 } from "../src/domain/adjudication";
import { postRemittanceToLedger } from "../src/domain/ledger";
import { buildArWorkQueue } from "../src/domain/arWorkQueue";
import {
  EMPTY_CLAIM_FILTERS,
  arAgingTotals,
  buildArRows,
  buildClaimRows,
  buildCodingRows,
  buildDenialRows,
  buildPaymentRows,
  buildReportTotals,
  filterClaimRows,
  payerOptions,
  splitDenialRows,
  statusOptions,
} from "../src/domain/railPages";

const root = join(import.meta.dir, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const AT = "2026-11-20T10:00:00.000Z";
const NOW = "2026-12-05T10:00:00.000Z";

const NAMES: Record<string, string> = {
  "MPT-2001": "Amara Okafor",
  "MPT-2002": "Luis Ferreira",
};
const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string =>
  (patientId ? NAMES[patientId] : undefined) ?? fallback ?? "No patient attached";

/** An encounter whose note was signed and locked — the event Sign & Lock writes. */
function signedEncounter(patientId: string, patch: Partial<PipelineEncounter> = {}): PipelineEncounter {
  const base = createEncounter(patientId);
  const event = makeStatusEvent(
    {
      entityType: "encounter",
      entityId: patientId,
      patientId,
      from: "open",
      to: "signed",
      by: "+923000000000",
      jobRole: "scribe",
      reasonCode: "NOTE_SIGNED",
      reason: "The progress note was signed and locked, so the encounter is ready for coding.",
    },
    base.statusEvents,
  );
  return { ...base, stage: "coder", status: "charted", scribeNote: "note", statusEvents: [event], ...patch };
}

/** A hand-built 835: one paid line and one line the payer refused under CO-197. */
function remittance(overrides: Partial<Remittance835> = {}): Remittance835 {
  return {
    id: "835-CLM-000001",
    track: "medical",
    claimNumber: "CLM-000001",
    claimControlNumber: "CLM-000001",
    payerName: "Meridian Health Plan",
    planId: "PLAN-1",
    checkOrEftNumber: "EFT-1",
    paymentDate: "2026-11-20",
    lines: [
      {
        lineNumber: 1,
        cpt: "99213",
        modifiers: [],
        units: 1,
        billedCents: 15000,
        allowedCents: 12000,
        deductibleCents: 0,
        coinsuranceCents: 0,
        copayCents: 0,
        paidCents: 12000,
        patientRespCents: 0,
        writeOffCents: 3000,
        insuranceBalanceCents: 0,
        adjustments: [
          { group: "CO", carc: "CO-45", amountCents: 3000, description: "Contracted allowance difference" },
        ],
        denied: false,
        allowanceSource: "plan-rule",
      },
      {
        lineNumber: 2,
        cpt: "20610",
        modifiers: [],
        units: 1,
        billedCents: 9000,
        allowedCents: 9000,
        deductibleCents: 0,
        coinsuranceCents: 0,
        copayCents: 0,
        paidCents: 0,
        patientRespCents: 0,
        writeOffCents: 9000,
        insuranceBalanceCents: 0,
        adjustments: [
          {
            group: "CO",
            carc: "CO-197",
            amountCents: 9000,
            description: "Precertification/authorization absent",
            remark: "N54",
          },
        ],
        denied: true,
        allowanceSource: "plan-rule",
      },
    ],
    totals: {
      billedCents: 24000,
      allowedCents: 21000,
      paidCents: 12000,
      patientRespCents: 0,
      deductibleCents: 0,
      coinsuranceCents: 0,
      writeOffCents: 12000,
      deniedCents: 9000,
    },
    outcome: "partially_paid",
    plb: [],
    receivedAt: AT,
    ...overrides,
  };
}

const withClaim: PipelineEncounter = signedEncounter("MPT-2001", {
  icdCodes: ["M17.11"],
  cptCodes: ["99213"],
  claimNumber: "CLM-000001",
  claimStatus: "submitted",
  remittances: [remittance()],
  claimForm: null,
});

describe("Coding — a signed note with no codes, and nothing else", () => {
  const encounters = [
    signedEncounter("MPT-2001"),
    // Signed, but the coder already handed codes over: past this queue.
    signedEncounter("MPT-2002", { icdCodes: ["E11.9"], cptCodes: ["99214"] }),
    // Never signed: a draft is not a signature.
    { ...createEncounter("MPT-2003"), scribeNote: "draft only" },
  ];

  test("only the signed encounter with no codes is listed", () => {
    const rows = buildCodingRows({ encounters, nameForPatient });
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Amara Okafor");
    expect(rows[0].target).toEqual({
      kind: "medical",
      patientId: "MPT-2001",
      role: "coder",
      stage: "coding",
    });
  });

  test("the row prints the signature time from the encounter's own timeline", () => {
    const rows = buildCodingRows({ encounters, nameForPatient });
    const signedAt = rows[0].fields.find((field) => field.label === "Note signed");
    expect(signedAt?.value).not.toBe("an unrecorded time");
    expect(rows[0].fields.find((field) => field.label === "Procedures")?.value).toBe("none submitted");
  });

  test("an empty store yields no rows — the page, not the builder, says what fills it", () => {
    expect(buildCodingRows({ encounters: [], nameForPatient })).toEqual([]);
  });
});

describe("Claims — the student's own claims, filtered by status, payer and date", () => {
  const second: PipelineEncounter = signedEncounter("MPT-2002", {
    icdCodes: ["J06.9"],
    cptCodes: ["99213"],
    claimNumber: "CLM-000002",
    claimStatus: "denied",
    remittances: [],
    claimForm: null,
  });
  const rows = buildClaimRows({ encounters: [withClaim, second], nameForPatient });

  test("one row per claim number, with the status its own record holds", () => {
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.claimNumber).sort()).toEqual(["CLM-000001", "CLM-000002"]);
    expect(rows.find((row) => row.claimNumber === "CLM-000001")?.statusLabel).toBe("Submitted");
    expect(rows.find((row) => row.claimNumber === "CLM-000002")?.statusLabel).toBe("Denied");
  });

  test("the payer and the billed total come off the claim, never from a guess", () => {
    const row = rows.find((r) => r.claimNumber === "CLM-000001")!;
    expect(row.payer).toBe("Meridian Health Plan");
    expect(row.billedCents).toBe(0); // no paper opened, no coded line: nothing billed is claimed
  });

  test("filters narrow the list and never add to it", () => {
    expect(filterClaimRows(rows, EMPTY_CLAIM_FILTERS)).toHaveLength(2);
    expect(filterClaimRows(rows, { ...EMPTY_CLAIM_FILTERS, status: "denied" })).toHaveLength(1);
    expect(filterClaimRows(rows, { ...EMPTY_CLAIM_FILTERS, payer: "Meridian Health Plan" })).toHaveLength(1);
    expect(filterClaimRows(rows, { ...EMPTY_CLAIM_FILTERS, date: "2026-01-01" })).toHaveLength(0);
  });

  test("the filter options are the student's own payers and statuses", () => {
    expect(payerOptions(rows)).toEqual(["Meridian Health Plan"]);
    expect(statusOptions(rows).map((option) => option.value).sort()).toEqual(["denied", "submitted"]);
  });
});

describe("Payments — only 835s that have not reached the ledger", () => {
  const unposted: PipelineEncounter = { ...withClaim, remittances: [remittance()] };
  const posted: PipelineEncounter = { ...withClaim, remittances: [remittance({ postedAt: AT })] };

  test("an unposted 835 is listed with its own paid amount and line count", () => {
    const rows = buildPaymentRows({ encounters: [unposted], nameForPatient });
    expect(rows).toHaveLength(1);
    expect(rows[0].amountCents).toBe(unposted.remittances[0].totals.paidCents);
    expect(rows[0].lines).toBe(2);
    expect(rows[0].target).toEqual({ kind: "medical", patientId: "MPT-2001", role: "biller" });
  });

  test("a posted 835 is not on the Payments page any more", () => {
    expect(buildPaymentRows({ encounters: [posted], nameForPatient })).toEqual([]);
  });
});

describe("Denials and AR — items exist only where posted money exists", () => {
  const posted: PipelineEncounter = { ...withClaim, remittances: [remittance({ postedAt: AT })] };
  // The ledger the posting wrote — an AR item needs posted money behind it.
  const ledger = postRemittanceToLedger(posted.remittances[0], {
    patientId: "MPT-2001",
    userId: "+923000000000",
    at: AT,
  });
  const items = buildArWorkQueue(
    [
      {
        patientId: "MPT-2001",
        patientName: "Amara Okafor",
        claimNumber: "CLM-000001",
        remittances: posted.remittances,
        ledger,
        arItems: [],
      },
    ],
    NOW,
  );
  const denials = buildDenialRows({ items, encounters: [posted], nameForPatient });

  test("the denied line carries its group, CARC, RARC and deadline", () => {
    expect(denials).toHaveLength(1);
    expect(denials[0].group).toBe("CO");
    expect(denials[0].carc).toBe("CO-197");
    expect(denials[0].rarc).toBe("N54");
    expect(denials[0].amountCents).toBe(9000);
    // 120 days after the 835's payment date — the window the simulation teaches.
    expect(denials[0].appealDeadline).toBe("2027-03-20");
  });

  test("a denial with no remark on the 835 says so instead of inventing a RARC", () => {
    const bare = remittance({ postedAt: AT });
    bare.lines[1].adjustments[0].remark = undefined;
    const bareItems = buildArWorkQueue(
      [
        {
          patientId: "MPT-2001",
          patientName: "Amara Okafor",
          claimNumber: "CLM-000001",
          remittances: [bare],
          ledger,
          arItems: [],
        },
      ],
      NOW,
    );
    const bareEncounter: PipelineEncounter = { ...posted, remittances: [bare] };
    const rows = buildDenialRows({ items: bareItems, encounters: [bareEncounter], nameForPatient });
    expect(rows[0].rarc).toBe("none on this 835");
  });

  test("denials split into to-work and appealed-awaiting-answer", () => {
    expect(splitDenialRows(denials).toWork).toHaveLength(1);
    expect(splitDenialRows(denials).appealed).toHaveLength(0);

    const appealed = denials.map((row) => ({ ...row, appealed: true }));
    expect(splitDenialRows(appealed).appealed).toHaveLength(1);
    expect(splitDenialRows(appealed).toWork).toHaveLength(0);
  });

  test("the AR worklist prints the age, the bucket and the follow-up date", () => {
    const rows = buildArRows({ items, nameForPatient });
    expect(rows).toHaveLength(1);
    expect(rows[0].fields.find((field) => field.label === "Age")?.value).toBe("15 days · 0-30");
    expect(rows[0].followUp).toBe("2027-03-20");
    expect(rows[0].lastAction).toBe("not worked yet");
    expect(rows[0].note).toBe("no note yet");
  });

  test("the aging buckets sum to the open money and keep every bucket", () => {
    const aging = arAgingTotals(items);
    expect(aging.map((bucket) => bucket.bucket)).toEqual(["0-30", "31-60", "61-90", "91-120", "120+"]);
    expect(aging.reduce((sum, bucket) => sum + bucket.cents, 0)).toBe(
      items.filter((item) => item.status !== "resolved").reduce((sum, item) => sum + item.amountCents, 0),
    );
  });
});

describe("Reports — every dollar is summed from a posted 835", () => {
  const posted: PipelineEncounter = { ...withClaim, remittances: [remittance({ postedAt: AT })] };
  const unposted: PipelineEncounter = { ...withClaim, remittances: [remittance()] };

  test("money equals the posted 835's own totals", () => {
    const totals = buildReportTotals({ encounters: [posted], items: [] });
    const postedRemittance = posted.remittances[0];
    expect(totals.money?.postedRemittances).toBe(1);
    expect(totals.money?.billedCents).toBe(postedRemittance.totals.billedCents);
    expect(totals.money?.allowedCents).toBe(postedRemittance.totals.allowedCents);
    expect(totals.money?.paidCents).toBe(postedRemittance.totals.paidCents);
    expect(totals.money?.adjustedCents).toBe(postedRemittance.totals.writeOffCents);
    expect(totals.money?.patientRespCents).toBe(postedRemittance.totals.patientRespCents);
  });

  test("an 835 that was not posted adds no money", () => {
    const totals = buildReportTotals({ encounters: [unposted], items: [] });
    expect(totals.money).toBeNull();
  });

  test("claims by status are counted from the claims, not estimated", () => {
    const totals = buildReportTotals({ encounters: [posted], items: [] });
    expect(totals.claimCount).toBe(1);
    expect(totals.claimsByStatus).toEqual([{ status: "submitted", label: "Submitted", count: 1 }]);
  });
});

describe("the five pages are honest about an empty record", () => {
  const pages: { file: string; stage: string }[] = [
    { file: "src/routes/coding.tsx", stage: "Sign & Lock" },
    { file: "src/routes/claims.tsx", stage: "Claim stage" },
    { file: "src/routes/payments.tsx", stage: "adjudicated" },
    { file: "src/routes/denials-ar.tsx", stage: "Biller stage" },
    { file: "src/routes/reports.tsx", stage: "Biller stage" },
  ];

  for (const page of pages) {
    test(`${page.file} names the stage that fills it`, () => {
      const source = read(page.file);
      expect(source).toContain("<RailEmptyState");
      expect(source).toContain(page.stage);
      expect(source).not.toContain("Soon");
      expect(source.toLowerCase()).not.toContain("simulate denial");
      expect(source).not.toContain("<ScenarioInjector");
    });
  }
});
