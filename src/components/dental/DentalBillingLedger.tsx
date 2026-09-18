/**
 * DentalBillingLedger.tsx — Dental Biller workspace (ADA J430D-style claim)
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
 *    UI-side guesswork.
 */

import { useMemo, useState } from "react";
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
  Building2,
  User,
  Landmark,
} from "lucide-react";
import {
  findCDT,
  findPlan,
  findTooth,
  type DentalDenial,
  type DentalPlan,
  type DentalCaseScenario,
  type CoverageResult,
} from "../../data/dental";
import { adjudicateDentalClaim, type TraceStep } from "./adjudication";
import { useDentalTrack, type DentalLineResolution } from "./DentalTrackStore";

/** Illustrative billing-provider block for the claim form (fictional practice). */
const BILLING_PROVIDER = {
  name: "Healthcare Hustlers Dental",
  npi: "NPI 1234567890",
  tin: "TIN 98-7654321",
  address: "Suite 210, Gulberg III, Lahore, Pakistan",
  phone: "+92 335 0340888",
} as const;

export function DentalBillingLedger() {
  const { state, activeCase, planId, goTo, resolveLine } = useDentalTrack();
  const plan = findPlan(planId);

  const adjudication = useMemo(
    () => adjudicateDentalClaim(state.lines, activeCase),
    [state.lines, activeCase],
  );

  const [openTrace, setOpenTrace] = useState<Record<string, boolean>>({});

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
    <div className="h-full overflow-y-auto p-3">
      {/* ── ADA J430D-style claim form ─────────────────────────────────────── */}
      <ClaimFormHeader activeCase={activeCase} plan={plan} />

      {/* ── claim lines + trace ──────────────────────────────────────────── */}
      {adjudication.lines.length === 0 && (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-400">
          No claim lines yet — go back to the coder and add CDT lines first.
        </p>
      )}

      {adjudication.lines.map(({ lineId, claimLine, code, result, denial, isDowngrade }) => {
        const cdt = findCDT(code);
        const tooth = claimLine.tooth ? findTooth(claimLine.tooth) : undefined;
        const open = openTrace[lineId] ?? false;
        const downgrade = result.alternateBenefit;
        const resolution = state.lineResolutions[lineId];
        return (
          <div key={lineId} className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* line row */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{code}</code>
              <span className="text-[11px] font-medium text-slate-700">{cdt?.shortName ?? "Unknown code"}</span>
              {claimLine.tooth && (
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] text-sky-700">
                  Tooth #{claimLine.tooth}
                  {claimLine.surfaces ? ` · ${claimLine.surfaces}` : ""}
                  {tooth ? ` (${tooth.name})` : ""}
                </span>
              )}
              {claimLine.quadrant && (
                <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[9px] text-sky-700">Area {claimLine.quadrant}</span>
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
                    onResolve={resolveLine}
                  />
                )}
              </div>
            )}

            {/* trace toggle */}
            <button
              onClick={() => setOpenTrace((o) => ({ ...o, [lineId]: !open }))}
              className="flex w-full items-center gap-1 border-t border-slate-100 px-3 py-1.5 text-left text-[10px] font-semibold text-sky-700 hover:bg-sky-50"
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
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="text-xs font-bold text-slate-700">Claim totals</p>
        <Totals k="Charged" v={fmtUsd(adjudication.totals.chargedUsd)} highlight />
        <Totals k="Allowed" v={fmtUsd(adjudication.totals.allowedUsd)} />
        <Totals k="Contractual write-off" v={fmtUsd(adjudication.totals.writeOffUsd)} dim />
        <Totals k="Plan pays" v={fmtUsd(adjudication.totals.planPaysUsd)} green />
        <Totals k="Patient owes" v={fmtUsd(adjudication.totals.patientOwesUsd)} red />
        <button
          onClick={() => goTo("ar")}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
        >
          <Phone className="h-3.5 w-3.5" /> Advance to AR Follow-up →
        </button>
      </div>
    </div>
  );
}

// ─── ADA J430D claim-form header ────────────────────────────────────────────

function ClaimFormHeader({
  activeCase,
  plan,
}: {
  activeCase: DentalCaseScenario | undefined;
  plan: DentalPlan | undefined;
}) {
  const patient = activeCase?.patient;
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">ADA J430D — Dental Claim</p>
          <h3 className="text-sm font-bold text-slate-800">
            {activeCase ? `${activeCase.patient.firstName} ${activeCase.patient.lastName}` : "Dental claim"}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          {plan && (
            <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              {plan.payerName} · {plan.planName}
            </span>
          )}
          <span className="rounded bg-fuchsia-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-fuchsia-600">
            Fictional payer
          </span>
        </div>
      </div>

      {/* four blocks: payer / subscriber / patient / billing provider */}
      <div className="grid grid-cols-1 gap-3 px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <ClaimBlock
          icon={<Landmark className="h-3.5 w-3.5 text-sky-600" />}
          title="Insurance / Plan"
          rows={[
            ["Plan", plan ? `${plan.planName} (${plan.planType})` : "—"],
            ["Payer ID", plan?.payerId ?? "—"],
            ["Group", plan?.groupNumber ?? "—"],
            ["Claims to", plan?.claimsAddress ?? "—"],
          ]}
        />
        <ClaimBlock
          icon={<User className="h-3.5 w-3.5 text-indigo-600" />}
          title="Subscriber"
          rows={[
            ["Name", patient?.subscriberName ?? "—"],
            ["Member ID", patient?.memberId ?? "MEM-000000"],
            ["Relationship", patient ? relationLabel(patient.relationshipToSubscriber) : "—"],
            ["Effective", patient?.coverageEffectiveDate ?? "—"],
          ]}
        />
        <ClaimBlock
          icon={<User className="h-3.5 w-3.5 text-emerald-600" />}
          title="Patient"
          rows={[
            ["Name", patient ? `${patient.firstName} ${patient.lastName}` : "—"],
            ["DOB", patient?.dateOfBirth ?? "—"],
            ["Gender", patient?.gender ?? "—"],
            ["Address", patient?.address ?? "—"],
            ["Phone", patient?.phone ?? "—"],
          ]}
        />
        <ClaimBlock
          icon={<Building2 className="h-3.5 w-3.5 text-slate-500" />}
          title="Billing Provider"
          rows={[
            ["Practice", BILLING_PROVIDER.name],
            ["NPI / TIN", `${BILLING_PROVIDER.npi} · ${BILLING_PROVIDER.tin}`],
            ["Address", BILLING_PROVIDER.address],
            ["Phone", BILLING_PROVIDER.phone],
          ]}
        />
      </div>

      {plan && (
        <p className="border-t border-slate-100 px-3 py-1.5 text-[9px] text-slate-400">
          {plan.teachingSummary} Fees billed are illustrative; the allowance below is a teaching figure.
        </p>
      )}
    </div>
  );
}

function ClaimBlock({
  icon,
  title,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2">
      <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </p>
      <dl className="space-y-0.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <dt className="shrink-0 text-[9px] text-slate-400">{k}</dt>
            <dd className="truncate text-right text-[10px] font-medium text-slate-700">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function relationLabel(r: "self" | "spouse" | "child"): string {
  return r === "self" ? "Self" : r === "spouse" ? "Spouse" : "Child";
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
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
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
  onResolve,
}: {
  lineId: string;
  denial: DentalDenial;
  result: CoverageResult;
  resolution: DentalLineResolution;
  onResolve: (lineId: string, r: DentalLineResolution) => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [narrative, setNarrative] = useState("");
  const [lodged, setLodged] = useState(false);

  const winnable = denial.expectedOutcome === "appeal-with-documentation";

  if (!open) {
    return (
      <div className="mt-2 border-t border-red-100 pt-2">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-500"
        >
          <Gavel className="h-3 w-3" />
          Appeal this denial
        </button>
        {resolution === "appealed" && (
          <span className="ml-2 text-[10px] font-medium text-slate-500">Appeal lodged — outcome recorded below.</span>
        )}
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
          <label className="block">
            <span className="text-[10px] font-medium text-slate-600">Appeal narrative (what you are telling the payer):</span>
            <textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={3}
              placeholder="Describe the clinical necessity / documentation you are attaching…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] outline-none focus:border-red-300 focus:ring-1 focus:ring-red-300"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
            >
              Back
            </button>
            <button
              onClick={() => {
                onResolve(lineId, "appealed");
                setLodged(true);
                setStep(3);
              }}
              disabled={!narrative.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send className="h-3 w-3" /> Lodge appeal
            </button>
          </div>
        </div>
      )}

      {step === 3 && lodged && (
        <div
          className={`mt-2 rounded-lg p-2 ${
            winnable ? "border border-emerald-200 bg-emerald-50" : "border border-amber-200 bg-amber-50"
          }`}
        >
          {winnable ? (
            <p className="flex items-start gap-1.5 text-[10px] text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>Appeal approved.</b> The plan released payment of <b>{fmtUsd(result.allowedUsd)}</b> toward this line. The
                documentation carried the appeal.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-[10px] text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>Appeal denied.</b> The payer upheld the original decision. Handle the balance per the corrective actions above
                (outcome: <b>{denial.expectedOutcome.replace(/-/g, " ")}</b>).
              </span>
            </p>
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
    <div className="border-t border-slate-100 bg-white px-3 py-2">
      <table className="w-full text-left text-[10px]">
        <thead>
          <tr className="text-slate-400">
            <th className="py-1 pr-2 font-semibold">#</th>
            <th className="py-1 pr-2 font-semibold">Rule</th>
            <th className="py-1 pr-2 font-semibold">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.step} className="align-top">
              <td className="py-1 pr-2 text-slate-400">{r.step}</td>
              <td className="py-1 pr-2">
                <span className="font-medium text-slate-700">{r.rule}</span>
                <span className="block max-w-md leading-snug text-slate-500">{r.explanation}</span>
              </td>
              <td className="py-1 pr-2">
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
          CARC {denial.carc} · Group {denial.groupCode}
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
