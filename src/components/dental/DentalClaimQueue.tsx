/**
 * DentalClaimQueue.tsx — Claim status queue (Dentrix Claims / Eaglesoft queue)
 *
 * Inspired by: the Dentrix Claim Tracking / Open Dental Claim queue, where a
 * practice watches each claim move through a lifecycle: created → sent →
 * pending/adjudicated → paid / denied / appealed / resubmitted. This is a read
 * of the dental track state and `adjudicateDentalClaim()` — it never mutates
 * adjudication results.
 */

import { useMemo } from "react";
import { CheckCircle2, Clock, FileText, Send, AlertTriangle, RotateCcw, Phone, User, ArrowRight } from "lucide-react";
import { ERA_REMITTANCES, findCDT, findDenial } from "../../data/dental";
import { useDentalTrack, type DentalLineResolution } from "./DentalTrackStore";
import { adjudicateDentalClaim } from "./adjudication";
import { DentalEraRemittance } from "./DentalEraRemittance";

type ClaimStage = "created" | "sent" | "pending" | "settled";

const STEPS: { id: ClaimStage; label: string; icon: React.ReactNode }[] = [
  { id: "created", label: "Created", icon: <FileText className="h-3.5 w-3.5" /> },
  { id: "sent", label: "Sent", icon: <Send className="h-3.5 w-3.5" /> },
  { id: "pending", label: "Adjudicated", icon: <Clock className="h-3.5 w-3.5" /> },
  { id: "settled", label: "Settled", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

function lineStatus(resolution: DentalLineResolution | undefined, denied: boolean, payable: boolean): { label: string; tone: string } {
  if (denied) {
    if (resolution === "appealed") return { label: "Appealed", tone: "bg-amber-50 text-amber-700" };
    if (resolution === "resubmitted") return { label: "Resubmitted", tone: "bg-blue-50 text-blue-700" };
    if (resolution === "billed-patient") return { label: "Billed patient", tone: "bg-purple-50 text-purple-700" };
    if (resolution === "write-off") return { label: "Written off", tone: "bg-slate-100 text-slate-600" };
    if (resolution === "closed") return { label: "Closed", tone: "bg-slate-100 text-slate-600" };
    return { label: "Denied — action needed", tone: "bg-red-50 text-red-700" };
  }
  if (payable) return { label: "Paid", tone: "bg-emerald-50 text-emerald-700" };
  return { label: "Pending", tone: "bg-slate-100 text-slate-600" };
}

export function DentalClaimQueue() {
  const { state, activeCase, planId, goTo } = useDentalTrack();
  const adjudication = useMemo(() => adjudicateDentalClaim(state.lines, activeCase), [state.lines, activeCase]);

  const remittances = useMemo(
    () => ERA_REMITTANCES.filter((r) => r.payerPlanId === planId),
    [planId],
  );

  const hasLines = state.lines.length > 0;
  const sent = state.claimSubmitted;

  // Overall claim stage.
  const anyDeniedUnresolved = adjudication.lines.some(
    (l) => l.denial && !["appealed", "resubmitted", "billed-patient", "write-off", "closed"].includes(state.lineResolutions[l.lineId] ?? ""),
  );
  const stage: ClaimStage = !hasLines ? "created" : !sent ? "created" : anyDeniedUnresolved ? "pending" : "settled";

  const stageIdx = STEPS.findIndex((s) => s.id === stage);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Claim Status Queue</h3>
          <p className="text-[10px] text-slate-400">Track each claim through created → sent → paid/denied/appealed.</p>
        </div>
        <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
          {adjudication.lines.length} line{adjudication.lines.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* lifecycle stepper */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const reached = i <= stageIdx;
            const active = i === stageIdx;
            return (
              <div key={s.id} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-teal-600 text-white" : reached ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-300"}`}>
                    {s.icon}
                  </div>
                  <span className={`mt-1 text-[9px] font-semibold ${active ? "text-teal-700" : reached ? "text-slate-600" : "text-slate-300"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`mx-1 mb-4 h-0.5 flex-1 ${i < stageIdx ? "bg-teal-500" : "bg-slate-200"}`} />}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-500">
          {stage === "created" && (hasLines ? "Claim drafted — submit from the claim (billing) stage to send it." : "No claim lines yet. Accept a treatment plan and code first.")}
          {stage === "pending" && "Sent & adjudicated — one or more lines need follow-up (denied / downgraded)."}
          {stage === "settled" && "Sent & settled — all lines resolved: paid, appealed, billed to patient, or written off."}
        </p>
      </div>

      {/* per-line queue */}
      <div className="mt-3 space-y-2">
        {adjudication.lines.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs text-slate-500">No claim lines to track yet.</p>
          </div>
        )}
        {adjudication.lines.map((l) => {
          const c = findCDT(l.code);
          const denied = Boolean(l.denial);
          const payable = l.result.payable;
          const res = state.lineResolutions[l.lineId];
          const st = lineStatus(res, denied, payable);
          const denial = l.denial ? findDenial(l.denial.id) : undefined;
          return (
            <div key={l.lineId} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">
                    {l.code} {c ? `· ${c.shortName}` : ""}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    DOS {l.claimLine.dateOfService} · plan pays {fmtDollar(l.result.planPaysUsd)} · patient owes {fmtDollar(l.result.patientOwesUsd)}
                    {l.isDowngrade ? " · downgraded (still covered)" : ""}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.tone}`}>{st.label}</span>
              </div>
              {l.denial && denial && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-100 bg-red-50 px-2 py-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                  <p className="text-[10px] text-red-700">
                    <span className="font-semibold">{denial.id} · {denial.title}.</span> {denial.plainLanguage}
                  </p>
                </div>
              )}
              {l.isDowngrade && !l.denial && (
                <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                  <p className="text-[10px] text-amber-700">
                    Alternate benefit applied — covered at a reduced allowance. This is a downgrade, not a denial.
                  </p>
                </div>
              )}
              {res === "appealed" && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-700">
                  <RotateCcw className="h-3 w-3" /> Appeal in progress
                </div>
              )}
              {res === "billed-patient" && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-purple-700">
                  <User className="h-3 w-3" /> Patient has been billed for their responsibility
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ERA (835) remittance — the payer's response once the claim is sent */}
      {sent && remittances.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">ERA (835) remittance</h3>
              <p className="text-[10px] text-slate-400">Read the payer's electronic remittance and reconcile it against your claim.</p>
            </div>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
              {remittances.length} sample{remittances.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="space-y-3">
            {remittances.map((r) => (
              <DentalEraRemittance key={r.id} remittance={r} />
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1 text-[9px] text-slate-400">
        <Phone className="h-3 w-3 shrink-0" />
        Denied lines can be worked in the AR stage (voice follow-up) — resolutions you record there appear here.
      </p>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => goTo("ar")}
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
        >
          Continue to AR follow-up <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function fmtDollar(n: number): string {
  return `$${Math.round(n * 100) / 100}`;
}
