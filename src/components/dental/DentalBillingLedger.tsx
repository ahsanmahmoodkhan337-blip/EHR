/**
 * DentalBillingLedger.tsx — Dental Biller workspace (ADA J430D-style claim)
 *
 * The paper is the ADA 2019 (J430) replica — all its boxes, auto-filled from
 * the dental case, editable, validated, printable and downloadable — built on
 * the same ClaimFormShell as the medical CMS-1500 (see claims/ClaimFormShell).
 * Below it sits the adjudication trace the payer would walk.
 *
 * Inspired by: dental claim screens in Dentrix / Eaglesoft — the payer header,
 * subscriber / patient / billing-provider blocks, a line-by-line service table,
 * and the adjudication trace the payer would walk. The 12-step walk is produced
 * by `evaluateClaim()` in the data layer (spec §2), and the ordering is
 * load-bearing: it is why a perfectly coded claim can pay nothing at step 11
 * (annual maximum).
 *
 * Teaching guardrails (spec appendix):
 *  - fees labeled illustrative; payers visibly fictional;
 *  - an alternate-benefit downgrade is rendered as "covered at a reduced
 *    allowance", NEVER as a denial;
 *  - a downgraded line is never resolved by billing the downgraded code;
 *  - a denial is only appealable when the payer reason says `appealable` is
 *    true — the appeal outcome is driven by `denial.expectedOutcome`, never by
 *    UI-side guesswork;
 *  - the crown and buildup appeals have **two endings** (owner ruling
 *    2026-11-20, `specs/appeal-then-write-off.md`): the appeal is still the
 *    first action, and the answer to it is decided by the documentation the
 *    student lodges — upheld pays the line, denied needs the contractual
 *    write-off posted, with the patient balance at 0 either way.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Phone,
  ShieldAlert,
  BadgeCheck,
  FileText,
  Gavel,
  Send,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  findCDT,
  findPlan,
  findTooth,
  appealGateFor,
  appealOutcomeFor,
  type DentalAppealOutcome,
  type DentalDenial,
  type DentalPlan,
  type DentalCaseScenario,
  type CoverageResult,
} from "../../data/dental";
import { adjudicateDentalClaim, type TraceStep } from "./adjudication";
import { useDentalTrack, type DentalLineResolution } from "./DentalTrackStore";
import { DentalClaimScrub } from "./DentalClaimScrub";
import { AppealDocumentationChecklist } from "./AppealDocumentationChecklist";
import { ClaimFormShell } from "../claims/ClaimFormShell";
import { ClaimAckChip, ClaimAckPanel } from "../status/ClaimAckPanel";
import { StatusTimeline } from "../status/StatusTimeline";
import { CLAIM_STATUS_LABELS } from "../../domain/claimStatus";
import { ackForClaim, evaluateSubmission } from "../../domain/clearinghouse";
import { statusEventsFor } from "../../domain/statusEvent";
import { ADAForm } from "./ADAForm";
import { CaseAdaClaimPaper } from "./CaseAdaClaimPaper";
import { ADA_LAYOUT, ADA_LINE_COLUMNS, type ADAFormData, type ADAServiceLine } from "../../data/claims/adaLayout";
import { DEMO_PROVIDER_NOTE } from "../../data/claims/providerProfile";
import { buildADAForm } from "../../utils/claimAutoFill";
import { dentalCaseClaimPaper } from "../../domain/dentalCaseClaimPaper";
import { validateADA, type ClaimIssue } from "../../utils/claimValidation";
import { exportClaimFormPDF } from "../../utils/claimFormPdf";
import { toast } from "sonner";


export function DentalBillingLedger({ embedded = false }: { embedded?: boolean } = {}) {
  const { state, activeCase, planId, resolveLine, postContractualWriteOff, adaForm, setAdaForm, submitClaim } =
    useDentalTrack();
  const plan = findPlan(planId);

  const adjudication = useMemo(
    () => adjudicateDentalClaim(state.lines, activeCase),
    [state.lines, activeCase],
  );

  const [openTrace, setOpenTrace] = useState<Record<string, boolean>>({});

  // The claim's own timeline, and the 277CA it last received — both read off the
  // record, so a reload shows the same acknowledgement (money-cycle items 8, 9).
  const claimEvents = useMemo(
    () => statusEventsFor(state.statusEvents, "claim", state.claimNumber),
    [state.statusEvents, state.claimNumber],
  );
  const ack = useMemo(
    () => ackForClaim(state.statusEvents, state.claimNumber),
    [state.statusEvents, state.claimNumber],
  );

  // ── ADA 2019 claim record ──────────────────────────────────────────
  // Seeded once from the case and the CDT lines; after that the student owns
  // it, and it is persisted with the dental track (localStorage v2).
  useEffect(() => {
    if (adaForm) return;
    setAdaForm(
      buildADAForm({
        patient: activeCase?.patient ?? null,
        plan: plan ?? null,
        lines: state.lines.map((l) => ({
          code: l.code,
          tooth: l.tooth,
          surfaces: l.surfaces,
          quadrant: l.quadrant,
          dateOfService: l.dateOfService,
          feeUsd: l.feeUsd,
          description: findCDT(l.code)?.shortName ?? "",
        })),
        predeterminationNumber: state.predeterminationScenarioId ?? "",
      }),
    );
  }, [adaForm, activeCase, plan, state.lines, state.predeterminationScenarioId, setAdaForm]);

  const adaValues = useMemo(() => {
    if (!adaForm) return {};
    const { lines: _lines, ...rest } = adaForm;
    return rest as unknown as Record<string, unknown>;
  }, [adaForm]);

  const adaLines = useMemo(
    () => (adaForm?.lines ?? []) as unknown as Record<string, unknown>[],
    [adaForm],
  );

  const commitAda = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      setAdaForm({
        ...(values as unknown as Omit<ADAFormData, "lines">),
        lines: lines as unknown as ADAServiceLine[],
      });
    },
    [setAdaForm],
  );

  const validate = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]): ClaimIssue[] =>
      validateADA({
        ...(values as unknown as Omit<ADAFormData, "lines">),
        lines: lines as unknown as ADAServiceLine[],
      }),
    [],
  );

  const downloadPdf = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      const name = String(values.patientName ?? "claim").replace(/[^A-Za-z0-9]+/g, "_");
      exportClaimFormPDF({
        layout: ADA_LAYOUT,
        values,
        lines,
        // The same list the on-screen table prints from, so the PDF cannot
        // disagree with the screen about which 837D element a column becomes.
        columns: ADA_LINE_COLUMNS.map((col) => ({
          key: col.key,
          label: col.pdfLabel,
          width: col.width,
          kind: col.kind,
          x12: col.x12,
        })),
        fileName: `ADA_claim_${name || "dental"}.pdf`,
        note: DEMO_PROVIDER_NOTE,
      });
    },
    [],
  );

  const handleSubmitClaim = useCallback(
    (values: Record<string, unknown>, lines: Record<string, unknown>[]) => {
      const patient = activeCase?.patient ?? null;
      // The same pure check the store runs, used only to pick the message. The
      // outcome shown on screen is read back off the timeline (`ack`).
      const accepted =
        evaluateSubmission(
          {
            track: "dental",
            claimNumber: state.claimNumber ?? "",
            subscriberId: String(values.subscriberId ?? ""),
            subscriberIdOnFile: patient?.memberId ?? "",
            patientDob: String(values.patientDob ?? ""),
            patientDobOnFile: patient?.dateOfBirth ?? "",
            alreadyAccepted: state.claimStatus === "accepted",
          },
          1,
          plan?.payerName,
        ).category === "A1";
      submitClaim({
        subscriberId: String(values.subscriberId ?? ""),
        subscriberIdOnFile: patient?.memberId ?? "",
        patientDob: String(values.patientDob ?? ""),
        patientDobOnFile: patient?.dateOfBirth ?? "",
        lineCount: lines.length,
        payerName: plan?.payerName,
      });
      if (accepted) {
        toast.success("837D transmitted — 277CA accepted. The payer adjudicates next; nothing is paid yet.");
      } else {
        toast.error("277CA rejected — the claim comes back for correction. A rejection is not a denial.");
      }
    },
    [submitClaim, state.claimNumber, state.claimStatus, activeCase, plan],
  );

  // Claim-level EOB aggregates, summed from the engine's per-line output only
  // (no benefit maths re-implemented here).
  const eob = useMemo(() => {
    const sum = (fn: (l: (typeof adjudication.lines)[number]) => number) =>
      adjudication.lines.reduce((a, l) => a + fn(l), 0);
    return {
      deductibleApplied: sum((l) => l.result.deductibleAppliedUsd),
      coinsurancePatient: sum((l) => l.result.coinsurancePatientUsd),
      annualMaxReduction: sum((l) => l.result.annualMaxReductionUsd),
    };
  }, [adjudication]);

  return (
    <div className={embedded ? "p-3" : "h-full overflow-y-auto p-3"}>
      {/* ── ADA 2019 claim form replica (shared claim shell) ───────────────── */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-accent-50 px-2 py-0.5 text-[10px] font-medium text-accent-700">
          {plan ? `${plan.payerName} · ${plan.planName}` : "No plan selected"}
        </span>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          Fictional payer · illustrative fees
        </span>
        {state.claimNumber && (
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
            {state.claimNumber}
          </span>
        )}
        <ClaimAckChip ack={ack} />
      </div>

      {adaForm ? (
        <ClaimFormShell
          formCode="ADA 2019 (J430)"
          formTitle="Dental Claim Form"
          statusLabel={
            state.claimNumber
              ? `${state.claimNumber} · ${CLAIM_STATUS_LABELS[state.claimStatus ?? "draft"]}`
              : "Draft"
          }
          history={state.arCallLog.slice(-3).map((e) => ({ at: e.at, message: e.objective }))}
          values={adaValues}
          lines={adaLines}
          emptyLine={{
            dateOfService: new Date().toISOString().slice(0, 10),
            cdt: "",
            description: "",
            tooth: "",
            surface: "",
            quadrant: "",
            fee: 0,
            units: 1,
          }}
          maxLines={ADA_LAYOUT.maxLines}
          resetKey={activeCase?.id ?? "no-case"}
          validate={validate}
          onCommit={commitAda}
          onSubmit={handleSubmitClaim}
          onDownload={downloadPdf}
          accent="accent"
        >
          {(api) =>
            activeCase?.claimPaperFromRecord ? (
              <CaseAdaClaimPaper paper={dentalCaseClaimPaper(activeCase, state.lines)} />
            ) : (
              <ADAForm {...api} />
            )
          }
        </ClaimFormShell>
      ) : (
        <div className="empty-state">
          <p className="empty-title">Preparing the claim form…</p>
          <p className="empty-hint">The paper is filled from the dental case.</p>
        </div>
      )}

      {/* ── 277CA: the clearinghouse's answer, and the claim's own timeline ── */}
      <ClaimAckPanel ack={ack} track="dental" className="mt-2" />
      <StatusTimeline
        events={claimEvents}
        title="Claim timeline"
        subject={state.claimNumber}
        emptyHint="Nothing has happened to this claim yet — transmitting it records Ready, Submitted and the 277CA."
        className="mt-2"
      />

      {/* ── claim lines + trace ──────────────────────────────────────────── */}
      {adjudication.lines.length === 0 && (
        <div className="empty-state mt-4">
          <p className="empty-hint">No claim lines yet — go back to the coder and add CDT lines first.</p>
        </div>
      )}

      {adjudication.lines.map(({ lineId, claimLine, code, result, denial, isDowngrade }) => {
        const cdt = findCDT(code);
        const tooth = claimLine.tooth ? findTooth(claimLine.tooth) : undefined;
        const open = openTrace[lineId] ?? false;
        const downgrade = result.alternateBenefit;
        const resolution = state.lineResolutions[lineId];
        return (
          <div key={lineId} className="mt-3 overflow-hidden clinical-card">
            {/* line row */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{code}</code>
              <span className="text-[11px] font-medium text-slate-700">{cdt?.shortName ?? "Unknown code"}</span>
              {claimLine.tooth && (
                <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] text-teal-700">
                  Tooth #{claimLine.tooth}
                  {claimLine.surfaces ? ` · ${claimLine.surfaces}` : ""}
                  {tooth ? ` (${tooth.name})` : ""}
                </span>
              )}
              {claimLine.quadrant && (
                <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9px] text-teal-700">Area {claimLine.quadrant}</span>
              )}
              <span className="text-[9px] text-slate-400">DOS {claimLine.dateOfService}</span>
              <span className="ml-auto text-[11px] font-semibold text-slate-700">${claimLine.feeUsd.toFixed(2)}</span>
              {resolution && resolution !== "not-handled" && (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  {resolution.replace(/-/g, " ")}
                </span>
              )}
            </div>

            {/* verdict banner — paid / downgraded / denied, with the WHY */}
            <div
              className={`px-3 py-2 text-[11px] font-medium ${
                denial ? "bg-red-50 text-red-900" : isDowngrade ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"
              }`}
            >
              <div className="flex items-center gap-2">
                {denial ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                    <span>{result.summary}</span>
                    <span className="ml-auto shrink-0 rounded bg-white/70 px-1.5 py-0.5 text-[9px] font-semibold">{denial.id}</span>
                  </>
                ) : isDowngrade ? (
                  <>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Covered at a reduced allowance{downgrade ? ` (paid at ${downgrade.paidAtCode})` : ""} — a plan-formula
                      downgrade, <b>not a denial</b>.
                    </span>
                  </>
                ) : (
                  <>
                    <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>Service covered.</span>
                    <span className="opacity-80">
                      Plan pays {fmtUsd(result.planPaysUsd)} · Patient owes {fmtUsd(result.patientOwesUsd)}
                    </span>
                  </>
                )}
              </div>
              <p className="mt-0.5 text-[10px] leading-snug opacity-80">
                {denial
                  ? `Why: ${denial.title} — ${denial.plainLanguage}`
                  : isDowngrade && downgrade
                    ? `Why: ${downgrade.explanation}`
                    : result.blockedAtStep
                      ? `Blocked at step ${result.blockedAtStep}: ${result.blockedReason ?? ""}`
                      : "Why: all plan rules passed for this service."}
              </p>
            </div>

            {/* per-line payment split */}
            <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50 text-center">
              <Split k="Allowed" v={fmtUsd(result.allowedUsd)} />
              <Split k="Write-off" v={fmtUsd(result.contractualWriteOffUsd)} c="text-slate-500" />
              <Split k="Plan pays" v={fmtUsd(result.planPaysUsd)} c="text-emerald-600" />
              <Split k="Patient owes" v={fmtUsd(result.patientOwesUsd)} c="text-red-600" />
            </div>

            {/* per-line EOB drivers — deductible / coinsurance / annual max */}
            {(result.deductibleAppliedUsd > 0 || result.coinsurancePatientUsd > 0 || result.annualMaxReductionUsd > 0) && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[10px] text-slate-600">
                {result.deductibleAppliedUsd > 0 && (
                  <span>
                    Deductible applied <b>{fmtUsd(result.deductibleAppliedUsd)}</b>
                  </span>
                )}
                {result.coinsurancePatientUsd > 0 && (
                  <span>
                    Patient coinsurance <b>{fmtUsd(result.coinsurancePatientUsd)}</b>
                  </span>
                )}
                {result.annualMaxReductionUsd > 0 && (
                  <span className="text-amber-700">
                    Annual-maximum reduction <b>{fmtUsd(result.annualMaxReductionUsd)}</b>
                  </span>
                )}
              </div>
            )}

            {/* downgrade teaching note */}
            {isDowngrade && downgrade && (
              <div className="border-t border-amber-100 bg-amber-50/60 px-3 py-2">
                <p className="text-[10px] font-semibold text-amber-800">Alternate benefit — covered at a reduced allowance</p>
                <p className="text-[10px] text-amber-700">{downgrade.explanation}</p>
                <ol className="ml-4 mt-1 list-decimal text-[10px] text-amber-700">
                  {downgrade.studentAction.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
                <p className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-amber-500">
                  Never bill {downgrade.paidAtCode} in place of the delivered service.
                </p>
              </div>
            )}

            {/* denial detail + appeal */}
            {denial && (
              <div className="border-t border-red-100 bg-red-50/50 px-3 py-2">
                <DenialDetail denial={denial} />
                {denial.appealable && (
                  <DenialAppeal
                    lineId={lineId}
                    denial={denial}
                    result={result}
                    resolution={resolution}
                    appealOutcome={state.appealOutcomes[lineId]}
                    onResolve={resolveLine}
                    onWriteOff={postContractualWriteOff}
                  />
                )}
              </div>
            )}

            {/* trace toggle */}
            <button
              onClick={() => setOpenTrace((o) => ({ ...o, [lineId]: !open }))}
              className="flex w-full items-center gap-1 border-t border-slate-100 px-3 py-1.5 text-left text-[10px] font-semibold text-blue-700 hover:bg-blue-50"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Adjudication trace ({result.steps.length} steps, walked in payer order)
            </button>
            {open && <TraceTable rows={result.steps} />}
          </div>
        );
      })}

      {/* ── EOB / payment summary ─────────────────────────────────────────── */}
      <EobSummary activeCase={activeCase} plan={plan} adjudication={adjudication} eob={eob} />

      {/* ── totals + advance ─────────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-center gap-3 clinical-card p-3">
        <p className="text-xs font-bold text-slate-700">Claim totals</p>
        <Totals k="Charged" v={fmtUsd(adjudication.totals.chargedUsd)} highlight />
        <Totals k="Allowed" v={fmtUsd(adjudication.totals.allowedUsd)} />
        <Totals k="Contractual write-off" v={fmtUsd(adjudication.totals.writeOffUsd)} dim />
        <Totals k="Plan pays" v={fmtUsd(adjudication.totals.planPaysUsd)} green />
        <Totals k="Patient owes" v={fmtUsd(adjudication.totals.patientOwesUsd)} red />
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Edit checks <DentalClaimScrub compact />
        </span>
        <button
          onClick={() =>
            document.getElementById("dental-claim-status")?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
        >
          <Phone className="h-3.5 w-3.5" /> View claim status →
        </button>
      </div>
    </div>
  );
}

// ─── EOB / payment breakdown ────────────────────────────────────────────────

function EobSummary({
  activeCase,
  plan,
  adjudication,
  eob,
}: {
  activeCase: DentalCaseScenario | undefined;
  plan: DentalPlan | undefined;
  adjudication: ReturnType<typeof adjudicateDentalClaim>;
  eob: { deductibleApplied: number; coinsurancePatient: number; annualMaxReduction: number };
}) {
  const remainingBefore = activeCase?.eligibilitySnapshot.remainingAnnualMaximumUsd;
  const deductibleMetBefore = activeCase?.eligibilitySnapshot.deductibleMetUsd ?? 0;
  return (
    <div className="mt-3 clinical-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5 text-slate-400" />
        <p className="text-xs font-bold text-slate-700">Explanation of Benefits (EOB)</p>
        <span className="ml-auto text-[9px] uppercase tracking-wide text-slate-400">Illustrative teaching figures</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {/* deductible */}
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Deductible</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-700">
            {plan ? fmtUsd(plan.deductible.individualUsd) : "—"}{" "}
            <span className="font-normal text-slate-400">individual</span>
          </p>
          <p className="text-[10px] text-slate-500">
            Met before: {fmtUsd(deductibleMetBefore)} · Applied now: <b>{fmtUsd(eob.deductibleApplied)}</b>
          </p>
        </div>

        {/* coinsurance */}
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Coinsurance (patient share)</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-700">{fmtUsd(eob.coinsurancePatient)}</p>
          <p className="text-[10px] text-slate-500">Plan pays the balance at its class rate</p>
        </div>

        {/* annual maximum */}
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-[9px] uppercase tracking-wide text-slate-400">Annual maximum</p>
          <p className="mt-0.5 text-[11px] font-semibold text-slate-700">
            {plan?.annualMaximumUsd != null ? fmtUsd(plan.annualMaximumUsd) : "No limit"}
          </p>
          <p className="text-[10px] text-slate-500">
            Remaining before: {remainingBefore != null ? fmtUsd(remainingBefore) : "—"} · Capped now:{" "}
            <b className={eob.annualMaxReduction > 0 ? "text-amber-700" : ""}>{fmtUsd(eob.annualMaxReduction)}</b>
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
        <EobTotal k="Total charged" v={fmtUsd(adjudication.totals.chargedUsd)} />
        <EobTotal k="Total allowed" v={fmtUsd(adjudication.totals.allowedUsd)} />
        <EobTotal k="Write-off" v={fmtUsd(adjudication.totals.writeOffUsd)} dim />
        <EobTotal k="Plan paid" v={fmtUsd(adjudication.totals.planPaysUsd)} green />
        <EobTotal k="Patient owes" v={fmtUsd(adjudication.totals.patientOwesUsd)} red />
      </div>
    </div>
  );
}

function EobTotal({ k, v, green, red, dim }: { k: string; v: string; green?: boolean; red?: boolean; dim?: boolean }) {
  const color = green ? "text-emerald-600" : red ? "text-red-600" : dim ? "text-slate-400" : "text-slate-700";
  return (
    <span>
      <span className="text-[9px] uppercase tracking-wide text-slate-400">{k} </span>
      <span className={`text-[11px] font-bold tabular-nums ${color}`}>{v}</span>
    </span>
  );
}

// ─── denial appeal flow ─────────────────────────────────────────────────────

function DenialAppeal({
  lineId,
  denial,
  result,
  resolution,
  appealOutcome,
  onResolve,
  onWriteOff,
}: {
  lineId: string;
  denial: DentalDenial;
  result: CoverageResult;
  resolution: DentalLineResolution;
  /** How this line's appeal came back, where the appeal has two endings. */
  appealOutcome?: DentalAppealOutcome;
  onResolve: (lineId: string, r: DentalLineResolution, appealOutcome?: DentalAppealOutcome) => void;
  onWriteOff: (lineId: string, reasonCode?: string) => { posted: boolean; amountUsd: number; reason: string };
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [narrative, setNarrative] = useState("");
  /** The two required items of the documentation gate (`specs/appeal-documentation-gate.md`). */
  const [filmAttached, setFilmAttached] = useState(false);
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<{ rule: string; consequence: string } | null>(null);
  const [writeOffNote, setWriteOffNote] = useState<string | null>(null);

  const winnable = denial.expectedOutcome === "appeal-with-documentation";
  /**
   * The crown and buildup appeals have two endings (owner ruling 2026-11-20,
   * `specs/appeal-then-write-off.md`): upheld pays the line, denied needs the
   * student to post the contractual write-off, patient balance 0.
   */
  const twoStep = denial.appealResolvesTo === "pay-or-write-off";
  const denied = twoStep && appealOutcome === "denied";
  const writeOffPosted = denied && resolution === "write-off";

  const postWriteOff = () => {
    const outcome = onWriteOff(lineId, denial.carc);
    setWriteOffNote(outcome.reason);
  };

  if (!open) {
    return (
      <div className="mt-2 border-t border-red-100 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-500"
          >
            <Gavel className="h-3 w-3" />
            Appeal this denial
          </button>
          {appealOutcome === "upheld" && (
            <span className="text-[10px] font-medium text-emerald-700">
              Appeal upheld — the line paid {fmtUsd(result.allowedUsd)}, patient balance $0.00.
            </span>
          )}
          {denied && !writeOffPosted && (
            <>
              <span className="text-[10px] font-medium text-amber-800">
                Appeal denied — the contractual write-off is still to post.
              </span>
              <button
                onClick={postWriteOff}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-slate-700"
              >
                Post contractual write-off
              </button>
            </>
          )}
          {writeOffPosted && (
            <span className="text-[10px] font-medium text-slate-600">
              Written off contractually — patient balance $0.00.
            </span>
          )}
        </div>
        {writeOffNote && <p className="mt-1 text-[10px] text-slate-600">{writeOffNote}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-red-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <Gavel className="h-4 w-4 text-red-600" />
        <p className="text-[11px] font-bold text-red-800">Appeal flow — {denial.title}</p>
        <button onClick={() => setOpen(false)} className="ml-auto text-[10px] font-medium text-slate-400 hover:text-slate-600">
          Close
        </button>
      </div>

      {/* step indicator */}
      <div className="mt-2 flex gap-1">
        {(["Understand", "Prepare", "Outcome"] as const).map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const active = step === n;
          const done = step > n;
          return (
            <div
              key={label}
              className={`flex-1 rounded px-1.5 py-1 text-center text-[9px] font-semibold ${
                active ? "bg-red-600 text-white" : done ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
              }`}
            >
              {label}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] text-slate-600">
            <b className="text-red-700">Why the payer denied it:</b> {denial.plainLanguage}
          </p>
          <p className="text-[10px] text-slate-600">
            <b className="text-red-700">Why it is appealable:</b> {denial.typicalTrigger}
          </p>
          <button
            onClick={() => setStep(2)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-500"
          >
            Next: prepare the appeal <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-2 space-y-2">
          <p className="text-[10px] font-semibold text-slate-700">Assemble your appeal — gather, in order:</p>
          <ol className="ml-4 list-decimal space-y-1 text-[10px] text-slate-600">
            {denial.correctiveActions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
          <p className="text-[10px] font-semibold text-slate-700">Assemble the appeal:</p>
          {denial.appealEvidence ? (
            <AppealDocumentationChecklist
              idPrefix={`ledger-appeal-${lineId}`}
              denial={denial}
              filmAttached={filmAttached}
              reasonId={reasonId}
              narrative={narrative}
              onFilm={setFilmAttached}
              onReason={setReasonId}
              onNarrative={setNarrative}
              refusal={refusal}
            />
          ) : (
            <label htmlFor={`ledger-narrative-${lineId}`} className="block">
              <span className="text-[10px] font-medium text-slate-600">
                Appeal narrative (what you are telling the payer):
              </span>
              <textarea
                id={`ledger-narrative-${lineId}`}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                rows={3}
                placeholder="Describe the clinical necessity / documentation you are attaching…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-red-300 focus:ring-1 focus:ring-red-300"
              />
            </label>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(1)}
              className="min-h-[40px] rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={() => {
                // The gate comes first: an appeal without the film or a stated
                // reason is refused here and nothing is recorded. The outcome
                // is the payer's answer to a complete lodgement — decided here
                // and only here, after the student has committed.
                const lodgement = { filmAttached, reasonId, narrative };
                const gate = appealGateFor(denial, lodgement);
                if (!gate.complete) {
                  setRefusal({ rule: gate.rule ?? "", consequence: gate.consequence ?? "" });
                  return;
                }
                setRefusal(null);
                const outcome = appealOutcomeFor(denial, lodgement);
                onResolve(lineId, "appealed", outcome ?? undefined);
                setStep(3);
              }}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-500"
            >
              <Send className="h-3 w-3" /> Lodge appeal
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-2 space-y-2">
          {twoStep ? (
            appealOutcome === "denied" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="flex items-start gap-1.5 text-[10px] text-amber-900">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <b>Appeal denied.</b> The payer upheld the original decision — the documentation did not show{" "}
                    {denial.appealEvidence?.label ?? "what the criterion asks for"}. The appeal is not the end of this line:
                    post the contractual write-off. {denial.carc} is a CO adjustment, so the patient balance stays $0.00.
                  </span>
                </p>
                {writeOffPosted ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-[10px] text-emerald-800">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Contractual write-off posted — patient balance <b>$0.00</b>. Never billed to the patient.
                    </span>
                  </p>
                ) : (
                  <button
                    onClick={postWriteOff}
                    className="mt-1.5 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-slate-700"
                  >
                    Post contractual write-off (CO)
                  </button>
                )}
                {writeOffNote && <p className="mt-1 text-[10px] text-slate-700">{writeOffNote}</p>}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                <p className="flex items-start gap-1.5 text-[10px] text-emerald-800">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <b>Appeal upheld.</b> The plan released payment of <b>{fmtUsd(result.allowedUsd)}</b> toward this line.
                    The documentation carried the appeal, and the patient balance stays $0.00.
                  </span>
                </p>
              </div>
            )
          ) : winnable ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
              <p className="flex items-start gap-1.5 text-[10px] text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <b>Appeal approved.</b> The plan released payment of <b>{fmtUsd(result.allowedUsd)}</b> toward this line. The
                  documentation carried the appeal.
                </span>
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
              <p className="flex items-start gap-1.5 text-[10px] text-amber-800">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <b>Appeal denied.</b> The payer upheld the original decision. Handle the balance per the corrective actions above
                  (outcome: <b>{denial.expectedOutcome.replace(/-/g, " ")}</b>).
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── presentational subcomponents ───────────────────────────────────────────

function TraceTable({ rows }: { rows: TraceStep[] }) {
  const badge: Record<TraceStep["verdict"], string> = {
    pass: "bg-emerald-100 text-emerald-700",
    reduced: "bg-amber-100 text-amber-700",
    blocked: "bg-red-100 text-red-700",
    "n/a": "bg-slate-100 text-slate-400",
  };
  return (
    <div className="overflow-x-auto border-t border-slate-100 bg-white px-3 py-2">
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Rule</th>
            <th>Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.step} className="align-top">
              <td className="text-slate-400">{r.step}</td>
              <td>
                <span className="font-medium text-slate-700">{r.rule}</span>
                <span className="block max-w-md leading-snug text-slate-500">{r.explanation}</span>
              </td>
              <td>
                <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${badge[r.verdict]}`}>
                  {r.verdict}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DenialDetail({ denial }: { denial: DentalDenial }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-red-800">
        {denial.title}
        <span className="ml-2 rounded bg-white px-1.5 py-0.5 text-[9px] font-bold ring-1 ring-red-100">
          {denial.carc} · group {denial.groupCode}
        </span>
      </p>
      <p className="text-[10px] text-red-700">{denial.plainLanguage}</p>
      <p className="rounded border border-red-100 bg-white px-2 py-1 font-mono text-[9px] italic text-slate-500">
        “{denial.payerRemark}”
      </p>
      <div>
        <p className="text-[10px] font-semibold text-red-800">
          Corrective actions{" "}
          <span className="font-normal text-slate-400">(in order — {denial.expectedOutcome.replace(/-/g, " ")})</span>
        </p>
        <ol className="ml-4 list-decimal text-[10px] text-slate-700">
          {denial.correctiveActions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Split({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div className="px-2 py-2">
      <p className="text-[9px] uppercase tracking-wide text-slate-400">{k}</p>
      <p className={`text-xs font-bold tabular-nums ${c ?? "text-slate-700"}`}>{v}</p>
    </div>
  );
}

function Totals({ k, v, highlight, green, red, dim }: { k: string; v: string; highlight?: boolean; green?: boolean; red?: boolean; dim?: boolean }) {
  const color = green ? "text-emerald-600" : red ? "text-red-600" : dim ? "text-slate-400" : "text-slate-800";
  return (
    <span className={`rounded-lg px-2 py-1 ${highlight ? "bg-slate-100" : ""}`}>
      <span className={`block text-[9px] uppercase tracking-wide ${dim ? "text-slate-400" : "text-slate-500"}`}>{k}</span>
      <span className={`text-xs font-bold tabular-nums ${color} ${highlight ? "text-base" : ""}`}>{v}</span>
    </span>
  );
}

function fmtUsd(n: number): string {
  return `$${(Math.round(n * 100) / 100).toFixed(2)}`;
}
