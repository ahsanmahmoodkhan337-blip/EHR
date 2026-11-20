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

import { useState, useEffect, useMemo, useCallback } from "react";
import { Receipt, AlertTriangle, CheckCircle2, XCircle, Search, DollarSign, BookOpen, Info, Route, Star, Shield, FileDown } from "lucide-react";
import { usePipeline, type ClaimFormData, type ClaimServiceLine } from "../../store/pipelineStore";
import { usePatientStore } from "../../store/patientStore";
import { CMS1500_BLOCKS, REVENUE_CODES, POS_CODES } from "./claimData";
import { CARC_BY_CODE, CARC_CODES as DENIAL_CODES } from "../../data/claims/carc";
import { CPT_CODES } from "../CodingQueue/cptData";
import { exportClaimFormPDF } from "../../utils/claimFormPdf";
import { scoreBiller, updateStageScore, getStudentName } from "../../utils/scoring";
import { ClaimFormShell } from "../claims/ClaimFormShell";
import { StatusTimeline } from "../status/StatusTimeline";
import { statusEventsFor } from "../../domain/statusEvent";
import { CMS1500Form } from "./CMS1500Form";
import { CMS1500_LAYOUT } from "../../data/claims/cms1500Layout";
import { DEMO_PROVIDER_NOTE } from "../../data/claims/providerProfile";
import { buildClaimForm, blankServiceLine, backfillIdentityBoxes, reseedIdentityBoxes, stripFabricatedIds } from "../../utils/claimAutoFill";
import { validateCMS1500, type ClaimIssue } from "../../utils/claimValidation";
import {
  useEncounterPatientId,
  useEncounterPlaceOfService,
  useEncounterDateOfService,
} from "../../utils/encounterPatient";
import {
  CLAIM_TYPE_OPTIONS,
  CLAIM_TYPE_PAPER,
  suggestClaimType,
  type ClaimType,
} from "../../data/claims/claimType";
import { toast } from "sonner";

type BillingTab = "form" | "scrubber" | "denials" | "references";

/** Column spec for the box-24 table in the downloaded PDF. */
const CMS1500_PDF_COLUMNS = [
  { key: "dateOfService", label: "24A DATE(S)", width: 0.15, kind: "date" as const },
  { key: "placeOfService", label: "24B POS", width: 0.09, kind: "text" as const },
  { key: "cpt", label: "24D CPT", width: 0.13, kind: "text" as const },
  { key: "modifiers", label: "24D MOD", width: 0.12, kind: "text" as const },
  { key: "diagnosisPointer", label: "24E PTR", width: 0.1, kind: "text" as const },
  { key: "charge", label: "24F CHARGE", width: 0.13, kind: "money" as const },
  { key: "units", label: "24G UNITS", width: 0.08, kind: "number" as const },
  { key: "renderingNpi", label: "24J NPI", width: 0.2, kind: "text" as const },
];

export function BillingLedger() {
  const { state, submitClaim, handleDenial, setRole, paRecords, setClaimForm, setDemoFillMissingBoxes } = usePipeline();
  const claimForm = state.claimForm;
  const { caseStates, setBillingStatus, setPaStatus, addRoutingNote, addAuditLog, getPatientById } = usePatientStore();
  // The encounter knows its patient even when the pipeline's nullable
  // `patientId` does not — a restored session or the Coder's "Skip to Billing"
  // path can reach this screen with it unset, which left boxes 1a, 2, 3, 4, 5,
  // 6 and 7 blank on the paper.
  const patientId = useEncounterPatientId(state.patientId) || "";
  const patient = patientId ? getPatientById(patientId) : undefined;
  const cs = patientId ? caseStates[patientId] : undefined;

  const [payer, setPayer] = useState("Medicare");
  const [posCode, setPosCode] = useState("11");
  const [submitted, setSubmitted] = useState(false);
  const [billingScore, setBillingScore] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<BillingTab>("form");
  const [needsPriorAuth, setNeedsPriorAuth] = useState(false);

  // Auto-check the PA checkbox when PA records exist for this patient
  useEffect(() => {
    const patientPaRecords = paRecords.filter((r) => r.patientId === patientId);
    if (patientPaRecords.length > 0) {
      setNeedsPriorAuth(true);
    }
  }, [paRecords, patientId]);
  const [showRoutingModal, setShowRoutingModal] = useState(false);
  const [routingMemo, setRoutingMemo] = useState("");
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [transmitProgress, setTransmitProgress] = useState(0);
  const [transmitResult, setTransmitResult] = useState<"paid" | "denied" | null>(null);

  // Claim scrubber state
  const [scrubResults, setScrubResults] = useState<{ check: string; pass: boolean; note: string }[] | null>(null);

  // ── Claim type — which paper this claim is submitted on ──────────
  // Suggested from the encounter: the first service line's place of service
  // (the biller can edit it), then the encounter's registered POS, then the
  // scrubber's field. The biller can override; the choice is stored on the
  // claim, so reopening it shows the same paper.
  const encounterPos = useEncounterPlaceOfService(patientId || null);
  const encounterDate = useEncounterDateOfService(patientId || null);
  const primaryPos =
    claimForm?.serviceLines?.[0]?.placeOfService || encounterPos || posCode || "11";
  const suggestion = suggestClaimType({
    placeOfService: primaryPos,
    posDescription: POS_CODES.find((p) => p.code === primaryPos)?.description,
    track: patient?.track,
  });
  const claimType: ClaimType = claimForm?.claimType ?? suggestion.claimType;

  // The claim's own timeline — every recorded change to this claim, in order.
  // Read-only, and identified by the claim number the engine minted for it.
  const claimEvents = statusEventsFor(state.statusEvents, "claim", state.claimNumber);

  // `demoFillMissingBoxes` (owner decision 2026-11-20) — a claim box with no
  // captured value shows a tagged demo value. Default on; an instructor switches
  // it off so an assessment claim shows only what the student captured.
  const demoFillEnabled = state.demoFillMissingBoxes !== false;

  const setClaimType = (next: ClaimType) => {
    if (!claimForm) return;
    setClaimForm({ ...claimForm, claimType: next });
  };

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
  useEffect(() => {
    if (!claimForm) {
      const paNumber = patientId
        ? paRecords.filter((r) => r.patientId === patientId).slice(-1)[0]?.id
        : undefined;
      setClaimForm(
        buildClaimForm({
          patient: patient ?? null,
          displayName: state.displayName,
          pipeline: state,
          paNumber,
          claimType: suggestion.claimType,
          encounterDate,
        }),
      );
      return;
    }
    // A claim opened before its patient was known — or written by a build that
    // had no patient to seed it — gets the identity boxes filled in place.
    // Codes, charges and anything the student edited are left alone.
    const patch: Partial<ClaimFormData> = {};
    if (!claimForm.claimType) patch.claimType = suggestion.claimType;
    // A claim written by an earlier build carries an invented member ID and
    // group number; clear them so the boxes fall through to the tagged demo.
    Object.assign(patch, stripFabricatedIds(claimForm));
    // Re-seeded per patient, not once: a patient the student registered
    // themselves gets an id, a DOB and (once Registration runs) an insurance
    // record after this claim may already have been opened. A box the student
    // typed is never overwritten.
    Object.assign(patch, backfillIdentityBoxes(claimForm, patient, state.displayName));
    Object.assign(patch, reseedIdentityBoxes(claimForm, patient, state.displayName));
    // Only write values that actually differ from what the claim already holds.
    // A helper that re-emits an identical (or undefined) value on every run
    // would otherwise set state, re-run this effect and loop until React
    // throws "Maximum update depth exceeded" (error #185).
    const changed: Record<string, unknown> = {};
    for (const [box, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      const current = (claimForm as unknown as Record<string, unknown>)[box];
      const same =
        current === value ||
        (typeof current === "object" && typeof value === "object"
          ? JSON.stringify(current) === JSON.stringify(value)
          : false);
      if (!same) changed[box] = value;
    }
    if (Object.keys(changed).length > 0) setClaimForm({ ...claimForm, ...changed });
  }, [patientId, claimForm, patient, state, paRecords, setClaimForm, suggestion.claimType, encounterDate]);

  const claimValues = useMemo(() => {
    if (!claimForm) return {};
    const { serviceLines: _lines, ...rest } = claimForm;
    return rest as unknown as Record<string, unknown>;
  }, [claimForm]);

  const claimLines = useMemo(
    () => (claimForm?.serviceLines ?? []) as unknown as Record<string, unknown>[],
    [claimForm],
  );

  const commitClaim = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      setClaimForm({
        ...(values as unknown as Omit<ClaimFormData, "serviceLines">),
        serviceLines: lines as unknown as ClaimServiceLine[],
      });
    },
    [setClaimForm],
  );

  const validate = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]): ClaimIssue[] =>
      validateCMS1500({
        ...(values as unknown as Omit<ClaimFormData, "serviceLines">),
        serviceLines: lines as unknown as ClaimServiceLine[],
      }),
    [],
  );

  /** Legacy box map, kept so anything still reading `claimData` sees the claim. */
  const legacyBoxMap = (values: Record<string, unknown>): Record<string, string> => {
    const s = (k: string) => String(values[k] ?? "");
    const codes = (values.diagnosisCodes as string[]) ?? [];
    const lines = (values.serviceLines as unknown as ClaimServiceLine[]) ?? claimForm?.serviceLines ?? [];
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

  /** Submit: edit checks already passed in the shell → run the 837P simulation. */
  const handleSubmitClaim = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      const patientPaRecords = paRecords.filter((r) => r.patientId === patientId);
      if (needsPriorAuth && patientPaRecords.length === 0) {
        toast.error("Prior authorization is required before this claim can be submitted");
        setRole("prior-auth");
        return;
      }

      commitClaim(values, lines);
      const total = Number(values.totalCharge) || 0;
      addAuditLog(patientId, {
        timestamp: new Date().toISOString(),
        role: "biller",
        message: `CMS-1500 submitted to ${payer} — ${lines.length} line(s), $${total.toFixed(2)}`,
        status: "info",
      });

      const missingMod25 = state.cptCodes.length > 1 && !cs?.modifier25Applied;
      setIsTransmitting(true);
      setTransmitProgress(0);
      setTransmitResult(null);
      const interval = setInterval(() => {
        setTransmitProgress((p) => {
          if (p >= 100) {
            clearInterval(interval);
            setTransmitResult(missingMod25 ? "denied" : "paid");
            setIsTransmitting(false);
            if (missingMod25) {
              setBillingStatus(patientId, "DRAFT");
              addAuditLog(patientId, {
                timestamp: new Date().toISOString(),
                role: "biller",
                message: "837P transmitted — Modifier 25 missing, claim denied",
                status: "error",
              });
            } else {
              setBillingStatus(patientId, "CLEARED_AND_SENT");
              addAuditLog(patientId, {
                timestamp: new Date().toISOString(),
                role: "biller",
                message: "837P transmitted successfully — claim paid",
                status: "success",
              });
              submitClaim({ ...legacyBoxMap(values), payer, posCode, submittedAt: new Date().toISOString() });
              setSubmitted(true);
              const score = scoreBiller(true, false, false);
              setBillingScore(score);
              updateStageScore(getStudentName(), "biller", score);
            }
            return 100;
          }
          return p + 5;
        });
      }, 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paRecords, patientId, needsPriorAuth, payer, posCode, state.cptCodes, cs?.modifier25Applied, claimForm],
  );

  const runScrubber = () => {
    const results = [
      { check: "ICD-10 code present", pass: state.icdCodes.length > 0, note: state.icdCodes.length > 0 ? `${state.icdCodes.length} code(s) found` : "No diagnosis codes entered" },
      { check: "CPT code present", pass: state.cptCodes.length > 0, note: state.cptCodes.length > 0 ? `${state.cptCodes.length} code(s) found` : "No procedure codes entered" },
      { check: "Diagnosis supports procedure", pass: state.icdCodes.length > 0 && state.cptCodes.length > 0, note: "Educational: Verify ICD-10 supports medical necessity for the CPT code" },
      { check: "Payer selected", pass: true, note: `Payer: ${payer}` },
      { check: "Place of service selected", pass: true, note: `POS: ${posCode}` },
      { check: "Modifier check", pass: state.cptCodes.length <= 1, note: state.cptCodes.length > 1 ? "Multiple procedures may need modifier -25 or -59" : "Single procedure — no modifier needed" },
    ];
    setScrubResults(results);
  };

  const simulateDenial = () => {
    handleDenial(`${CARC_BY_CODE["CO-16"].code} — ${CARC_BY_CODE["CO-16"].description}`, {
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
    Medicaid: 0.8,
    "Blue Cross": 1.6,
    "United Healthcare": 1.5,
    Aetna: 1.55,
    Cigna: 1.5,
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-brand-600" />
          <h2 className="text-sm font-bold text-slate-800">Medical Billing — Enhanced Billing Ledger</h2>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-700">Stage 3</span>
        </div>
      </div>

      {submitted ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md rounded-xl border border-brand-200 bg-brand-50 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm font-medium text-brand-700">Claim Submitted Successfully!</p>
            <p className="mt-2 text-xs text-brand-600">
              The claim has been submitted to the payer.
              {state.icdCodes?.some(c => c.startsWith('Z') || c.startsWith('S') || c.startsWith('M'))
                ? ' This encounter may require Prior Authorization. Please proceed to the Prior Auth stage to verify.'
                : ' No prior authorization is needed for this encounter. The claim has been processed.'}
            </p>
            {billingScore !== null && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5 text-xs">
                <Star className="h-3.5 w-3.5" />
                Biller Score: <strong>{billingScore}/15</strong>
              </div>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={() => setSubmitted(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Back to Billing
              </button>
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
      ) : state.status === "coded" || state.status === "billed" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* ─── Left: CMS-1500 Form + Actions ─── */}
          <div className="flex flex-1 flex-col overflow-y-auto p-4">
            {/* Tab navigation */}
            <div className="flex gap-1 border-b border-slate-200 pb-2 mb-4">
              {[
                { key: "form" as BillingTab, label: "Claim Form" },
                { key: "scrubber" as BillingTab, label: "Claim Scrubber" },
                { key: "denials" as BillingTab, label: "Denial Codes" },
                { key: "references" as BillingTab, label: "References" },
              ].map((tab) => (
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
            </div>

            {/* Claim type + the paper it picks */}
            {activeTab === "form" && (
              <div className="space-y-4">
                {/* ─── Claim type ─── */}
                <div className="clinical-card">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-slate-700">Claim type</p>
                    <div className="flex overflow-hidden rounded-lg border border-slate-200">
                      {CLAIM_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setClaimType(opt.value)}
                          disabled={!claimForm}
                          title={`${opt.hint} Prints on ${opt.paper}.`}
                          className={`px-2.5 py-1 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            claimType === opt.value
                              ? "bg-brand-600 text-white"
                              : "bg-white text-slate-500 hover:bg-slate-50"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <span className="ml-auto text-[10px] font-medium text-slate-500">
                      Paper: <strong className="text-slate-700">{CLAIM_TYPE_PAPER[claimType]}</strong>
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-slate-500">
                    {claimType === suggestion.claimType
                      ? `Suggested from the encounter — ${suggestion.reason}.`
                      : `Set by hand — the encounter suggests ${CLAIM_TYPE_PAPER[suggestion.claimType]} (${suggestion.reason}).`}
                    {claimType !== suggestion.claimType && (
                      <button
                        onClick={() => setClaimType(suggestion.claimType)}
                        className="ml-1 font-medium text-brand-600 underline"
                      >
                        Use the suggestion
                      </button>
                    )}
                  </p>
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

                {/* ─── Professional → CMS-1500 ─── */}
                {claimType === "professional" &&
                  (claimForm ? (
                    <ClaimFormShell
                      formCode="CMS-1500 (02/12)"
                      formTitle="Health Insurance Claim Form"
                      statusLabel={`${state.claimNumber ? `${state.claimNumber} · ` : ""}${
                        transmitResult === "paid"
                          ? "Accepted — paid"
                          : transmitResult === "denied"
                            ? "Rejected — CO-16"
                            : "Draft"
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

                {/* ─── Institutional → UB-04 (paper still to come) ─── */}
                {claimType === "institutional" && (
                  <div className="clinical-card">
                    <p className="text-xs font-semibold text-slate-700">
                      UB-04 (CMS-1450) — institutional claim
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                      {suggestion.reason}. The claim record already carries the type, the patient,
                      the service dates and the charges, so this claim will print on the UB-04 as
                      soon as that paper lands. Nothing here is lost — switch back to Professional
                      to work it on the CMS-1500 in the meantime.
                    </p>
                    {claimForm && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                        <div>
                          <dt className="text-slate-400">Patient</dt>
                          <dd className="font-medium text-slate-700">{claimForm.patientName || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Account / MRN</dt>
                          <dd className="font-medium text-slate-700">{claimForm.patientAccountNumber || "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Service dates</dt>
                          <dd className="font-medium text-slate-700">
                            {claimForm.serviceLines[0]?.dateOfService || "—"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-400">Total charges</dt>
                          <dd className="font-medium text-slate-700 tabular-nums">
                            ${(claimForm.totalCharge || 0).toFixed(2)}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                )}

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

                {/* Claim entry form */}
                <div className="clinical-card">
                  <p className="text-xs font-semibold text-slate-700 mb-3">Claim Submission</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500">Payer</label>
                      <select value={payer} onChange={(e) => setPayer(e.target.value)} className="w-full rounded border border-slate-200 px-2 py-1.5 text-xs">
                        <option>Medicare</option><option>Medicaid</option><option>Blue Cross</option>
                        <option>United Healthcare</option><option>Aetna</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="posCodeInput" className="text-[10px] text-slate-500">Place of Service</label>
                      <input
                        id="posCodeInput"
                        type="text"
                        value={posCode}
                        onChange={(e) => setPosCode(e.target.value)}
                        placeholder="11"
                        className="w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-xs outline-none focus:border-brand-500"
                      />
                      <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5">
                        {POS_CODES.map((p) => (
                          <span key={p.code} className="text-[8px] text-slate-400">
                            <span className="font-mono font-semibold">{p.code}</span> {p.description}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400">
                    ICD-10: {state.icdCodes.join(", ") || "—"} &nbsp;|&nbsp; CPT: {state.cptCodes.join(", ") || "—"}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="checkbox" id="needsPA" checked={needsPriorAuth} onChange={e => setNeedsPriorAuth(e.target.checked)} className="accent-brand-600" />
                    <label htmlFor="needsPA" className="text-[10px] text-slate-600">This encounter requires <strong>Prior Authorization</strong></label>
                  </div>
                  {/* PA Status indicator */}
                  {(() => {
                    const patientPaRecords = paRecords.filter((r) => r.patientId === (state.patientId || ""));
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
                    if (needsPriorAuth) {
                      return (
                        <div className="mt-2 rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
                          <p className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Prior Authorization Required
                          </p>
                          <p className="mt-1 text-[10px] text-amber-700">You cannot submit this claim until Prior Authorization is completed. Go to Stage 4 to fill the PA form.</p>
                          <button
                            onClick={() => setRole("prior-auth")}
                            className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-500 transition-colors"
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

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <button onClick={simulateDenial} className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700 hover:bg-red-100">
                    <AlertTriangle className="h-3.5 w-3.5" /> Simulate Denial (Path B)
                  </button>
                  <button onClick={runScrubber} className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                    <Search className="h-3.5 w-3.5" /> Run Clearinghouse Scrubber
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

                {/* Transmit Result */}
                {transmitResult === "paid" && (
                  <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="flex items-center gap-1 text-xs font-medium text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 837P Transmitted — Claim Paid
                    </p>
                  </div>
                )}
                {transmitResult === "denied" && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                    <p className="flex items-center gap-1 text-xs font-medium text-red-700">
                      <XCircle className="h-3.5 w-3.5" /> Modifier 25 Missing — Claim Denied (CO-16)
                    </p>
                    <p className="mt-1 text-[10px] text-red-600">Route to AR for remediation.</p>
                  </div>
                )}

                {/* Phase 3: Routing Modal */}
                {showRoutingModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                      <h3 className="text-sm font-bold text-slate-800">Clearinghouse Exception</h3>
                      <p className="mt-1 text-xs text-slate-500">Prior Authorization is required for CPT 78452. Route to PA specialist before submitting.</p>
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
                    {REVENUE_CODES.map((r) => (
                      <div key={r.code} className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px]">
                        <span className="font-mono font-bold text-slate-600">{r.code}</span>
                        <span className="ml-1.5 text-slate-500">{r.description}</span>
                        <span className="ml-1 text-[8px] text-slate-400">({r.type})</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── Right: Reimbursement Calculator ─── */}
          <div className="hidden w-64 border-l border-slate-200 bg-slate-50 p-4 lg:block overflow-y-auto">
            <div className="flex items-center gap-1.5 mb-3">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[10px] font-semibold text-slate-500">Reimbursement Calculator</span>
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
                <p className="text-sm font-bold text-slate-700">{calcPayment().billed > 0 ? `${payer}: pays ${(calcPayment().allowed / calcPayment().billed * 100).toFixed(0)}% of the Medicare fee schedule` : `${payer}: — no codes yet`}</p>
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
      ) : state.status === "paid" ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="max-w-md rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm font-medium text-green-700">Claim Submitted & Paid — ERA Summary</p>
            <div className="mt-4 space-y-2 text-left text-xs">
              <div className="flex justify-between border-b border-green-200 pb-1"><span className="text-green-600">Billed Amount:</span><span className="font-medium text-green-800">${calcPayment().billed.toFixed(2)}</span></div>
              <div className="flex justify-between border-b border-green-200 pb-1"><span className="text-green-600">Allowed Amount:</span><span className="font-medium text-green-800">${calcPayment().allowed.toFixed(2)}</span></div>
              <div className="flex justify-between border-b border-green-200 pb-1"><span className="text-green-600">Paid Amount:</span><span className="font-bold text-green-800">${calcPayment().paid.toFixed(2)}</span></div>
              <div className="flex justify-between border-b border-green-200 pb-1"><span className="text-green-600">Patient Responsibility:</span><span className="font-medium text-green-800">${calcPayment().patient.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-green-600">Contractual Adjustment:</span><span className="font-medium text-green-800">${(calcPayment().billed - calcPayment().allowed).toFixed(2)}</span></div>
            </div>
            <p className="mt-4 text-[10px] text-green-500">This is an Electronic Remittance Advice (ERA) — it shows what the insurance paid vs what was billed. The difference is the contractual adjustment per your payer agreement.</p>
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
                {DENIAL_CODES.filter(d => d.code === "CO-16" || d.code === "CO-50").map((d) => (
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