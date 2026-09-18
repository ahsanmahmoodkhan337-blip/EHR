/**
 * DentalBillingLedger.tsx — Dental Biller workspace (ADA J430D-style claim)
 *
 * Inspired by: dental claim screens in Dentrix / Eaglesoft — the payer header,
 * member block, and a line-by-line adjudication trace the payer would walk.
 * The 12-step walk is produced by `evaluateClaim()` in the data layer (spec §2),
 * and the ordering is load-bearing: it is why a perfectly coded claim can pay
 * nothing at step 11 (annual maximum).
 *
 * Teaching guardrails (spec appendix):
 *  - fees labeled illustrative; payers visibly fictional;
 *  - an alternate-benefit downgrade is rendered as "covered at a reduced
 *    allowance", NEVER as a denial;
 *  - a downgraded line is never resolved by billing the downgraded code.
 */

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Phone, ShieldAlert, BadgeCheck } from "lucide-react";
import {
  findCDT,
  findPlan,
  findTooth,
  type DentalDenial,
} from "../../data/dental";
import { adjudicateDentalClaim, type TraceStep } from "./adjudication";
import { useDentalTrack } from "./DentalTrackStore";

export function DentalBillingLedger() {
  const { state, activeCase, planId, goTo } = useDentalTrack();
  const plan = findPlan(planId);

  const adjudication = useMemo(
    () => adjudicateDentalClaim(state.lines, activeCase),
    [state.lines, activeCase],
  );

  const [openTrace, setOpenTrace] = useState<Record<string, boolean>>({});

  return (
    <div className="h-full overflow-y-auto p-3">
      {/* ── claim header ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-2">
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
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-slate-600 sm:grid-cols-4">
          <Cell k="Member ID" v={activeCase?.patient.memberId ?? "MEM-000000"} />
          <Cell k="Subscriber" v={activeCase?.patient.subscriberName ?? "—"} />
          <Cell k="Group" v={plan?.groupNumber ?? "—"} />
          <Cell k="Payer ID" v={plan?.payerId ?? "—"} />
        </div>
        {plan && (
          <p className="mt-2 rounded bg-slate-50 px-2 py-1 text-[9px] text-slate-400">
            {plan.teachingSummary} Fees billed are illustrative; the allowance below is a teaching figure.
          </p>
        )}
      </div>

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
            </div>

            {/* verdict banner */}
            <div
              className={`flex items-center gap-2 px-3 py-2 text-[11px] font-medium ${
                denial ? "bg-red-50 text-red-900" : isDowngrade ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"
              }`}
            >
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

            {/* per-line payment split */}
            <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50 text-center">
              <Split k="Allowed" v={fmtUsd(result.allowedUsd)} />
              <Split k="Write-off" v={fmtUsd(result.contractualWriteOffUsd)} c="text-slate-500" />
              <Split k="Plan pays" v={fmtUsd(result.planPaysUsd)} c="text-emerald-600" />
              <Split k="Patient owes" v={fmtUsd(result.patientOwesUsd)} c="text-red-600" />
            </div>

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

            {/* denial detail */}
            {denial && (
              <div className="border-t border-red-100 bg-red-50/50 px-3 py-2">
                <DenialDetail denial={denial} />
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

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wide text-slate-400">{k}</p>
      <p className="truncate font-medium text-slate-700">{v}</p>
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
