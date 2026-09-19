/**
 * DentalEraRemittance.tsx — ERA (835) remittance view
 *
 * Inspired by: the electronic remittance advice (X12 835) a dental biller reads
 * in Dentrix / Open Dental / clearinghouse portals. It renders an `EraRemittance`
 * from the data layer (eraRemittance.ts): the payer/payee header, a CLP
 * (claim-payment) block per claim, and a line-by-line service table with the
 * CAS adjustments so the student learns to reconcile a payment against the claim
 * they sent.
 *
 * Teaching guardrail enforced here: a downgrade is NOT a denial. An
 * alternate-benefit line (`status: "downgraded"`) renders as an amber
 * "Downgraded" badge with `paidAtAllowedUsd` ("paid at $X"), never as a red
 * denial. Only a true exclusion/denial renders red.
 */

import { BadgeCheck, FileText, Info } from "lucide-react";
import type { EraClaim, EraRemittance, EraServiceLine } from "../../data/dental";

const STATUS_BADGE: Record<EraServiceLine["status"], { cls: string; label: string }> = {
  paid: { cls: "status-badge is-success", label: "Paid" },
  downgraded: { cls: "status-badge is-warning", label: "Downgraded" },
  denied: { cls: "status-badge is-danger", label: "Denied" },
};

export function DentalEraRemittance({ remittance }: { remittance: EraRemittance }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── remittance header (BPR / TRN) ─────────────────────────────── */}
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-bold text-slate-800">
            <FileText className="h-3.5 w-3.5 text-blue-600" /> ERA {remittance.id}
          </span>
          <span className="text-[10px] text-slate-500">{remittance.planId} (fictional payer)</span>
          <span className="ml-auto rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
            {remittance.paymentMethod === "EFT" ? "EFT" : "Check"} · {remittance.totalPaymentUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-600 sm:grid-cols-4">
          <HeaderItem k="Payer" v={remittance.payerName} />
          <HeaderItem k="Payee" v={remittance.payeeName} />
          <HeaderItem k="Payment date" v={remittance.paymentDate} />
          <HeaderItem k="Trace #" v={remittance.traceNumber} />
        </div>
        <p className="mt-1.5 flex items-start gap-1 border-t border-slate-200 pt-1.5 text-[10px] leading-snug text-slate-500">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
          {remittance.teachingSummary}
        </p>
      </div>

      {/* ── one block per claim payment (CLP) ─────────────────────────── */}
      {remittance.claims.map((claim) => (
        <ClaimBlock key={claim.payerClaimControlNumber} claim={claim} />
      ))}
    </div>
  );
}

function ClaimBlock({ claim }: { claim: EraClaim }) {
  const statusLabel =
    claim.claimStatus === "processed" ? "Processed" : claim.claimStatus === "denied" ? "Denied" : "Secondary";
  const writeOff = claim.totalChargedUsd - claim.totalPaidUsd - claim.totalPatientResponsibilityUsd;

  return (
    <div className="border-b border-slate-100">
      {/* CLP header */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-500">CLP</span>
        <span className="text-[11px] font-semibold text-slate-800">{claim.patientName}</span>
        <span className="text-[10px] text-slate-500">ID {claim.memberId}</span>
        <span className="text-[10px] text-slate-400">Payer ctrl {claim.payerClaimControlNumber} · {claim.patientControlNumber}</span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-semibold ${
            claim.claimStatus === "processed"
              ? "bg-emerald-50 text-emerald-700"
              : claim.claimStatus === "denied"
                ? "bg-red-50 text-red-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {/* service line table */}
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>Service</th>
              <th>Status</th>
              <th className="num">Charged</th>
              <th className="num">Allowed</th>
              <th className="num">Paid</th>
              <th className="num">Patient</th>
              <th>CAS adjustments</th>
            </tr>
          </thead>
          <tbody>
            {claim.serviceLines.map((line) => {
              const badge = STATUS_BADGE[line.status];
              return (
                <tr key={line.line}>
                  <td className="num font-medium text-slate-500">{line.line}</td>
                  <td>
                    <div className="font-medium text-slate-800">
                      {line.code}
                      {line.tooth ? <span className="text-slate-400"> · #{line.tooth}</span> : ""}
                    </div>
                  </td>
                  <td>
                    <span className={badge.cls}>{badge.label}</span>
                    {line.status === "downgraded" && line.paidAtAllowedUsd !== undefined && (
                      <div className="mt-0.5 text-[9px] text-amber-600">paid at ${line.paidAtAllowedUsd}</div>
                    )}
                  </td>
                  <td className="num">{fmtUsd(line.chargedUsd)}</td>
                  <td className="num">{fmtUsd(line.allowedUsd)}</td>
                  <td className="num text-emerald-700">{fmtUsd(line.paidUsd)}</td>
                  <td className="num text-red-700">{fmtUsd(line.patientResponsibilityUsd)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {line.adjustments.map((a, i) => (
                        <span
                          key={i}
                          className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                            a.group === "PR"
                              ? "bg-purple-50 text-purple-700"
                              : a.group === "CO" && a.denialId
                                ? "bg-red-50 text-red-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                          title={a.note}
                        >
                          {a.group}-{a.reasonCode} {fmtUsd(a.amountUsd)}
                        </span>
                      ))}
                    </div>
                    {line.adjustments.map((a, i) => (
                      <p key={`n-${i}`} className="mt-0.5 text-[9px] leading-snug text-slate-500">
                        {a.group}-{a.reasonCode}
                        {a.denialId ? ` · ${a.denialId}` : ""}: {a.note}
                      </p>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* reconciliation + downgrade teaching note */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
        <span>
          Charged <b>{fmtUsd(claim.totalChargedUsd)}</b>
        </span>
        <span>
          Paid <b className="text-emerald-700">{fmtUsd(claim.totalPaidUsd)}</b>
        </span>
        <span>
          Patient <b className="text-red-700">{fmtUsd(claim.totalPatientResponsibilityUsd)}</b>
        </span>
        <span>
          Write-off <b>{fmtUsd(writeOff)}</b>
        </span>
        {claim.serviceLines.some((l) => l.status === "downgraded") && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-amber-700">
            <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
            Downgrade = adjustment, not a denial
          </span>
        )}
      </div>
    </div>
  );
}

function HeaderItem({ k, v }: { k: string; v: string }) {
  return (
    <span className="truncate">
      <span className="text-slate-400">{k}: </span>
      <span className="font-medium text-slate-700">{v}</span>
    </span>
  );
}

function fmtUsd(n: number): string {
  return `$${Math.round(n * 100) / 100}`;
}

// Re-export a small type alias used by the queue wiring.
export type { EraClaim };
