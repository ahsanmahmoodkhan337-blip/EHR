/**
 * /reports — the Reports rail page
 *
 * Inspired by: Epic's revenue-cycle report cards and athenahealth's financial
 * dashboard — the practice's own numbers, each one traceable to the records
 * behind it.
 *
 * Spec `eleven-rail-pages.md` (owner decision, 2026-11-20): Reports is a page,
 * not a drawer, and it shows the student's own figures only —
 *
 *  - **claims by status**, counted from the encounters' claim records;
 *  - **billed / allowed / paid / adjusted / patient responsibility**, summed from
 *    the totals of the 835s the student actually posted — the money that reached
 *    the ledger. Nothing is projected, sampled or trended, and no figure appears
 *    before an 835 is posted;
 *  - **denials by group code and CARC**, counted from the AR queue, which derives
 *    a denial only from a posted 835;
 *  - **the AR aging totals**, from the same queue.
 *
 * The dental track posts no 835, so its block reads its ledger and its own
 * adjudication and says so, rather than claiming an allowed/paid split it does
 * not have.
 */

import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PatientProvider } from "../store/patientStore";
import { PipelineProvider, usePipeline } from "../store/pipelineStore";
import { useActiveTrack } from "../components/shell/activeTrack";
import { readDentalTrackRecord } from "../components/dental/DentalTrackStore";
import { buildDentalReportTotals, buildReportTotals } from "../domain/railPages";
import { usd } from "../domain/homeWorkQueues";
import {
  RailEmptyState,
  RailFigure,
  RailNote,
  RailPageHeader,
  RailSection,
  railFooter,
} from "../components/rail/RailPageFrame";

export const Route = createFileRoute("/reports")({
  component: () => (
    <PatientProvider>
      <PipelineProvider>
        <ReportsPage />
      </PipelineProvider>
    </PatientProvider>
  ),
});

function ReportsPage() {
  // The stored track, live (owner item 4): the header switch and the page agree.
  const track = useActiveTrack();
  const { allEncounters, arWorkItems } = usePipeline();
  const dental = useMemo(() => readDentalTrackRecord(), []);

  const totals = useMemo(
    () => buildReportTotals({ encounters: Object.values(allEncounters), items: arWorkItems }),
    [allEncounters, arWorkItems],
  );
  const dentalTotals = useMemo(() => buildDentalReportTotals(dental), [dental]);

  const dentalLedgerCents = dentalTotals.ledger.reduce((sum, row) => sum + row.cents, 0);

  return (
    <AppShell track={track} activeNav="reports" footer={railFooter}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <RailPageHeader
          icon={BarChart3}
          title="Reports"
          purpose="Your own numbers: claims by status, the money that posted, denials by code and the AR aging."
          count={totals.claimCount}
          countLabel={totals.claimCount === 1 ? "claim on record" : "claims on record"}
        />

        <RailSection title="Claims by status" count={totals.claimsByStatus.length}>
          {totals.claimsByStatus.length === 0 ? (
            <RailEmptyState nextStep="build a claim in the Claim stage — it appears here with the status its own timeline records." />
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {totals.claimsByStatus.map((row) => (
                <li
                  key={row.status}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <p className="break-words text-xs font-semibold text-slate-400 dark:text-slate-500">
                    {row.label}
                  </p>
                  <p className="text-[12px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                    {row.count}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </RailSection>

        <RailSection title="Money from posted 835s">
          {totals.money === null ? (
            <RailEmptyState nextStep="post an 835 from the Biller stage. The first figure appears here only after money reaches the ledger." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <RailFigure
                label="Billed"
                value={usd(totals.money.billedCents)}
                source={`sum of ${totals.money.postedRemittances} posted 835${totals.money.postedRemittances === 1 ? "" : "s"}`}
              />
              <RailFigure
                label="Allowed"
                value={usd(totals.money.allowedCents)}
                source="what the plans allowed"
              />
              <RailFigure
                label="Paid by plans"
                value={usd(totals.money.paidCents)}
                source="insurance payments"
              />
              <RailFigure
                label="Adjusted"
                value={usd(totals.money.adjustedCents)}
                source="contractual CO adjustments"
              />
              <RailFigure
                label="Patient responsibility"
                value={usd(totals.money.patientRespCents)}
                source="deductible, coinsurance and copay"
              />
            </div>
          )}
        </RailSection>

        <RailSection title="Denials by group code and CARC" count={totals.denialsByCode.length}>
          {totals.denialsByCode.length === 0 ? (
            <RailEmptyState nextStep="post an 835 with a denied line — the group code, the CARC and the money appear here." />
          ) : (
            <ul className="space-y-2">
              {totals.denialsByCode.map((row) => (
                <li
                  key={row.code}
                  className="clinical-card p-3"
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-[12px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                      {row.code}
                    </p>
                    <p className="min-w-0 flex-1 break-words text-[11px] text-slate-600 dark:text-slate-300">
                      {row.description || "no description on this 835"}
                    </p>
                    <p className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {row.count} {row.count === 1 ? "line" : "lines"} · {usd(row.cents)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </RailSection>

        <RailSection title="AR aging" count={totals.arOpenCount}>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {totals.aging.map((bucket) => (
              <li
                key={bucket.bucket}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {bucket.bucket} days
                </p>
                <p className="text-[12px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {usd(bucket.cents)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {bucket.count} {bucket.count === 1 ? "item" : "items"}
                </p>
              </li>
            ))}
          </ul>
        </RailSection>

        <RailSection title="Dental">
          {dentalTotals.claimNumber === null && dentalTotals.ledger.length === 0 ? (
            <RailEmptyState nextStep="transmit an ADA claim from the dental claim stage — its claim number and its ledger entries appear here." />
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <RailFigure
                  label="Claim"
                  value={dentalTotals.claimNumber ?? "not transmitted yet"}
                  source={dentalTotals.claimStatusLabel ?? "no status recorded"}
                />
                <RailFigure
                  label="Ledger entries"
                  value={String(dentalTotals.ledger.reduce((sum, row) => sum + row.count, 0))}
                  source="what the dental track actually posted"
                />
                <RailFigure
                  label="Ledger total"
                  value={usd(dentalLedgerCents)}
                  source="sum of every dental ledger entry"
                />
                <RailFigure
                  label="Denied lines open"
                  value={String(dentalTotals.deniedLines)}
                  source="from this case's adjudication"
                />
              </div>

              {dentalTotals.ledger.length > 0 && (
                <ul className="space-y-1">
                  {dentalTotals.ledger.map((row) => (
                    <li
                      key={row.label}
                      className="flex flex-wrap items-baseline justify-between gap-x-2 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <span className="text-[11px] text-slate-600 dark:text-slate-300">{row.label}</span>
                      <span className="text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                        {row.count} · {usd(row.cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </RailSection>

        <RailNote>
          Every figure on this page is summed from your own saved records — the claims you built, the 835s you posted
          and the AR queue those postings created. No sample numbers, no trend line, and nothing is estimated: a
          figure appears only once the record behind it exists.
        </RailNote>
        </div>
      </div>
    </AppShell>
  );
}
