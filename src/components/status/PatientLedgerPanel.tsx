/**
 * PatientLedgerPanel — the money that actually moved, summed from the entries.
 *
 * Inspiration: the account ledger every practice management system keeps under
 * a patient (Epic's account activity, eClinicalWorks' ledger tab, Dentrix's
 * ledger). It reads the encounter's ledger (`domain/ledger.ts`) and prints a
 * running list of charges, insurance payments, adjustments, patient payments,
 * refunds and transfers, each with its date, code and the user who posted it —
 * plus the balances, every one of them summed from those entries.
 *
 * The point of the panel: a student can follow one claim from the charge, to the
 * payer's payment, to the contractual write-off, to the balance left for the
 * patient, and every number is one of those rows. Nothing is typed, nothing is
 * stored twice, and an empty ledger says so rather than showing a zero.
 */

import { useId } from "react";
import { BookOpen, Scale } from "lucide-react";
import {
  LEDGER_ENTRY_LABELS,
  ledgerAgreesWithRemittance,
  ledgerBalance,
  ledgerEntriesForClaim,
  type LedgerEntry,
} from "../../domain/ledger";
import type { Remittance835 } from "../../domain/adjudication";
import { actorLabel } from "../../utils/actorLabel";

function money(cents: number): string {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export interface PatientLedgerPanelProps {
  entries: LedgerEntry[];
  /** The claim whose 835 was posted, so the ledger can be reconciled against it. */
  remittance?: Remittance835 | null;
  className?: string;
}

export function PatientLedgerPanel({ entries, remittance, className = "" }: PatientLedgerPanelProps) {
  const headingId = useId();
  const claimEntries = remittance ? ledgerEntriesForClaim(entries, remittance.claimNumber) : entries;
  const balance = ledgerBalance(claimEntries);
  const agrees = remittance ? ledgerAgreesWithRemittance(entries, remittance) : true;

  return (
    <section aria-labelledby={headingId} className={`rounded-xl border border-slate-200 bg-white ${className}`}>
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <BookOpen className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <h3 id={headingId} className="text-xs font-bold text-slate-800">
          Patient ledger{remittance ? ` — ${remittance.claimNumber}` : ""}
        </h3>
        <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {claimEntries.length} entr{claimEntries.length === 1 ? "y" : "ies"}
        </span>
      </header>

      {claimEntries.length === 0 ? (
        <p className="px-3 py-3 text-[10px] text-slate-500">
          No money has reached this patient's ledger yet. A charge appears here when a remittance is posted,
          never before.
        </p>
      ) : (
        <>
          {/* Balances — every one summed from the entries below. */}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-slate-100 px-3 py-2 text-[10px] sm:grid-cols-4">
            <div>
              <dt className="text-slate-400">Charges</dt>
              <dd className="font-semibold tabular-nums text-slate-700">{money(balance.chargesCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Insurance paid</dt>
              <dd className="font-semibold tabular-nums text-emerald-700">{money(balance.insurancePaidCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Adjustments (CO/OA)</dt>
              <dd className="font-semibold tabular-nums text-slate-700">{money(balance.adjustmentsCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Patient paid</dt>
              <dd className="font-semibold tabular-nums text-slate-700">{money(balance.patientPaidCents)}</dd>
            </div>
            <div className="col-span-2 sm:col-span-4">
              <dt className="text-slate-400">Patient balance</dt>
              <dd className="text-sm font-bold tabular-nums text-amber-700">
                {money(balance.patientBalanceCents)}
                <span className="ml-1.5 text-[10px] font-normal text-slate-500">
                  — what is left after the charge, the insurance payment and the write-off
                </span>
              </dd>
            </div>
          </dl>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[10px]">
              <caption className="sr-only">Ledger entries in posting order</caption>
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th scope="col" className="px-2 py-1">Date</th>
                  <th scope="col" className="px-2 py-1">Type</th>
                  <th scope="col" className="px-2 py-1">Code</th>
                  <th scope="col" className="px-2 py-1">Description</th>
                  <th scope="col" className="px-2 py-1 text-right">Amount</th>
                  <th scope="col" className="px-2 py-1">Posted by</th>
                </tr>
              </thead>
              <tbody>
                {claimEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-2 py-1 text-slate-500">{entry.date}</td>
                    <td className="px-2 py-1 text-slate-700">{LEDGER_ENTRY_LABELS[entry.type]}</td>
                    <td className="px-2 py-1 font-mono font-semibold text-slate-700">{entry.code}</td>
                    <td className="px-2 py-1 text-slate-600">{entry.description}</td>
                    <td
                      className={`px-2 py-1 text-right tabular-nums ${
                        entry.amountCents < 0 ? "text-emerald-700" : "text-slate-800"
                      }`}
                    >
                      {entry.amountCents < 0 ? `−${money(entry.amountCents)}` : `+${money(entry.amountCents)}`}
                    </td>
                    <td className="px-2 py-1 text-slate-500">{actorLabel(entry.userId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p
            className={`flex items-start gap-1.5 border-t border-slate-100 px-3 py-2 text-[10px] ${
              agrees ? "text-slate-500" : "text-red-700"
            }`}
          >
            <Scale className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            {remittance
              ? agrees
                ? `The ledger agrees with the 835: the patient's ${money(
                    remittance.totals.patientRespCents,
                  )} responsibility and the plan's ${money(
                    remittance.totals.paidCents,
                  )} payment are both on it.`
                : `The ledger does not agree with the 835. Do not close this claim — the posting is wrong, not the remittance.`
              : "Balances are summed from the entries above; nothing on this panel is typed or stored separately."}
          </p>
        </>
      )}
    </section>
  );
}
