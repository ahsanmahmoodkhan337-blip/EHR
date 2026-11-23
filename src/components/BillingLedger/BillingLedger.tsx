/**
 * BillingLedger — Enhanced Medical Biller Workspace
 *
 * Full educational content for medical billing students:
 * - The CMS-1500 (02/12) replica: all 33 boxes, auto-filled from the earlier
 *   stages, editable in place, validated before submission, printable and
 *   downloadable as a PDF (see CMS1500Form.tsx + ClaimFormShell.tsx)
 * - Claim scrubber with NCCI edits check
 * - Denial code reference (CO, PR, OA codes)
 * - ERA/EOB explanation on paid claims
 * - Revenue codes and POS codes reference, plus the 33-box explanations
 * - Reimbursement calculator
 *
 * Inspiration: Epic Resolute Hospital Billing / AAPC CPB curriculum
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Receipt, AlertTriangle, CheckCircle2, XCircle, Search, DollarSign, BookOpen, Info, Route, Star, Shield, FileDown } from "lucide-react";
import { usePipeline, type ClaimFormData, type ClaimServiceLine } from "../../store/pipelineStore";
import { usePatientStore } from "../../store/patientStore";
import { CMS1500_BLOCKS, POS_CODES } from "./claimData";
import { CARC_BY_CODE, CARC_CODES as DENIAL_CODES } from "../../data/claims/carc";
import { CPT_CODES } from "../CodingQueue/cptData";
import { PA_PROCEDURES } from "../PriorAuthPortal/paData";
import { exportClaimFormPDF } from "../../utils/claimFormPdf";
import { scoreBiller, updateStageScore, getStudentName } from "../../utils/scoring";
import { ClaimFormShell } from "../claims/ClaimFormShell";
import { StatusTimeline } from "../status/StatusTimeline";
import { ClaimAckChip, ClaimAckPanel } from "../status/ClaimAckPanel";
import { RemittancePanel } from "../status/RemittancePanel";
import { PatientLedgerPanel } from "../status/PatientLedgerPanel";
import { ArWorkQueuePanel } from "../status/ArWorkQueuePanel";
import { statusEventsFor } from "../../domain/statusEvent";
import { CLAIM_STATUS_LABELS } from "../../domain/claimStatus";
import { ackForClaim, evaluateSubmission } from "../../domain/clearinghouse";
import { remittanceForClaim } from "../../domain/adjudication";
import { CMS1500Form } from "./CMS1500Form";
import { Ub04Form } from "./Ub04Form";
import { UB04_LAYOUT, UB04_PDF_COLUMNS } from "../../data/claims/ub04Layout";
import { REVENUE_CODES as UB04_REVENUE_CODES } from "../../data/claims/revenueCodes";
import { CMS1500_LAYOUT, CMS1500_LINE_COLUMNS } from "../../data/claims/cms1500Layout";
import { DEMO_PROVIDER_NOTE, MEDICAL_PROVIDER_PROFILE } from "../../data/claims/providerProfile";
import { providerProfileFor } from "../../data/claims/renderingProviders";
import { buildClaimForm, blankServiceLine, backfillIdentityBoxes, identitySeedFor, reseedIdentityBoxes, stripFabricatedIds, repairClaimParties } from "../../utils/claimAutoFill";
import { validateCMS1500, validateUB04, type ClaimIssue } from "../../utils/claimValidation";
import {
  useEncounterPatientId,
  useEncounterPlaceOfService,
  useEncounterDateOfService,
  useEncounterProvider,
} from "../../utils/encounterPatient";
import {
  CLAIM_TYPE_OPTIONS,
  CLAIM_PAPER_RULE,
  type ClaimType,
} from "../../data/claims/claimType";
import { checkPlaceOfService, principalDiagnosisOf } from "../../domain/claimPaper";
import { claimPayer } from "../../domain/patientCard";
import { priorAuthForClaim } from "../../domain/priorAuthNumber";
import { carryCodingIntoClaim, encounterIdFor, scopingRefusal } from "../../domain/dataScoping";
import { toast } from "sonner";

type BillingTab = "form" | "remittance" | "denials" | "references";

/**
 * Column spec for the box-24 table in the downloaded PDF — the same list the
 * on-screen table prints from, so the paper and the PDF cannot disagree about
 * which 837P element a column becomes.
 */
const CMS1500_PDF_COLUMNS = CMS1500_LINE_COLUMNS.map((col) => ({
  key: col.key,
  label: `${col.box} ${col.caption}`,
  width: col.width,
  kind: col.kind,
  x12: col.x12,
}));

/**
 * `openTab` — which of the biller's screens to open on. The encounter's flow has
 * two stages on this desk (owner's audit, 2026-11-20, item 1): **Billing / Claim**
 * opens the claim paper, **Payments (835)** opens the remittance and ledger tab.
 */
export interface BillingLedgerProps {
  openTab?: BillingTab;
}

/** A saved claim's service lines, whatever shape an earlier build left them in. */
function savedLinesOf(form: ClaimFormData | null | undefined): ClaimServiceLine[] {
  const lines = (form as { serviceLines?: unknown } | null | undefined)?.serviceLines;
  if (!Array.isArray(lines)) return [];
  return lines.filter((line): line is ClaimServiceLine => Boolean(line) && typeof line === "object");
}

/** A coded line's own fields, for the seeding key below. */
function codingLineKey(lines: readonly ClaimServiceLine[] | null | undefined): string {
  if (!Array.isArray(lines)) return "";
  return lines
    .map((line) =>
      [
        line.cpt ?? "",
        line.charge ?? "",
        line.units ?? "",
        line.placeOfService ?? "",
        Array.isArray(line.modifiers) ? line.modifiers.join(",") : String(line.modifiers ?? ""),
        line.renderingNpi ?? "",
      ].join("|"),
    )
    .join(";");
}

/**
 * Everything one claim-seeding pass depends on: **the patient, the encounter**
 * and the facts that pass carries onto the paper — the chart's identity boxes,
 * this encounter's own authorisation, the Coder's lines, the place of service
 * and the provider the visit was booked with.
 *
 * Two passes with the same key would compute the same patch, so the second is
 * skipped. That is what stops this effect re-firing on every render (React
 * error #185): a write the store refuses leaves the claim unchanged, so without
 * the key the next render would seed again, and the one after that, forever.
 */
function claimSeedKey(input: {
  patientId: string;
  patientFingerprint: string;
  priorAuth: string;
  claimType: string;
  encounterDate: string | null;
  encounterPos: string | null;
  encounterProvider: string | null;
  codingLines: readonly ClaimServiceLine[] | null | undefined;
}): string {
  return [
    input.patientId,
    input.patientFingerprint,
    input.priorAuth,
    input.claimType,
    input.encounterDate ?? "",
    input.encounterPos ?? "",
    input.encounterProvider ?? "",
    codingLineKey(input.codingLines),
  ].join("~");
}

export function BillingLedger({ openTab }: BillingLedgerProps = {}) {
  const { state, submitClaim, handleDenial, setRole, paRecords, setClaimForm, setDemoFillMissingBoxes, transmitClaim, adjudicateClaim, postRemittance } = usePipeline();
  const claimForm = state.claimForm;
  const { caseStates, setBillingStatus, setPaStatus, addRoutingNote, addAuditLog, getPatientById } = usePatientStore();
  // The encounter knows its patient even when the pipeline's nullable
  // `patientId` does not — a restored session or the Coder's "Skip to Billing"
  // path can reach this screen with it unset, which left boxes 1a, 2, 3, 4, 5,
  // 6 and 7 blank on the paper.
  const patientId = useEncounterPatientId(state.patientId) || "";
  const patient = patientId ? getPatientById(patientId) : undefined;
  const cs = patientId ? caseStates[patientId] : undefined;

  // ── The payer this claim bills ──────────────────────────────────
  // Read from the patient's own coverage record (`domain/patientCard.ts`) — the
  // same reader the banner, Registration and the paper's boxes 1 / 1a / 11 use —
  // with the claim's own captured payer as the fallback. Until 2026-11-21 this
  // screen started from a local "Medicare", so a payer saved at Registration
  // reached the banner, eligibility and the printed paper but not the 277CA or
  // the 835: the student changed the card and the money still came from another
  // plan. One record, one payer, every screen.
  //
  // Build 7: the loose "Claim Submission" panel that carried a second payer
  // picker is gone. The payer is the one on the record and the student changes
  // it at Registration — so the claim, the 277CA and the 835 cannot name
  // different plans.
  const payer = claimPayer(patient, claimForm?.payerName);
  /** What a sentence prints when the chart holds no payer at all. */
  const payerLabel = payer || "the payer on file";

  // A claim that has left draft was submitted — read from the record, never from
  // this screen's memory, so a reload shows the same claim header and the same
  // 277CA (owner's work order, `specs/phase1-data-integrity.md` item 1).
  const transmitted = state.claimStatus !== null && state.claimStatus !== "draft";
  // True while the student has asked to look at the paper again after submitting.
  const [paperOpen, setPaperOpen] = useState(false);
  const [billingScore, setBillingScore] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<BillingTab>(openTab ?? "form");
  // The stepper's stage decides which desk screen is in front of the student.
  useEffect(() => {
    if (openTab) setActiveTab(openTab);
  }, [openTab]);
  // The tab strip is drawn on both billing stages, but the 835 is posted on the
  // payments stage only: Stage 5 is the claim, Stage 6 is posting
  // (spec slice-duplicates-out §3). The stage, not the student, decides — so a
  // student on the claim stage cannot post a remittance from under the paper.
  const postingStage = openTab === "remittance";
  // Prior authorisation — the student's answer, not the app's (STANDING-RULES 6).
  // Tri-state so an unanswered question is visibly unanswered: `null` means the
  // student has not decided yet. This used to be a boolean auto-ticked from
  // `paRecords`, which answered the question before the student read the claim.
  const [needsPriorAuth, setNeedsPriorAuth] = useState<boolean | null>(null);
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routingMemo, setRoutingMemo] = useState("");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitProgress, setTransmitProgress] = useState(0);
  /** The modifier-25 edit check, reported after acceptance as an edit, not an outcome. */
  const [modifierWarning, setModifierWarning] = useState(false);
  /** The supporting calculator drawer — pulled open over the full-width paper. */
  const [calcOpen, setCalcOpen] = useState(false);
  /** The top of the claim paper — where a rejected claim sends the student back to. */
  const formTopRef = useRef<HTMLDivElement | null>(null);

  // Claim scrubber state
  const [scrubResults, setScrubResults] = useState<{ check: string; pass: boolean; note: string }[] | null>(null);

  // ── Claim type — the place of service decides the paper ──────────
  // Phase 3 (owner decision 2026-11-20): the claim type follows the POS. The
  // claim bills at box 24B of its first line, else the POS the encounter was
  // registered at; that POS selects the paper (CMS-1500 / UB-04 / ADA) and the
  // X12 set (837P / 837I / 837D). A stored `claimType` is written from this and
  // never read to choose a paper, so a claim cannot print on a form its place
  // of service does not bill on. A POS that disagrees with the encounter is
  // flagged with the denial it earns — `posCheck.denial` — and left as typed.
  const encounterPos = useEncounterPlaceOfService(patientId || null);
  const encounterDate = useEncounterDateOfService(patientId || null);
  // The provider the visit was booked with. Box 31's signature and box 24J's NPI
  // are that provider's (owner's work order, `specs/phase1-data-integrity.md`
  // item 4), so "Dr. Sarah Lee" books a claim signed by Dr. Sarah Lee; the
  // practice's own address and tax ID stay the practice's.
  const encounterProvider = useEncounterProvider(patientId || null);
  const claimProvider = providerProfileFor(encounterProvider);
  // `savedLinesOf` reads an old-shape record (no array, or rows that are not
  // objects) as an empty list instead of throwing on `.map`.
  const linePositions = savedLinesOf(claimForm).map((line) => line.placeOfService);
  const claimPos =
    linePositions.map((value) => String(value ?? "").trim()).find(Boolean) ||
    String(encounterPos ?? "").trim();
  const posDescription = POS_CODES.find((p) => p.code === claimPos)?.description;
  const posCheck = checkPlaceOfService({
    claimPos,
    encounterPos,
    linePositions,
    posDescription,
    track: patient?.track,
  });
  const paper = posCheck.paper;
  const claimType: ClaimType = paper.claimType;
  /** The principal diagnosis — the first code of the Coder's final list. */
  const principalDiagnosis = principalDiagnosisOf(state.icdCodes, claimForm?.principalDiagnosis);
  /** Box 21's list, in the order the claim actually prints it. */
  const claimDiagnoses = (claimForm?.diagnosisCodes ?? [])
    .map((code) => String(code ?? "").trim())
    .filter(Boolean);
  /** First-listed: code A of box 21 is the principal diagnosis. */
  const principalFirst =
    !principalDiagnosis || claimDiagnoses[0]?.toUpperCase() === principalDiagnosis;

  // The claim's own timeline — every recorded change to this claim, in order.
  // Read-only, and identified by the claim number the engine minted for it.
  const claimEvents = statusEventsFor(state.statusEvents, "claim", state.claimNumber);

  // The 277CA this claim last received — read off the timeline, never stored a
  // second time, so the panel and the timeline can never disagree.
  const ack = useMemo(
    () => ackForClaim(state.statusEvents, state.claimNumber),
    [state.statusEvents, state.claimNumber],
  );

  // The payer's 835 for this claim, once it has been adjudicated — read off the
  // encounter, so a reload shows the same remittance and the same money.
  const remittance = useMemo(
    () => remittanceForClaim(state.remittances, state.claimNumber),
    [state.remittances, state.claimNumber],
  );

  // `demoFillMissingBoxes` (owner decision 2026-11-20) — a claim box with no
  // captured value shows a tagged demo value. Default on; an instructor switches
  // it off so an assessment claim shows only what the student captured.
  const demoFillEnabled = state.demoFillMissingBoxes !== false;

  // ── Structured claim record ──────────────────────────────────────
  // Seeded once from the encounter (demographics, codes, PA number, provider
  // profile). After that the record is the student's: it is persisted with the
  // pipeline, so edits survive a reload.
  //
  // The paper is drawn even when the pipeline carries no patient id — a student
  // who reaches Billing without an attached chart (tutorial prefill, or a
  // coder hand-off from a session with no patient selected) still gets the form
  // filled from the coded encounter and the provider profile. The patient is
  // then resolved from the encounter (`resolveEncounterPatientId`), so boxes
  // 1a–7 fill from the chart the banner above is showing.
  //
  // **Once per patient + encounter (owner report, 2026-11-22).** A chart saved
  // before Phase 1 can reach this desk with a patient on screen that the store
  // cannot scope the claim to — `setClaimForm` refuses (`no-patient` /
  // `no-encounter`, `store/pipelineStore.tsx`) and returns the same state, so
  // the claim never changes. Every later render then seeds again, and React
  // throws "Maximum update depth exceeded" (#185). `seededFor` makes the pass
  // run at most once for a given patient, encounter and set of inputs, whatever
  // the store does with the write; it is a ref, so it survives re-renders and
  // resets only when the chart or the facts being carried actually change.
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    // Data scoping (audit item 5): no patient, no claim. Nothing is seeded and
    // no claim number is minted; the desk below names what is missing.
    if (!patientId) return;
    // Box 23 carries THIS encounter's own authorisation and nothing else
    // (`domain/priorAuthNumber.ts`). Until 2026-11-21 it printed another
    // patient's `PA-2026-004418` as a demo value, and the seeded number was the
    // patient's last PA whatever it authorised. With none of its own the box
    // stays empty and the paper's provenance strip names the stage that fills it.
    const ownPriorAuth = priorAuthForClaim({ paData: state.paData, cptCodes: state.cptCodes });
    // The pass below is skipped when nothing it reads has changed since the last
    // one. Marked before the write, so a refused write is not retried on every
    // render — that retry is the #185 loop.
    const seedKey = claimSeedKey({
      patientId,
      patientFingerprint: identitySeedFor(patient ?? null, state.displayName),
      priorAuth: ownPriorAuth,
      claimType: paper.claimType,
      encounterDate,
      encounterPos,
      encounterProvider,
      codingLines: state.codingLines,
    });
    if (seededFor.current === seedKey) return;
    seededFor.current = seedKey;
    if (!claimForm) {
      setClaimForm(
        buildClaimForm({
          patient: patient ?? null,
          displayName: state.displayName,
          pipeline: state,
          paNumber: ownPriorAuth || undefined,
          claimType: paper.claimType,
          encounterDate,
          placeOfService: encounterPos,
          provider: claimProvider,
        }),
      );
      return;
    }
    // A claim opened before its patient was known — or written by a build that
    // had no patient to seed it — gets the identity boxes filled in place.
    // Codes, charges and anything the student edited are left alone.
    //
    // Old-shape record: a claim saved by an earlier build can arrive with no
    // service-line array, or with rows that are not objects. Every read below
    // goes through this normalised copy, so a stale record is carried forward
    // and repaired instead of throwing on the first `.map`.
    const savedClaim: ClaimFormData = { ...claimForm, serviceLines: savedLinesOf(claimForm) };
    const patch: Partial<ClaimFormData> = {};
    // The type is written from the POS every time it is read, so a claim opened
    // after its place of service changed (or written by a build that let the
    // biller pick a paper) follows the POS instead of the old value.
    patch.claimType = paper.claimType;
    // A claim written by an earlier build carries an invented member ID and
    // group number; clear them so the boxes fall through to the tagged demo.
    Object.assign(patch, stripFabricatedIds(savedClaim));
    // Re-seeded per patient, not once: a patient the student registered
    // themselves gets an id, a DOB and (once Registration runs) an insurance
    // record after this claim may already have been opened. A box the student
    // typed is never overwritten.
    Object.assign(patch, backfillIdentityBoxes(savedClaim, patient, state.displayName));
    Object.assign(patch, reseedIdentityBoxes(savedClaim, patient, state.displayName));
    // The parties agree with each other: box 11 prints N/A for a payer that
    // issues no group number, box 4 prints box 2's name on a SELF claim, and box
    // 13 is box 12's signature (`specs/claim-boxes-agree.md`).
    Object.assign(patch, repairClaimParties(savedClaim, patient, state.displayName));
    // Box 23 fills the moment this encounter has an authorisation of its own — a
    // PA submitted after the claim was opened. A box the student typed is never
    // overwritten, and a number that is not this encounter's is never put there.
    if (ownPriorAuth && !String(savedClaim.priorAuthNumber ?? "").trim()) {
      patch.priorAuthNumber = ownPriorAuth;
    }
    // ── Box 24 and box 28 from the Coder's own lines (audit item 5) ──
    // A claim opened before Coding was finished (or on a paper seeded from a
    // blank encounter) used to read "no charge captured" while Coding held the
    // charge. The coder's charge (24F), units (24G), place of service (24B) and
    // modifiers (24D) are carried onto the claim here, and box 28 is summed from
    // the lines. A value the student typed on the claim is never overwritten.
    const carried = carryCodingIntoClaim(savedClaim, state.codingLines);
    if (carried.changed) {
      patch.serviceLines = carried.form.serviceLines;
      patch.totalCharge = carried.form.totalCharge;
    }
    // ── Box 31 and box 24J: the provider on the appointment ──────────
    // A claim written by an earlier build carries the practice profile's own
    // signature name and NPI on every line. Those are the values this build must
    // stop printing, so they are replaced with the booking provider's; a value
    // the student typed (anything else) is left exactly as typed.
    if (encounterProvider) {
      const currentSignature = String(savedClaim.providerSignature ?? "").trim();
      if (!currentSignature || currentSignature === MEDICAL_PROVIDER_PROFILE.signatureName) {
        patch.providerSignature = claimProvider.signatureName;
      }
      const currentLines = patch.serviceLines ?? savedClaim.serviceLines;
      const relined = currentLines.map((line) => {
        const npi = String(line.renderingNpi ?? "").trim();
        return !npi || npi === MEDICAL_PROVIDER_PROFILE.npi
          ? { ...line, renderingNpi: claimProvider.npi }
          : line;
      });
      if (relined.some((line, i) => line !== currentLines[i])) patch.serviceLines = relined;
    }
    // Only write values that actually differ from what the claim already holds.
    // A helper that re-emits an identical (or undefined) value on every run
    // would otherwise set state, re-run this effect and loop until React
    // throws "Maximum update depth exceeded" (error #185).
    const changed: Record<string, unknown> = {};
    for (const [box, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const current = (savedClaim as unknown as Record<string, unknown>)[box];
      const same =
        current === value ||
        (typeof current === "object" && typeof value === "object"
          ? JSON.stringify(current) === JSON.stringify(value)
          : false);
      if (!same) changed[box] = value;
    }
    if (Object.keys(changed).length > 0) setClaimForm({ ...savedClaim, ...changed });
  }, [patientId, claimForm, patient, state, paRecords, setClaimForm, paper.claimType, encounterDate, encounterPos, encounterProvider]);

  const claimValues = useMemo(() => {
    if (!claimForm) return {};
    const { serviceLines: _lines, ...rest } = { ...claimForm, serviceLines: savedLinesOf(claimForm) };
    return rest as unknown as Record<string, unknown>;
  }, [claimForm]);

  const claimLines = useMemo(
    () => savedLinesOf(claimForm) as unknown as Record<string, unknown>[],
    [claimForm],
  );

  // The payer's prior-authorisation list — the only source for which CPT codes
  // need authorising. Nothing is hardcoded per claim (rule 6/7): the screens
  // below derive the codes from this claim and this list.
  const paCptList = useMemo(
    () => new Set(Object.values(PA_PROCEDURES).flatMap((p) => p.cptCodes)),
    [],
  );
  /** The CPT codes on THIS claim that the payer's PA list names. */
  const claimPaCodes = useMemo(() => {
    const codes = savedLinesOf(claimForm)
      .map((l) => l.cpt)
      .filter(Boolean) as string[];
    return Array.from(new Set(codes.filter((c) => paCptList.has(c))));
  }, [claimForm, paCptList]);

  const commitClaim = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      setClaimForm({
        ...(values as unknown as Omit<ClaimFormData, "serviceLines">),
        serviceLines: lines as unknown as ClaimServiceLine[],
      });
    },
    [setClaimForm],
  );

  // The paper's own edit checks, plus the one rule it cannot see for itself:
  // the principal diagnosis is the first code of the Coder's final list, so it
  // must be first-listed (box 21 A / box 67). Flagged, never reordered.
  const validate = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]): ClaimIssue[] =>
      validateCMS1500(
        {
          ...(values as unknown as Omit<ClaimFormData, "serviceLines">),
          serviceLines: lines as unknown as ClaimServiceLine[],
        },
        { principalDiagnosis },
      ),
    [principalDiagnosis],
  );

  /** Legacy box map, kept so anything still reading `claimData` sees the claim. */
  const legacyBoxMap = (values: Record<string, unknown>): Record<string, string> => {
    const s = (k: string) => String(values[k] ?? "");
    const codes = (values.diagnosisCodes as string[]) ?? [];
    const lines = (values.serviceLines as unknown as ClaimServiceLine[]) ?? savedLinesOf(claimForm);
    return {
      "1": s("insuranceType"),
      "2": s("patientName"),
      "3": s("patientDob"),
      "4": s("insuredName"),
      "5": s("patientAddress"),
      "6": s("patientRelationship"),
      "11": s("insuredPolicyGroup"),
      "11c": s("insuredPlanName"),
      "14": s("currentIllnessDate"),
      "17": s("referringProvider"),
      "21": codes.filter(Boolean).join(", "),
      "22": s("resubmissionCode"),
      "22a": s("originalClaimNumber"),
      "23": s("priorAuthNumber"),
      "24": lines.map((l) => l.cpt).filter(Boolean).join(", "),
      "25": s("federalTaxId"),
      "28": s("totalCharge"),
      "32": s("facilityName"),
      "33": s("billingProviderName"),
    };
  };

  const downloadPdf = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      const name = String(values.patientName ?? "claim").replace(/[^A-Za-z0-9]+/g, "_");
      exportClaimFormPDF({
        layout: CMS1500_LAYOUT,
        values,
        lines,
        columns: CMS1500_PDF_COLUMNS,
        fileName: `CMS1500_${name || "claim"}.pdf`,
        note: DEMO_PROVIDER_NOTE,
      });
    },
    [],
  );

  /** The institutional paper's download — the same layout table the screen draws. */
  const downloadUb04Pdf = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      const name = String(values.patientName ?? "claim").replace(/[^A-Za-z0-9]+/g, "_");
      exportClaimFormPDF({
        layout: UB04_LAYOUT,
        values,
        lines,
        columns: UB04_PDF_COLUMNS,
        fileName: `CLM-0007-UB04_${name || "claim"}.pdf`,
        note: DEMO_PROVIDER_NOTE,
      });
    },
    [],
  );

  /** Submit: edit checks already passed in the shell → run the 837P simulation. */
  const handleSubmitClaim = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      const patientPaRecords = paRecords.filter((r) => r.patientId === patientId);

      // Rule 6 — the PA question belongs to the student. If a line on this claim
      // is on the payer's PA list and the question is unanswered or answered No,
      // the claim cannot go out: the block names the code and what to do.
      const paOnClaim = Array.from(
        new Set(
          lines
            .map((l) => String(l.cpt ?? ""))
            .filter((code) => code && paCptList.has(code)),
        ),
      );
      if (paOnClaim.length > 0 && needsPriorAuth !== true) {
        toast.error(
          `The payer's prior-authorisation list includes CPT ${paOnClaim.join(", ")}, which is on this claim. Answer the PA question before submitting.`,
        );
        return;
      }
      if (needsPriorAuth === true && patientPaRecords.length === 0) {
        toast.error("Prior authorization is required before this claim can be submitted");
        setRole("prior-auth");
        return;
      }

      commitClaim(values, lines);
      const total = Number(values.totalCharge) || 0;
      addAuditLog(patientId, {
        timestamp: new Date().toISOString(),
        role: "biller",
        message: `CMS-1500 submitted to ${payerLabel} — ${lines.length} line(s), $${total.toFixed(2)}`,
        status: "info",
      });

      // Rule 6 — modifier 25 is the student's to apply. The biller's edit check
      // reads the modifiers actually on the claim lines (typed in the Coder
      // stage), never a value the app filled in for them.
      const modifier25Applied =
        lines.some((l) => {
          const raw = l.modifiers;
          const text = Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
          return text
            .split(/[,\s]+/)
            .some((m) => m.replace(/^-/, "").trim() === "25");
        }) || Boolean(cs?.modifier25Applied);
      const missingMod25 = state.cptCodes.length > 1 && !modifier25Applied;

      // What the clearinghouse checks, read from the claim as the student submitted
      // it: box 1a against the coverage record and box 3 against the chart. The
      // outcome shown afterwards is read back off the timeline (`ack`), so a
      // reload shows the same 277CA.
      const submissionFacts = {
        track: "medical" as const,
        claimNumber: state.claimNumber ?? "",
        subscriberId: String(values.insuredId ?? ""),
        subscriberIdOnFile: patient?.insuranceRecord?.primary?.subscriberId?.trim() ?? "",
        patientDob: String(values.patientDob ?? ""),
        patientDobOnFile: patient?.dateOfBirth ?? "",
        alreadyAccepted: state.claimStatus === "accepted",
      };
      const willAccept = evaluateSubmission(submissionFacts, 1, payer).category === "A1";

      setIsTransmitting(true);
      setTransmitProgress(0);
      // The bar is theatre; the transmission itself is one event-handler write when
      // it finishes. Nothing on this screen writes during a render (error #185).
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setTransmitProgress(progress);
        if (progress < 100) return;
        clearInterval(interval);

        transmitClaim({
          subscriberId: submissionFacts.subscriberId,
          subscriberIdOnFile: submissionFacts.subscriberIdOnFile,
          patientDob: submissionFacts.patientDob,
          patientDobOnFile: submissionFacts.patientDobOnFile,
          lineCount: lines.length,
          payerName: payer,
        });
        setIsTransmitting(false);
        setModifierWarning(willAccept && missingMod25);

        if (!willAccept) {
          // A rejection is not a denial: the claim comes back to this desk for
          // correction. It does not advance a stage and no money moves.
          addAuditLog(patientId, {
            timestamp: new Date().toISOString(),
            role: "biller",
            message: `837P transmitted to ${payerLabel} — 277CA rejected, claim returned for correction`,
            status: "error",
          });
          return;
        }

        // Accepted by the clearinghouse. Acceptance is not payment: the payer
        // adjudicates next, and its 835 is what pays or denies the claim.
        setBillingStatus(patientId, "CLEARED_AND_SENT");
        addAuditLog(patientId, {
          timestamp: new Date().toISOString(),
          role: "biller",
          message: `837P transmitted to ${payerLabel} — 277CA accepted, claim with the payer for adjudication`,
          status: "success",
        });
        submitClaim({ ...legacyBoxMap(values), payer, posCode: claimPos, submittedAt: new Date().toISOString() });
        setPaperOpen(false);
        // The modifier-25 trap still costs the student its score; it is not a
        // clearinghouse rejection, so it is reported as an edit check, not an outcome.
        if (!missingMod25) {
          const score = scoreBiller(true, false, false);
          setBillingScore(score);
          updateStageScore(getStudentName(), "biller", score);
        }
      }, 80);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      paRecords,
      patientId,
      patient,
      needsPriorAuth,
      payer,
      claimPos,
      state.cptCodes,
      state.claimNumber,
      state.claimStatus,
      cs?.modifier25Applied,
      claimForm,
      paCptList,
      transmitClaim,
      commitClaim,
      setClaimForm,
    ],
  );

  const runScrubber = () => {
    // Rule 6 — the same-day edit states the rule and the consequence and names
    // no modifier: which modifier belongs on which line is the student's call.
    const dosCounts = new Map<string, number>();
    for (const l of claimLines) {
      const dos = String(l.dateOfService ?? "").trim();
      if (!dos) continue;
      dosCounts.set(dos, (dosCounts.get(dos) ?? 0) + 1);
    }
    const sameDayLines = Math.max(0, ...Array.from(dosCounts.values()));
    const anyModifier = claimLines.some((l) => {
      const raw = l.modifiers;
      return Array.isArray(raw) ? raw.length > 0 : String(raw ?? "").trim() !== "";
    });
    const co236 = CARC_BY_CODE["CO-236"];
    const results = [
      { check: "ICD-10 code present", pass: state.icdCodes.length > 0, note: state.icdCodes.length > 0 ? `${state.icdCodes.length} code(s) found` : "No diagnosis codes entered" },
      { check: "CPT code present", pass: state.cptCodes.length > 0, note: state.cptCodes.length > 0 ? `${state.cptCodes.length} code(s) found` : "No procedure codes entered" },
      { check: "Diagnosis supports procedure", pass: state.icdCodes.length > 0 && state.cptCodes.length > 0, note: "Educational: Verify ICD-10 supports medical necessity for the CPT code" },
      { check: "Payer selected", pass: true, note: `Payer: ${payerLabel}` },
      {
        // The POS decides the paper and the price. A POS that is not the one the
        // encounter was registered at is reported with the denial it earns — the
        // POS itself is never changed (owner decision 2026-11-20).
        check: "Place of service matches the encounter",
        pass: !posCheck.denial,
        note: posCheck.denial
          ? posCheck.denial.message
          : `POS ${posCheck.claimPos || "—"}${posDescription ? ` — ${posDescription}` : ""} on every line and on the encounter. ${
              paper.paper
            } (${paper.x12}).`,
      },
      {
        check: "Principal diagnosis first-listed",
        pass: principalFirst,
        note: principalFirst
          ? `${principalDiagnosis} is code A of box 21 / box 67 on the UB-04.`
          : `The Coder's first code is ${principalDiagnosis || "—"} and the claim lists ${
              claimDiagnoses[0] || "nothing"
            } first. The payer reads the first code as the principal and answers CO-11, diagnosis does not support the procedure. Move ${principalDiagnosis} to A.`,
      },
      {
        check: "Same-day edit (payer claim edit)",
        pass: sameDayLines <= 1,
        note:
          sameDayLines > 1
            ? `${sameDayLines} lines share a date of service. The payer's edit may include one service in another; the remittance would carry ${co236.code} — ${co236.description} — and the line would pay $0. ${
                anyModifier
                  ? "The modifiers on this claim are the ones you typed; the payer decides whether they apply."
                  : "No modifier has been applied to any line."
              }`
            : "One line on each date of service — no same-day edit applies.",
      },
    ];
    setScrubResults(results);
  };

  const simulateDenial = () => {
    handleDenial(`${CARC_BY_CODE["CO-4"].code} — ${CARC_BY_CODE["CO-4"].description}`, {
      amount: calcPayment().billed,
      patientName: state.displayName || (patient ? `${patient.firstName} ${patient.lastName}` : "Unknown"),
    });
    setActiveTab("denials");
  };

  // Estimated payment from the ACTUAL CPT codes chosen in Coding — never a
  // hardcoded flat amount. `medicareRate` in the code set is what Medicare
  // ALLOWS (not a charge), so it is the fee-schedule basis: Medicare pays it in
  // full, commercial payers pay a multiple of it, and the patient carries the
  // standard 20% coinsurance. Paid + patient responsibility = allowed.
  const PAYER_FACTOR: Record<string, number> = {
    Medicare: 1.0,
    "Medicare Part B": 1.0,
    Medicaid: 0.8,
    "Northwind State Medicaid": 1.6,
    "Cascadia Health PPO": 1.5,
    "Meridian Advantage HMO": 1.55,
    "Ridgeline Health Plan": 1.5,
  };
  const calcPayment = () => {
    const factor = PAYER_FACTOR[payer] ?? 1.0;
    const billed = (state.cptCodes || []).reduce((sum, code) => {
      const cpt = CPT_CODES.find((c) => c.code === code);
      return sum + (cpt?.medicareRate ?? 0);
    }, 0);
    const allowed = billed * factor;
    const patient = allowed * 0.2;
    return { billed, allowed, paid: allowed - patient, patient, factor };
  };

  // ── Data scoping (audit item 5) ──────────────────────────────────
  // A claim needs a patient and an encounter. With neither, no claim number is
  // minted and no paper is drawn: the desk says what is missing instead of
  // showing a form whose claim would belong to nobody. `setClaimForm` refuses
  // the same way, so this is the visible half of one rule.
  const claimScope = scopingRefusal({ patientId, encounterId: encounterIdFor(patientId) });

  if (claimScope) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-brand-600" />
            <h2 className="text-sm font-bold text-slate-800">Medical Billing — Enhanced Billing Ledger</h2>
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">Stage 5</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
          <div className="max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-amber-600" aria-hidden="true" />
            <p className="text-sm font-medium text-amber-800">{claimScope.message}</p>
            <p className="mt-1 text-xs text-amber-700">{claimScope.nextStep}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-amber-700">
              No claim was created and no claim number was issued — a claim always belongs to the
              patient and the encounter on screen.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-brand-600" />
          <h2 className="text-sm font-bold text-slate-800">Medical Billing — Enhanced Billing Ledger</h2>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">Stage 5</span>
          <ClaimAckChip ack={ack} />
          {state.claimStatus && state.claimStatus !== "draft" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {CLAIM_STATUS_LABELS[state.claimStatus]}
            </span>
          )}
        </div>
      </div>

      {transmitted && !paperOpen ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-lg rounded-xl border border-brand-200 bg-brand-50 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" aria-hidden="true" />
            <p className="text-sm font-medium text-brand-700">
              Claim {state.claimNumber ?? ""} transmitted — 277CA {ack?.category ?? "A1"}
            </p>
            <p className="mt-1 text-xs text-brand-600">
              The clearinghouse acknowledged the 837P. Nothing has been paid yet: the payer
              adjudicates next, and its 835 is what pays, part-pays or denies the claim.
            </p>
            {ack && <ClaimAckPanel ack={ack} track="medical" className="mt-3 text-left" />}
            {modifierWarning && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-[10px] text-amber-800">
                <strong>Edit check:</strong> a second procedure on the same date of service carries no
                modifier. A clearinghouse does not check modifiers — that is the payer's adjudication,
                which is the next stage. No biller score is awarded while this edit is open.
              </p>
            )}
            {billingScore !== null && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 text-xs">
                <Star className="h-3.5 w-3.5" />
                Biller Score: <strong>{billingScore}/15</strong>
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button onClick={() => setPaperOpen(true)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Back to Billing
              </button>
              {/* The 835 is posted on the payments stage, so this desk only offers
                  it there; on the claim stage the stepper's "Continue to Payments
                  (835)" carries the student on. */}
              {postingStage && (
                <button
                  onClick={() => {
                    setPaperOpen(true);
                    setActiveTab("remittance");
                  }}
                  className="flex min-h-[40px] items-center gap-2 rounded-lg border border-brand-300 px-4 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
                >
                  <Receipt className="h-4 w-4" aria-hidden="true" />
                  {remittance ? "Open the 835 and the ledger" : "Adjudicate the claim"}
                </button>
              )}
              <button
                onClick={() => downloadPdf(claimValues, claimLines)}
                className="flex items-center gap-2 rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
              >
                <FileDown className="h-4 w-4" />
                Download CMS-1500 as PDF
              </button>
              <button onClick={() => setRole("ar-voice")} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
                Proceed to AR Voice
              </button>
            </div>
          </div>
        </div>
      ) : state.status === "coded" || state.status === "billed" || state.status === "paid" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* ─── Left: CMS-1500 Form + Actions ─── */}
          <div
            ref={formTopRef}
            tabIndex={-1}
            aria-label="Claim paper and actions"
            className="flex flex-1 flex-col overflow-y-auto p-4 outline-none"
          >
            {/* Tab navigation */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 pb-2 mb-4">
              {[
                // One scrub control on this screen: the Scrub claim button below.
                // The old scrubber tab drew nothing and sat beside it, so
                // two controls claimed to scrub and one of them did nothing.
                { key: "form" as BillingTab, label: "Claim Form" },
                { key: "remittance" as BillingTab, label: "Remittance & Ledger" },
                { key: "denials" as BillingTab, label: "Denial Codes" },
                { key: "references" as BillingTab, label: "References" },
              ]
                // Stage 5 is the claim, Stage 6 is posting: the remittance tab
                // belongs to the payments stage only.
                .filter((tab) => tab.key !== "remittance" || postingStage)
                .map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-3 py-1.5 text-[10px] font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.key
                      ? "bg-brand-50 text-brand-700 border-b-2 border-brand-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {/* Supporting material opens in a drawer, so the paper keeps the
                  whole width (spec phase-2-layout.md §4). */}
              <button
                type="button"
                onClick={() => setCalcOpen((open) => !open)}
                aria-expanded={calcOpen}
                aria-controls="reimbursement-calculator"
                aria-label="Reimbursement calculator"
                title="Reimbursement calculator"
                className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <DollarSign className="h-3.5 w-3.5" aria-hidden="true" /> Calculator
              </button>
            </div>

            {/* Claim type + the paper it picks */}
            {activeTab === "form" && (
              <div className="space-y-4">
                {/* ─── Claim type — read off the place of service ─── */}
                <div className="clinical-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-slate-700">Claim type</p>
                    <span
                      className="rounded-lg bg-brand-50 px-2 py-1 text-[10px] font-semibold text-brand-700"
                      title={paper.reason}
                    >
                      {CLAIM_TYPE_OPTIONS.find((opt) => opt.value === claimType)?.label ?? claimType}
                    </span>
                    <span className="ml-auto text-[10px] font-medium text-slate-500">
                      Paper: <strong className="text-slate-700">{paper.paper}</strong> ·{" "}
                      <strong className="text-slate-700">{paper.x12}</strong>
                    </span>
                  </div>
                  {/* The POS decides the paper: it is not a picker, and the reason
                      names the place of service the claim actually bills at. */}
                  <p className="mt-1.5 text-[10px] text-slate-500">{paper.reason}.</p>
                  {/* The rule itself, so the student can read why this paper and
                      not another: POS 11 → CMS-1500, POS 21/22/23 → UB-04,
                      dental → ADA J430D. */}
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500" data-testid="claim-paper-rule">
                    <strong className="font-semibold text-slate-600">Rule:</strong> {CLAIM_PAPER_RULE}
                  </p>
                  {/* A POS that is not the encounter's is reported with the denial
                      it would earn. It is never changed for the student. */}
                  {posCheck.denial && (
                    <p
                      role="status"
                      className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] leading-relaxed text-amber-800"
                    >
                      <strong className="font-semibold">
                        {posCheck.denial.carc} ({posCheck.denial.group}) · {posCheck.denial.rarc}
                      </strong>{" "}
                      — {posCheck.denial.message}
                    </p>
                  )}
                  {/* demoFillMissingBoxes — instructor switch */}
                  <label className="mt-2 flex items-start gap-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={demoFillEnabled}
                      onChange={(e) => setDemoFillMissingBoxes(e.target.checked)}
                      className="mt-0.5 h-3 w-3 accent-brand-600"
                    />
                    <span>
                      <span className="font-semibold text-slate-700">Demo-fill missing boxes</span> — a box with
                      nothing captured shows a grey italic value tagged DEMO. It is listed apart from the edit
                      checks and never saved to the claim. Switch off for assessment.
                    </span>
                  </label>
                </div>

                {/* ─── Prior authorisation — the student's own answer ─── */}
                {/* Rule 6. This question and the PA status that answers it used
                    to sit in a loose second claim panel below the paper, which
                    duplicated the claim it belonged to. They now sit once, above
                    the paper, and `handleSubmitClaim` still refuses to transmit a
                    claim carrying a CPT on the payer's PA list until the student
                    has answered — so deleting the panel did not let a claim out
                    with no PA answer. */}
                <div className="clinical-card">
                  <p className="text-xs font-semibold text-slate-700">Prior authorization</p>
                  <fieldset className="mt-2">
                    <legend className="text-[10px] text-slate-600">
                      Does this encounter require <strong>Prior Authorization</strong>?{" "}
                      <span className="text-slate-400">
                        Check the payer's PA list — this answer is yours.
                      </span>
                    </legend>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(
                        [
                          { value: null, label: "Not answered" },
                          { value: true, label: "Yes" },
                          { value: false, label: "No" },
                        ] as { value: boolean | null; label: string }[]
                      ).map((opt) => (
                        <label
                          key={opt.label}
                          className={`flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[10px] font-medium transition-colors ${
                            needsPriorAuth === opt.value
                              ? "border-brand-300 bg-brand-50 text-brand-700"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="needsPA"
                            value={opt.label}
                            checked={needsPriorAuth === opt.value}
                            onChange={() => setNeedsPriorAuth(opt.value)}
                            className="accent-brand-600"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {/* PA Status indicator — this patient's own authorisations. */}
                  {(() => {
                    const patientPaRecords = paRecords.filter((r) => r.patientId === patientId);
                    const approvedPa = patientPaRecords.find((r) => r.status === "approved");
                    const pendingPa = patientPaRecords.find((r) => r.status === "submitted" || r.status === "in-progress" || r.status === "pending");
                    const hasPaRecords = patientPaRecords.length > 0;
                    if (hasPaRecords) {
                      return (
                        <div className={`mt-2 rounded-lg p-2 border ${approvedPa ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                          <p className={`text-[10px] font-medium ${approvedPa ? "text-green-700" : "text-amber-700"}`}>
                            {approvedPa ? (
                              <><CheckCircle2 className="inline h-3 w-3 mr-1" /> Prior Authorization Approved — proceed with billing</>
                            ) : (
                              <><AlertTriangle className="inline h-3 w-3 mr-1" /> PA {pendingPa ? `"${pendingPa.status}" — awaiting approval` : "submitted — awaiting decision"}</>
                            )}
                          </p>
                          {approvedPa?.authEndDate && (() => {
                            const end = new Date(approvedPa.authEndDate);
                            const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            return daysLeft <= 14 ? (
                              <p className="text-[9px] text-amber-600 mt-0.5 flex items-center gap-1">
                                <AlertTriangle className="h-2.5 w-2.5" /> Auth expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                              </p>
                            ) : (
                              <p className="text-[9px] text-green-600 mt-0.5">Auth valid until {end.toLocaleDateString()}</p>
                            );
                          })()}
                        </div>
                      );
                    }
                    if (needsPriorAuth === true) {
                      return (
                        <div className="mt-2 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Prior Authorization Required
                          </p>
                          <p className="mt-1 text-[10px] text-amber-700">You cannot submit this claim until Prior Authorization is completed. Go to Stage 4 to fill the PA form.</p>
                          <button
                            onClick={() => setRole("prior-auth")}
                            className="mt-2 flex min-h-[40px] items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            Go to Prior Auth Portal
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* ─── Professional → CMS-1500 ─── */}
                {claimType === "professional" &&
                  (claimForm ? (
                    <ClaimFormShell
                      formCode="CMS-1500 (02/12)"
                      formTitle="Health Insurance Claim Form"
                      statusLabel={`${state.claimNumber ? `${state.claimNumber} · ` : ""}${
                        CLAIM_STATUS_LABELS[state.claimStatus ?? "draft"]
                      }`}
                      history={(cs?.auditLogs ?? []).map((l) => ({ at: l.timestamp, message: l.message }))}
                      values={claimValues}
                      lines={claimLines}
                      emptyLine={blankServiceLine() as unknown as Record<string, unknown>}
                      maxLines={CMS1500_LAYOUT.maxLines}
                      resetKey={patientId}
                      validate={validate}
                      onCommit={commitClaim}
                      onSubmit={handleSubmitClaim}
                      onDownload={downloadPdf}
                      submitting={isTransmitting}
                      demoFillEnabled={demoFillEnabled}
                    >
                      {(api) => <CMS1500Form {...api} />}
                    </ClaimFormShell>
                  ) : (
                    <div className="empty-state">
                      <p className="empty-title">Preparing the claim form…</p>
                      <p className="empty-hint">The paper is filled from the coded encounter.</p>
                    </div>
                  ))}

                {/* ─── Claim timeline — append-only, never edited ─── */}
                <StatusTimeline
                  events={claimEvents}
                  title="Claim timeline"
                  subject={state.claimNumber}
                  emptyHint="Nothing has happened to this claim yet."
                />

                {/* ─── Institutional → UB-04 (CMS-1450) ─── */}
                {claimType === "institutional" &&
                  (claimForm ? (
                    <ClaimFormShell
                      formCode="UB-04 (CMS-1450)"
                      formTitle="Uniform Bill — institutional claim"
                      statusLabel={`${state.claimNumber ? `${state.claimNumber} · ` : ""}${
                        CLAIM_STATUS_LABELS[state.claimStatus ?? "draft"]
                      }`}
                      history={(cs?.auditLogs ?? []).map((l) => ({ at: l.timestamp, message: l.message }))}
                      values={claimValues}
                      lines={claimLines}
                      emptyLine={blankServiceLine() as unknown as Record<string, unknown>}
                      maxLines={UB04_LAYOUT.maxLines}
                      resetKey={patientId}
                      validate={(values, lines) =>
                        validateUB04(
                          {
                            ...(values as unknown as ClaimFormData),
                            serviceLines: lines as unknown as ClaimServiceLine[],
                          },
                          { principalDiagnosis },
                        )
                      }
                      onCommit={commitClaim}
                      onSubmit={handleSubmitClaim}
                      onDownload={downloadUb04Pdf}
                      submitting={isTransmitting}
                      demoFillEnabled={demoFillEnabled}
                    >
                      {(api) => <Ub04Form {...api} />}
                    </ClaimFormShell>
                  ) : (
                    <div className="empty-state">
                      <p className="empty-title">Preparing the institutional claim…</p>
                      <p className="empty-hint">The paper is filled from the coded encounter.</p>
                    </div>
                  ))}

                {/* ─── Dental → ADA claim (worked in the dental track) ─── */}
                {claimType === "dental" && (
                  <div className="clinical-card">
                    <p className="text-xs font-semibold text-slate-700">
                      ADA Dental Claim (J430D) — dental claim
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                      Dental services bill on the ADA dental claim, with CDT codes, tooth, surface
                      and quadrant. That paper is worked in the Dental track's billing ledger,
                      where the CDT lines live; this medical encounter carries no dental codes to
                      print. Switch to Professional or Institutional to use this claim.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <button onClick={simulateDenial} className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700 hover:bg-red-100">
                    <AlertTriangle className="h-3.5 w-3.5" /> Simulate Denial (Path B)
                  </button>
                  {/* The only scrub control on this screen. */}
                  <button
                    type="button"
                    onClick={runScrubber}
                    aria-label="Scrub claim"
                    className="flex min-h-[40px] items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 text-xs font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    <Search className="h-3.5 w-3.5" aria-hidden="true" /> Scrub claim
                  </button>
                  {/* Phase 3: Route to PA */}
                  {cs?.paStatus === "REQUIRED_MISSING" && (
                    <button onClick={() => setShowRoutingModal(true)} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                      <Route className="h-3.5 w-3.5" /> Route Claim to PA Specialist
                    </button>
                  )}
                </div>

                {/* Transmit Progress Bar */}
                {isTransmitting && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-green-500 transition-all duration-200" style={{ width: `${transmitProgress}%` }} />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">Transmitting 837P... {transmitProgress}%</p>
                  </div>
                )}

                {/* 277CA — a rejection comes back to this desk, not to AR */}
                {ack && ack.category === "A3" && (
                  <ClaimAckPanel
                    ack={ack}
                    track="medical"
                    className="mt-3"
                    onCorrect={() => {
                      setActiveTab("form");
                      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      formTopRef.current?.focus();
                    }}
                  />
                )}

                {/* Phase 3: Routing Modal */}
                {showRoutingModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                      <h3 className="text-sm font-bold text-slate-800">Clearinghouse Exception</h3>
                      {/* Rule 6/7 — never print a code that is not on this claim.
                          The codes come from the claim's own lines, checked
                          against the payer's PA list. */}
                      <p className="mt-1 text-xs text-slate-500">
                        {claimPaCodes.length > 0
                          ? `The payer's prior-authorisation list includes CPT ${claimPaCodes.join(", ")} on this claim. Route to the PA specialist before submitting.`
                          : "This claim is flagged as needing prior authorisation. Route to the PA specialist before submitting."}
                      </p>
                      <div className="mt-4">
                        <label className="text-[11px] font-medium text-slate-500">Internal Routing Instructions / Memo to PA Team</label>
                        <textarea value={routingMemo} onChange={e => setRoutingMemo(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                          rows={3} placeholder="e.g. Patient has chest pain history — rush PA review" />
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button onClick={() => setShowRoutingModal(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                        <button onClick={() => {
                          addRoutingNote(patientId, { timestamp: new Date().toISOString(), fromRole: "biller", toRole: "prior-auth", noteText: routingMemo || "PA required — routing for approval" });
                          setBillingStatus(patientId, "PENDING_PA_ROUTE");
                          setPaStatus(patientId, "PENDING_REVIEW");
                          addAuditLog(patientId, { timestamp: new Date().toISOString(), role: "biller", message: "Routed to PA Specialist — prior authorization required", status: "warning" });
                          setShowRoutingModal(false);
                          setRoutingMemo("");
                        }} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500">
                          Route Claim to PA Specialist
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Scrubber results */}
                {scrubResults && (
                  <div className="clinical-card">
                    <p className="text-xs font-semibold text-slate-700 mb-3">Claim Scrubber Results</p>
                    <div className="space-y-2">
                      {scrubResults.map((r) => (
                        <div key={r.check} className="flex items-start gap-2 text-xs">
                          {r.pass ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                          <div>
                            <span className={`font-medium ${r.pass ? "text-green-700" : "text-red-700"}`}>{r.pass ? "✓" : "✗"} {r.check}</span>
                            <p className="text-[10px] text-slate-500">{r.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Remittance & Ledger — the payer's 835 and the money it posts.
                Drawn on the payments stage only (Stage 6): Stage 5 is the claim. */}
            {activeTab === "remittance" && postingStage && (
              <div className="space-y-3">
                {!state.claimNumber ? (
                  <p className="text-[11px] text-slate-500">
                    No claim exists yet. Open the claim paper first — a remittance is always about a claim
                    the payer has already received.
                  </p>
                ) : ack?.category !== "A1" ? (
                  <p className="text-[11px] text-slate-500">
                    The payer adjudicates only a claim the clearinghouse accepted. This claim's 277CA is{" "}
                    {ack ? ack.category : "not recorded yet"} — a rejection is not a denial: correct the
                    claim and transmit it again before a remittance can exist.
                  </p>
                ) : !remittance ? (
                  <div className="clinical-card">
                    <p className="text-xs font-bold text-slate-800">Payer adjudication</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-600">
                      The claim is accepted and sitting with {payerLabel}. The payer prices every line against the
                      plan's own rules: the contracted allowance, the deductible still to be met, the plan's
                      coinsurance, any authorisation the service required and any edit the plan applies to
                      codes billed together. What it allows becomes the payment, the patient's share and a
                      contractual write-off — and that answer arrives as an 835. Nothing reaches the patient's
                      ledger until you post it.
                    </p>
                    {/* The amber state the old paid-claim screen carried: a claim
                        marked paid with no 835 behind it is not a payment. */}
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[10px] font-medium text-amber-800">No remittance backs this claim</p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-amber-700">
                        No 835 was ever received for it and no money was posted. A payment no remittance
                        explains is not a payment — the ledger shows nothing until an 835 is adjudicated and
                        posted.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => adjudicateClaim({ payerName: payer })}
                      aria-label={`Adjudicate claim ${state.claimNumber} against the plan's rules`}
                      className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[11px] font-semibold text-white hover:bg-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                    >
                      <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                      Adjudicate this claim
                    </button>
                  </div>
                ) : (
                  <>
                    <RemittancePanel remittance={remittance} onPost={postRemittance} />
                    <PatientLedgerPanel
                      entries={state.ledger}
                      remittance={remittance}
                      className="mt-3"
                    />
                    <ArWorkQueuePanel className="mt-3" />
                  </>
                )}
              </div>
            )}

            {/* Denial Code Reference */}
            {activeTab === "denials" && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Denial Code Reference — Educational
                </p>
                {DENIAL_CODES.map((d) => (
                  <div key={d.code} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold text-sm ${
                        d.category === "CO" ? "text-red-600" : d.category === "PR" ? "text-amber-600" : "text-brand-600"
                      }`}>{d.code}</span>
                      <span className="text-slate-500 text-[10px]">({d.category === "CO" ? "Contractual" : d.category === "PR" ? "Patient Responsibility" : "Organizational"})</span>
                    </div>
                    <p className="mt-1 font-medium text-slate-700">{d.description}</p>
                    <p className="mt-0.5 text-slate-500">{d.meaning}</p>
                    <p className="mt-1 text-[10px] text-green-700">💡 Fix: {d.howToFix}</p>
                  </div>
                ))}
              </div>
            )}

            {/* References */}
            {activeTab === "references" && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">
                    CMS-1500 Box Guide — all 33 blocks explained
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {CMS1500_BLOCKS.map((block) => (
                      <div key={block.box} className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px]">
                        <div className="flex items-baseline gap-1.5">
                          <span className="min-w-[36px] font-mono font-bold text-brand-600">Box {block.box}</span>
                          <span className="font-medium text-slate-700">{block.label}</span>
                          {block.autoFilled && (
                            <span className="rounded bg-brand-50 px-1 text-[8px] font-semibold uppercase text-brand-600">auto-filled</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-slate-500">{block.description}</p>
                        {block.commonError && (
                          <p className="mt-0.5 text-[9px] text-red-500">⚠ Common error: {block.commonError}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Place of Service (POS) Codes</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {POS_CODES.map((p) => (
                      <div key={p.code} className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px]">
                        <span className="font-mono font-bold text-slate-600">{p.code}</span>
                        <span className="ml-1.5 text-slate-500">{p.description}</span>
                        <span className="ml-1 text-[8px] text-slate-400">({p.setting})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Revenue Codes (Institutional Claims)</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {UB04_REVENUE_CODES.map((r) => (
                      <div key={r.code} className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px]">
                        <span className="font-mono font-bold text-slate-600">{r.code}</span>
                        <span className="ml-1.5 text-slate-500">{r.teachingDescription}</span>
                        <span className="ml-1 text-[8px] text-slate-400">
                          ({r.appliesTo === "both" ? "all bills" : r.appliesTo})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Supporting material — the reimbursement calculator — sits in a
              drawer the student pulls open and closes, so the paper keeps the
              full workspace width (spec phase-2-layout.md §4). */}
          {calcOpen && (
            <button
              type="button"
              aria-label="Close reimbursement calculator"
              title="Close reimbursement calculator"
              onClick={() => setCalcOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/30"
            />
          )}
          <div
            id="reimbursement-calculator"
            aria-label="Reimbursement calculator"
            aria-hidden={!calcOpen}
            className={
              calcOpen
                ? "fixed inset-y-0 right-0 z-50 flex w-72 max-w-[90vw] flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 shadow-xl"
                : "hidden"
            }
          >
            <div className="flex items-center gap-1.5 mb-3">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[10px] font-semibold text-slate-500">Reimbursement Calculator</span>
              <button
                type="button"
                onClick={() => setCalcOpen(false)}
                aria-label="Close reimbursement calculator"
                title="Close reimbursement calculator"
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="text-[10px] text-slate-400">Fee Schedule</p>
                <p className="text-lg font-bold text-green-600">
                  {calcPayment().billed > 0 ? `$${calcPayment().billed.toFixed(2)}` : "$0.00"}
                </p>
                <p className="text-[10px] text-slate-400">Billed Amount</p>
                {calcPayment().billed === 0 && (
                  <p className="mt-1 text-[9px] text-amber-600">No CPT codes submitted — amount will update after Coding.</p>
                )}
              </div>
              <div className="rounded-lg bg-white p-3 shadow-sm">
                <p className="text-[10px] text-slate-400">Payer Rate</p>
                <p className="text-sm font-bold text-slate-700">{calcPayment().billed > 0 ? `${payerLabel}: pays ${(calcPayment().allowed / calcPayment().billed * 100).toFixed(0)}% of the Medicare fee schedule` : `${payerLabel}: — no codes yet`}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 border border-green-200">
                <p className="text-[10px] text-green-600">Estimated Payment</p>
                <p className="text-lg font-bold text-green-700">${calcPayment().paid.toFixed(2)}</p>
                <p className="text-[10px] text-green-500">Patient responsibility: ${calcPayment().patient.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200">
                <p className="text-[10px] text-amber-600 flex items-center gap-1"><Info className="h-3 w-3" /> Educational</p>
                <p className="text-[10px] text-amber-700">The difference between billed and allowed amounts is a contractual adjustment. Most payers don't pay 100% of charges.</p>
              </div>
            </div>
          </div>
        </div>
      ) : state.status === "denied" ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="max-w-lg rounded-xl border border-red-200 bg-red-50 p-6">
              <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
              <p className="text-sm font-medium text-red-700 text-center">Claim Denied — Routed to AR Queue</p>
              <p className="mt-2 text-xs text-red-600 text-center">{state.denialInfo?.code}</p>
              <div className="mt-4 space-y-2">
                {DENIAL_CODES.filter(d => d.code === "CO-4" || d.code === "CO-50").map((d) => (
                  <div key={d.code} className="rounded-lg bg-white p-3 text-xs">
                    <span className="font-mono font-bold text-red-600">{d.code}</span>
                    <p className="mt-0.5 text-slate-600">{d.description}</p>
                    <p className="mt-1 text-[10px] text-green-700">💡 Fix: {d.howToFix}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="hidden w-64 border-l border-slate-200 bg-slate-50 p-4 lg:block overflow-y-auto">
            <p className="text-xs font-semibold text-slate-700 mb-2">Denial Quick Reference</p>
            <div className="space-y-2">
              {DENIAL_CODES.slice(0, 5).map((d) => (
                <div key={d.code} className="rounded bg-white p-2 text-[10px] border border-slate-200">
                  <span className="font-mono font-bold text-red-500">{d.code}</span>
                  <p className="text-slate-500">{d.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Receipt className="mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400">Waiting for coded encounter...</p>
          <p className="text-xs text-slate-300">Complete coding first</p>
        </div>
      )}
    </div>
  );
}