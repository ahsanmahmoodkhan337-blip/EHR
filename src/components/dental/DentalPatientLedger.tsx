/**
 * DentalPatientLedger.tsx — Patient ledger / account view (Dentrix Ledger)
 *
 * Inspired by: the Dentrix Patient Ledger / Open Dental Account module — a
 * running account of charges, payments, adjustments and the patient's balance,
 * plus a 30/60/90+ AR aging breakdown.
 *
 * Money rule (money-cycle items 5 and 13, `specs/task-5-posting-denials-ar.md`):
 * **every figure on this screen is summed from the ledger entries**, and from
 * nothing else. The entries are written by the 835 posting step on the claim
 * queue (charge, insurance payment, contractual adjustment) or by the two cards
 * below (a hand-posted patient payment or courtesy adjustment). The balance is
 * `ledgerBalance()` — the same function the posting step and the tests use — so
 * a screen, a test and a case key cannot disagree about the same money.
 */

import { useMemo, useState } from "react";
import { Plus, Trash2, Info, Scale, ArrowRight, Landmark } from "lucide-react";
import { findCDT } from "../../data/dental";
import { useDentalTrack } from "./DentalTrackStore";
import { LEDGER_ENTRY_LABELS, ledgerBalance, type LedgerEntry } from "../../domain/ledger";

const style = {
  card: "rounded-xl border border-slate-200 bg-white shadow-sm",
  label: "text-[10px] font-semibold uppercase tracking-wider text-slate-500",
  input:
    "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500",
};

function daysBetween(dos: string, ref: Date): number {
  if (!dos) return 0;
  const d = new Date(`${dos.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((ref.getTime() - d.getTime()) / 86400000));
}

export function DentalPatientLedger() {
  const { state, activeCase, postLedgerEntry, removeLedgerEntry, goTo } = useDentalTrack();

  const [payDraft, setPayDraft] = useState({ amountUsd: 0, source: "patient" as "patient" | "insurance", method: "Cash" });
  const [adjDraft, setAdjDraft] = useState({ amountUsd: 0, type: "contractual-write-off", note: "" });

  const ledger = state.ledger;
  const balance = useMemo(() => ledgerBalance(ledger), [ledger]);
  const chargesUsd = balance.chargesCents / 100;
  const insurancePaidUsd = balance.insurancePaidCents / 100;
  const adjustmentsUsd = balance.adjustmentsCents / 100;
  const patientPaidUsd = balance.patientPaidCents / 100;
  const patientBalanceUsd = balance.patientBalanceCents / 100;

  const chargeEntries = useMemo(() => ledger.filter((entry) => entry.type === "charge"), [ledger]);
  const postedFromEra = useMemo(() => ledger.some((entry) => Boolean(entry.eraId)), [ledger]);

  // ── aging: bucket the posted charges by the age of their service date, then
  // apply everything that has been paid or adjusted FIFO from the oldest. ──
  const today = useMemo(() => new Date(), []);
  const buckets = useMemo(() => {
    const b = { current: 0, d31: 0, d61: 0, d90: 0 };
    for (const entry of chargeEntries) {
      const age = daysBetween(entry.serviceDate ?? entry.date, today);
      const amt = entry.amountCents / 100;
      if (age >= 90) b.d90 += amt;
      else if (age >= 61) b.d61 += amt;
      else if (age >= 31) b.d31 += amt;
      else b.current += amt;
    }
    // Everything that has reduced the account so far, oldest balance first.
    let credit = Math.max(0, chargesUsd - patientBalanceUsd);
    for (const key of ["d90", "d61", "d31", "current"] as const) {
      const applied = Math.min(b[key], credit);
      b[key] = round2(b[key] - applied);
      credit -= applied;
      if (credit <= 0) break;
    }
    return b;
  }, [chargeEntries, chargesUsd, patientBalanceUsd, today]);

  const addPayment = () => {
    if (payDraft.amountUsd <= 0) return;
    const at = new Date().toISOString();
    const entry: LedgerEntry = {
      id: `PMT-${Date.now()}`,
      patientId: activeCase?.patient.id ?? null,
      claimNumber: state.claimNumber ?? "",
      date: at.slice(0, 10),
      type: payDraft.source === "patient" ? "patient_payment" : "insurance_payment",
      code: "MANUAL",
      description: `${payDraft.source === "patient" ? "Patient" : "Insurance"} payment · ${payDraft.method}, posted by hand`,
      amountCents: -Math.round(payDraft.amountUsd * 100),
      userId: "student",
    };
    postLedgerEntry(entry);
    setPayDraft({ amountUsd: 0, source: "patient", method: "Cash" });
  };

  const addAdjustment = () => {
    if (adjDraft.amountUsd <= 0) return;
    const at = new Date().toISOString();
    const entry: LedgerEntry = {
      id: `ADJ-${Date.now()}`,
      patientId: activeCase?.patient.id ?? null,
      claimNumber: state.claimNumber ?? "",
      date: at.slice(0, 10),
      type: "adjustment",
      code: adjDraft.type === "contractual-write-off" ? "CO-45" : "ADJ",
      description: `${adjDraft.type}${adjDraft.note ? ` (${adjDraft.note})` : ""}, posted by hand`,
      amountCents: -Math.round(adjDraft.amountUsd * 100),
      userId: "student",
    };
    postLedgerEntry(entry);
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

      {/* summary — every figure summed from the ledger entries */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label="Charges" value={chargesUsd} tone="slate" />
        <Stat label="Insurance paid" value={insurancePaidUsd} tone="emerald" />
        <Stat label="Write-offs / adj" value={adjustmentsUsd} tone="amber" />
        <Stat label="Patient paid" value={patientPaidUsd} tone="sky" />
        <Stat label="Balance" value={patientBalanceUsd} tone={patientBalanceUsd > 0 ? "red" : "emerald"} />
        <Stat label="Entries" value={ledger.length} tone="slate" count />
      </div>

      {ledger.length === 0 && (
        <div className="mt-3 flex items-start gap-1.5 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2">
          <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-600" />
          <p className="text-[10px] leading-snug text-teal-800">
            No money has moved yet. Post the claim's 835 from the claim status queue — that writes the charge, the
            insurance payment and every contractual adjustment here. Nothing on this screen is estimated.
          </p>
        </div>
      )}

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
          Charges are aged by the date of service on the posted entry; payments and adjustments are applied to the
          oldest balance first (FIFO).
        </p>
      </div>

      {/* transactions */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {/* charges */}
        <div className={style.card + " p-3"}>
          <p className={style.label}>Charges (posted from the 835)</p>
          <div className="mt-1 space-y-1">
            {chargeEntries.length === 0 && (
              <p className="py-2 text-center text-[11px] text-slate-400">No charges posted yet — post the claim's 835 first.</p>
            )}
            {chargeEntries.map((entry) => {
              const c = findCDT(entry.code);
              return (
                <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">{entry.code} {c ? `· ${c.shortName}` : ""}</p>
                    <p className="text-[9px] text-slate-500">
                      {entry.serviceDate ? `DOS ${entry.serviceDate} · ` : ""}line {entry.lineNumber ?? "—"} · {fmtDollar(entry.amountCents / 100)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600">
                    charge
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* hand posting */}
        <div className="space-y-3">
          <div className={style.card + " p-3"}>
            <p className={style.label}>Post a payment by hand</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount"
                aria-label="Payment amount"
                value={payDraft.amountUsd === 0 ? "" : payDraft.amountUsd}
                onChange={(e) => setPayDraft({ ...payDraft, amountUsd: e.target.valueAsNumber || 0 })}
                className={style.input}
              />
              <select
                aria-label="Payment source"
                value={payDraft.source}
                onChange={(e) => setPayDraft({ ...payDraft, source: e.target.value as "patient" | "insurance" })}
                className={style.input}
              >
                <option value="patient">Patient payment</option>
                <option value="insurance">Insurance payment</option>
              </select>
              <select
                aria-label="Payment method"
                value={payDraft.method}
                onChange={(e) => setPayDraft({ ...payDraft, method: e.target.value })}
                className={style.input}
              >
                {["Cash", "Card", "Check", "EFT"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addPayment}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-teal-600 px-2 text-xs font-medium text-white hover:bg-teal-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Post
              </button>
            </div>
          </div>

          <div className={style.card + " p-3"}>
            <p className={style.label}>Post an adjustment / write-off</p>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Amount"
                aria-label="Adjustment amount"
                value={adjDraft.amountUsd === 0 ? "" : adjDraft.amountUsd}
                onChange={(e) => setAdjDraft({ ...adjDraft, amountUsd: e.target.valueAsNumber || 0 })}
                className={style.input}
              />
              <select
                aria-label="Adjustment type"
                value={adjDraft.type}
                onChange={(e) => setAdjDraft({ ...adjDraft, type: e.target.value })}
                className={style.input}
              >
                <option value="contractual-write-off">Contractual write-off</option>
                <option value="courtesy">Courtesy adjustment</option>
                <option value="other">Other</option>
              </select>
              <input
                placeholder="Note (optional)"
                aria-label="Adjustment note"
                value={adjDraft.note}
                onChange={(e) => setAdjDraft({ ...adjDraft, note: e.target.value })}
                className={style.input + " col-span-2"}
              />
              <button
                type="button"
                onClick={addAdjustment}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-lg bg-slate-600 px-2 text-xs font-medium text-white hover:bg-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Post
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* posted activity — the ledger itself */}
      <div className={style.card + " mt-3 p-3"}>
        <p className={style.label}>Posted activity — the ledger</p>
        {ledger.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-slate-400">No entries yet.</p>
        ) : (
          <div className="mt-1 space-y-1">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="min-w-0">
                  <p className="truncate text-[11px] text-slate-700">
                    <span className="font-semibold">{LEDGER_ENTRY_LABELS[entry.type]}</span>
                    {entry.code && entry.code !== "PAYER-PMT" ? ` · ${entry.code}` : ""} — {entry.description}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {entry.date || "date not recorded"}
                    {entry.lineNumber ? ` · line ${entry.lineNumber}` : ""}
                    {entry.eraId ? ` · from 835 ${entry.eraId}` : " · posted by hand"}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`text-xs font-semibold ${entry.amountCents < 0 ? "text-emerald-600" : "text-slate-700"}`}>
                    {entry.amountCents < 0 ? "−" : "+"}
                    {fmtDollar(Math.abs(entry.amountCents) / 100)}
                  </span>
                  {!entry.eraId && (
                    <button
                      type="button"
                      onClick={() => removeLedgerEntry(entry.id)}
                      className="rounded p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                      aria-label={`Remove the hand-posted entry: ${entry.description}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">
          <Info className="h-3 w-3 shrink-0" />
          Every figure above is the sum of these entries. Entries posted from an 835 cannot be deleted — they are
          the payer's own record. {postedFromEra ? "This account has 835-posted money." : "Nothing has come from an 835 yet."}
        </p>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => goTo("debrief")}
          className="flex min-h-[40px] items-center gap-1.5 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Finish & review debrief <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, count }: { label: string; value: number; tone: string; count?: boolean }) {
  const toneCls =
    tone === "emerald" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : tone === "sky" ? "text-blue-600" : "text-slate-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-sm font-bold ${toneCls}`}>{count ? value : fmtDollar(value)}</p>
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
