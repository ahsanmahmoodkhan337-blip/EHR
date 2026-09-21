/**
 * DentalPatientLedger.tsx — Patient ledger / account view (Dentrix Ledger)
 *
 * Inspired by: the Dentrix Patient Ledger / Open Dental Account module — a
 * running account of charges, payments, adjustments and the patient's balance,
 * plus a 30/60/90+ AR aging breakdown. All money is read off the existing
 * `adjudicateDentalClaim()` result; this component contains NO adjudication
 * logic of its own and never re-derives plan payments.
 */

import { useMemo, useState } from "react";
import { Plus, Trash2, Info, Scale, ArrowRight } from "lucide-react";
import { findCDT } from "../../data/dental";
import { useDentalTrack, type DentalAdjustment, type DentalPayment } from "./DentalTrackStore";
import { adjudicateDentalClaim } from "./adjudication";

const style = {
  card: "rounded-xl border border-slate-200 bg-white shadow-sm",
  label: "text-[10px] font-semibold uppercase tracking-wider text-slate-500",
  input:
    "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500",
};

function daysBetween(dos: string, ref: Date): number {
  const d = new Date(`${dos}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((ref.getTime() - d.getTime()) / 86400000));
}

export function DentalPatientLedger() {
  const { state, activeCase, postPayment, postAdjustment, removePayment, removeAdjustment, goTo } = useDentalTrack();

  const adjudication = useMemo(
    () => adjudicateDentalClaim(state.lines, activeCase),
    [state.lines, activeCase],
  );

  const [payDraft, setPayDraft] = useState({ amountUsd: 0, source: "patient" as "patient" | "insurance", method: "Cash" });
  const [adjDraft, setAdjDraft] = useState({ amountUsd: 0, type: "contractual-write-off" as DentalAdjustment["type"], note: "" });

  const totals = adjudication.totals;
  const patientPayments = state.payments.filter((p) => p.source === "patient").reduce((s, p) => s + p.amountUsd, 0);
  const insurancePayments = state.payments.filter((p) => p.source === "insurance").reduce((s, p) => s + p.amountUsd, 0);
  const adjustments = state.adjustments.reduce((s, a) => s + a.amountUsd, 0);

  // Patient balance = patient responsibility − patient payments − adjustments.
  const patientBalance = Math.max(0, totals.patientOwesUsd - patientPayments - adjustments);

  // ── aging: bucket the line-level patient responsibility by DOS age, then
  // apply payments+adjustments FIFO from the oldest bucket (standard AR view). ──
  const today = useMemo(() => new Date(), []);
  const buckets = useMemo(() => {
    const b = { current: 0, d31: 0, d61: 0, d90: 0 };
    for (const l of adjudication.lines) {
      const age = daysBetween(l.claimLine.dateOfService, today);
      const amt = l.result.patientOwesUsd;
      if (age >= 90) b.d90 += amt;
      else if (age >= 61) b.d61 += amt;
      else if (age >= 31) b.d31 += amt;
      else b.current += amt;
    }
    // FIFO credit application (oldest first).
    let credit = patientPayments + adjustments;
    for (const key of ["d90", "d61", "d31", "current"] as const) {
      const applied = Math.min(b[key], credit);
      b[key] = round2(b[key] - applied);
      credit -= applied;
      if (credit <= 0) break;
    }
    return b;
  }, [adjudication.lines, patientPayments, adjustments, today]);

  const addPayment = () => {
    if (payDraft.amountUsd <= 0) return;
    const p: DentalPayment = {
      id: `pmt-${Date.now()}`,
      amountUsd: round2(payDraft.amountUsd),
      source: payDraft.source,
      method: payDraft.method,
      at: new Date().toISOString(),
    };
    postPayment(p);
    setPayDraft({ amountUsd: 0, source: "patient", method: "Cash" });
  };

  const addAdjustment = () => {
    if (adjDraft.amountUsd <= 0) return;
    const a: DentalAdjustment = {
      id: `adj-${Date.now()}`,
      amountUsd: round2(adjDraft.amountUsd),
      type: adjDraft.type,
      note: adjDraft.note,
      at: new Date().toISOString(),
    };
    postAdjustment(a);
    setAdjDraft({ amountUsd: 0, type: "contractual-write-off", note: "" });
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Patient Ledger</h3>
          <p className="text-[10px] text-slate-400">
            {activeCase ? `${activeCase.patient.firstName} ${activeCase.patient.lastName} · ${activeCase.patient.memberId}` : "No case loaded"}
          </p>
        </div>
        <span className="rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
          Dentrix-style account
        </span>
      </div>

      {/* summary */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label="Charges" value={totals.chargedUsd} tone="slate" />
        <Stat label="Insurance pays" value={totals.planPaysUsd} tone="emerald" />
        <Stat label="Write-off" value={totals.writeOffUsd} tone="amber" />
        <Stat label="Patient owes" value={totals.patientOwesUsd} tone="red" />
        <Stat label="Paid / adjusted" value={patientPayments + adjustments} tone="sky" />
        <Stat label="Balance" value={patientBalance} tone={patientBalance > 0 ? "red" : "emerald"} />
      </div>

      {/* aging buckets */}
      <div className={`${style.card} mt-3 p-3`}>
        <p className={`${style.label} mb-2 flex items-center gap-1`}>
          <Scale className="h-3 w-3" /> AR aging — patient balance by days since service
        </p>
        <div className="grid grid-cols-4 gap-2">
          <Bucket label="Current (0–30)" value={buckets.current} />
          <Bucket label="31–60" value={buckets.d31} />
          <Bucket label="61–90" value={buckets.d61} />
          <Bucket label="90+" value={buckets.d90} highlight />
        </div>
        <p className="mt-2 text-[9px] text-slate-400">
          Payments and adjustments are applied to the oldest balance first (FIFO). Services dated in the future show as current.
        </p>
      </div>

      {/* transactions */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* charges */}
        <div className={style.card + " p-3"}>
          <p className={style.label}>Charges & insurance (from adjudicated claim)</p>
          <div className="mt-1 space-y-1">
            {adjudication.lines.length === 0 && (
              <p className="py-2 text-center text-[11px] text-slate-400">No claim lines yet — accept a treatment plan and bill first.</p>
            )}
            {adjudication.lines.map((l) => {
              const c = findCDT(l.code);
              return (
                <div key={l.lineId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">{l.code} {c ? `· ${c.shortName}` : ""}</p>
                    <p className="text-[9px] text-slate-500">
                      fee {fmtDollar(l.result.chargedUsd)} · plan {fmtDollar(l.result.planPaysUsd)} · pt {fmtDollar(l.result.patientOwesUsd)}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${l.isDowngrade ? "bg-amber-50 text-amber-700" : l.denial ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {l.denial ? "denied" : l.isDowngrade ? "downgraded" : "covered"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* payments + adjustments posting */}
        <div className="space-y-3">
          <div className={style.card + " p-3"}>
            <p className={style.label}>Post payment</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount"
                value={payDraft.amountUsd === 0 ? "" : payDraft.amountUsd}
                onChange={(e) => setPayDraft({ ...payDraft, amountUsd: e.target.valueAsNumber || 0 })}
                className={style.input}
              />
              <select
                value={payDraft.source}
                onChange={(e) => setPayDraft({ ...payDraft, source: e.target.value as "patient" | "insurance" })}
                className={style.input}
              >
                <option value="patient">Patient payment</option>
                <option value="insurance">Insurance payment</option>
              </select>
              <select value={payDraft.method} onChange={(e) => setPayDraft({ ...payDraft, method: e.target.value })} className={style.input}>
                {["Cash", "Card", "Check", "EFT"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button onClick={addPayment} className="flex items-center justify-center gap-1 rounded-lg bg-teal-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-teal-500">
                <Plus className="h-3.5 w-3.5" /> Post
              </button>
            </div>
          </div>

          <div className={style.card + " p-3"}>
            <p className={style.label}>Post adjustment / write-off</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount"
                value={adjDraft.amountUsd === 0 ? "" : adjDraft.amountUsd}
                onChange={(e) => setAdjDraft({ ...adjDraft, amountUsd: e.target.valueAsNumber || 0 })}
                className={style.input}
              />
              <select
                value={adjDraft.type}
                onChange={(e) => setAdjDraft({ ...adjDraft, type: e.target.value as DentalAdjustment["type"] })}
                className={style.input}
              >
                <option value="contractual-write-off">Contractual write-off</option>
                <option value="courtesy">Courtesy adjustment</option>
                <option value="other">Other</option>
              </select>
              <input
                placeholder="Note (optional)"
                value={adjDraft.note}
                onChange={(e) => setAdjDraft({ ...adjDraft, note: e.target.value })}
                className={style.input + " col-span-2"}
              />
              <button onClick={addAdjustment} className="flex items-center justify-center gap-1 rounded-lg bg-slate-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-slate-500">
                <Plus className="h-3.5 w-3.5" /> Post
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* posted activity */}
      <div className={style.card + " mt-3 p-3"}>
        <p className={style.label}>Posted activity</p>
        {state.payments.length === 0 && state.adjustments.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-slate-400">No payments or adjustments posted yet.</p>
        ) : (
          <div className="mt-1 space-y-1">
            {[...state.payments.map((p) => ({ kind: "payment" as const, id: p.id, at: p.at, label: `${p.source === "insurance" ? "Insurance" : "Patient"} payment · ${p.method}`, amt: p.amountUsd })),
              ...state.adjustments.map((a) => ({ kind: "adjustment" as const, id: a.id, at: a.at, label: `Adjustment · ${a.type}${a.note ? ` (${a.note})` : ""}`, amt: a.amountUsd })),
            ].map((t) => (
              <div key={`${t.kind}-${t.id}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5">
                <span className="text-[11px] text-slate-600">{t.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-600">−{fmtDollar(t.amt)}</span>
                  <button
                    onClick={() => (t.kind === "payment" ? removePayment(t.id) : removeAdjustment(t.id))}
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">
          <Info className="h-3 w-3 shrink-0" />
          Insurance payments ({fmtDollar(insurancePayments)}) are tracked separately and do not reduce the patient balance.
        </p>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => goTo("debrief")}
          className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
        >
          Finish & review debrief <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "sky" ? "text-blue-600" : "text-slate-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-sm font-bold ${toneCls}`}>{fmtDollar(value)}</p>
    </div>
  );
}

function Bucket({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${highlight && value > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-sm font-bold ${highlight && value > 0 ? "text-red-600" : "text-slate-700"}`}>{fmtDollar(value)}</p>
    </div>
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtDollar(n: number): string {
  return `$${round2(n)}`;
}
