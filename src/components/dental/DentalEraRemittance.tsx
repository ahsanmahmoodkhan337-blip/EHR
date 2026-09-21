/**
 * DentalEraRemittance.tsx — ERA (835) remittance view
 *
 * Inspired by: the electronic remittance advice (X12 835) a dental biller reads
 * in Dentrix / Open Dental / clearinghouse portals. Renders an `EraRemittance`
 * from the data layer (eraRemittance.ts, authored by the RCM content
 * specialist): the payer/patient header, a line-by-line service table with CAS
 * adjustments, claim-level (PLB) adjustments, and the payer's teaching notes.
 *
 * Teaching guardrail enforced here: a downgrade is NOT a denial. An
 * alternate-benefit line is `disposition: "paid-with-adjustment"` — it renders as
 * an amber "Paid w/ adjustment" badge with a CO-59 style note ("paid at the
 * lower allowance"), never as a red denial. Only a true exclusion/denial renders
 * red (`disposition: "denied"`).
 */

import { BadgeCheck, FileText, Info } from "lucide-react";
import type {
  EraClaimLevelAdjustment,
  EraLineAdjustment,
  EraLineDisposition,
  EraRemittance,
} from "../../data/dental";

const DISPOSITION_BADGE: Record<EraLineDisposition, { cls: string; label: string }> = {
  paid: { cls: "status-badge is-success", label: "Paid" },
  "paid-with-adjustment": { cls: "status-badge is-warning", label: "Paid w/ adjustment" },
  denied: { cls: "status-badge is-danger", label: "Denied" },
};

export function DentalEraRemittance({ remittance }: { remittance: EraRemittance }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── remittance header ─────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-bold text-slate-800">
            <FileText className="h-3.5 w-3.5 text-teal-600" /> ERA {remittance.id}
          </span>
          <span className="text-[10px] font-medium text-slate-600">{remittance.title}</span>
          <span className="ml-auto rounded bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
            {remittance.payerPlanId} · {fmtUsd(remittance.totalPaidUsd)} paid
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-600 sm:grid-cols-4">
          <HeaderItem k="Patient" v={remittance.patientName} />
          <HeaderItem k="Claim ctrl" v={remittance.claimControlNumber} />
          <HeaderItem k="Remittance date" v={remittance.remittanceDate} />
          <HeaderItem k="Plan" v={remittance.payerPlanId} />
        </div>
        <p className="mt-1.5 flex items-start gap-1 border-t border-slate-200 pt-1.5 text-[10px] leading-snug text-slate-500">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
          {remittance.summary}
        </p>
      </div>

      {/* ── line-level service table ─────────────────────────────────── */}
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
              <th className="num">Write-off</th>
              <th className="num">Prov adj</th>
              <th>CAS adjustments</th>
            </tr>
          </thead>
          <tbody>
            {remittance.lines.map((line) => {
              const badge = DISPOSITION_BADGE[line.disposition];
              const isDowngrade = line.disposition === "paid-with-adjustment";
              return (
                <tr key={line.line}>
                  <td className="num font-medium text-slate-500">{line.line}</td>
                  <td>
                    <span className="font-medium text-slate-800">{line.code}</span>
                    {line.tooth ? <span className="text-slate-400"> · #{line.tooth}</span> : ""}
                  </td>
                  <td>
                    <span className={badge.cls}>{badge.label}</span>
                    {isDowngrade && (
                      <div className="mt-0.5 text-[9px] text-amber-600">downgrade, not a denial</div>
                    )}
                  </td>
                  <td className="num">{fmtUsd(line.chargedUsd)}</td>
                  <td className="num">{fmtUsd(line.allowedUsd)}</td>
                  <td className="num text-emerald-700">{fmtUsd(line.paidUsd)}</td>
                  <td className="num text-red-700">{fmtUsd(line.patientOwesUsd)}</td>
                  <td className="num">{fmtUsd(line.writeOffUsd)}</td>
                  <td className="num">{fmtUsd(line.providerAdjustmentUsd)}</td>
                  <td>
                    <AdjustmentChips adjustments={line.adjustments} />
                    {line.note && <p className="mt-1 text-[9px] leading-snug text-slate-500">{line.note}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── claim-level (PLB) adjustments + teaching points ───────────── */}
      {remittance.claimLevelAdjustments && remittance.claimLevelAdjustments.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
          <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">Claim-level adjustments</p>
          {remittance.claimLevelAdjustments.map((a, i) => (
            <ClaimAdjustment key={i} adj={a} />
          ))}
        </div>
      )}

      {remittance.teachingPoints.length > 0 && (
        <div className="border-t border-slate-100 px-3 py-2">
          <p className="mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">
            <BadgeCheck className="h-3 w-3 text-teal-600" /> Teaching points
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-[10px] leading-snug text-slate-600">
            {remittance.teachingPoints.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AdjustmentChips({ adjustments }: { adjustments: EraLineAdjustment[] }) {
  if (adjustments.length === 0) return <span className="text-[10px] text-slate-400">—</span>;
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {adjustments.map((a, i) => (
          <span
            key={i}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
              a.groupCode === "PR"
                ? "bg-purple-50 text-purple-700"
                : a.groupCode === "CO" && a.denialId
                  ? "bg-red-50 text-red-700"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {a.groupCode}-{a.reasonCode} {fmtUsd(a.amountUsd)}
          </span>
        ))}
      </div>
      {adjustments.map((a, i) => (
        <p key={`n-${i}`} className="text-[9px] leading-snug text-slate-500">
          {a.groupCode}-{a.reasonCode}
          {a.denialId ? ` · ${a.denialId}` : ""}: {a.note}
        </p>
      ))}
    </div>
  );
}

function ClaimAdjustment({ adj }: { adj: EraClaimLevelAdjustment }) {
  return (
    <div className="flex items-start gap-1.5 text-[10px] text-slate-600">
      <span
        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
          adj.amountUsd < 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
        }`}
      >
        {adj.reasonCode} {fmtUsd(adj.amountUsd)}
      </span>
      <p className="leading-snug">
        <span className="font-medium">{adj.description}.</span> {adj.note}
      </p>
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
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(n) * 100) / 100}`;
}
