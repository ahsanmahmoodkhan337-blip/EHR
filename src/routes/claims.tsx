/**
 * /claims — the Claims rail page
 *
 * Inspired by: Epic's claim workqueue and athenahealth's Claims list — every
 * claim the practice has, with where it stands, filterable the way a biller
 * filters it: by status, by payer and by date of service.
 *
 * Spec `eleven-rail-pages.md` (owner decision, 2026-11-20). Every row is one of
 * the student's own claims, read from their encounter record:
 *
 *  - the claim number is minted once by the store and never re-minted;
 *  - the status is what the claim's own append-only timeline last recorded
 *    (`domain/claimStatus.ts`), never a flag this page sets — a claim with no
 *    recorded transition reads as **Draft**, which is what it is;
 *  - the payer, the date of service and the billed amount come off the claim's
 *    own paper (CMS-1500 box 11c payer block, box 24A, box 28) or, when the
 *    paper has not been opened, off the coded lines the coder handed over.
 *
 * The filter options are built from the student's own claims, so the page never
 * offers a payer or a status that no claim of theirs is in. With no claims at
 * all it names the Claim stage, which is what produces the first one.
 */

import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { PipelineProvider, usePipeline, type Role } from "../store/pipelineStore";
import { readActiveTrack } from "../components/shell/activeTrack";
import { ActivePatientBanner } from "../components/shell/ActivePatientBanner";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { readDentalTrackRecord } from "../components/dental/DentalTrackStore";
import {
  buildClaimRows,
  buildDentalClaimRow,
  dentalCaseLabel,
  EMPTY_CLAIM_FILTERS,
  filterClaimRows,
  payerOptions,
  statusOptions,
  type ClaimFilters,
  type ClaimRow,
  type RailRow,
} from "../domain/railPages";
import {
  RailEmptyState,
  RailNote,
  RailPageHeader,
  RailRowList,
  railFooter,
} from "../components/rail/RailPageFrame";

export const Route = createFileRoute("/claims")({
  component: () => (
    <PatientProvider>
      <PipelineProvider>
        <ClaimsPage />
      </PipelineProvider>
    </PatientProvider>
  ),
});

const fieldClass =
  "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

function ClaimsPage() {
  const navigate = useNavigate();
  const { allEncounters, activePatientId } = usePipeline();
  const { getPatientById } = usePatientStore();
  const dental = useMemo(() => readDentalTrackRecord(), []);
  const [filters, setFilters] = useState<ClaimFilters>(EMPTY_CLAIM_FILTERS);

  const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string => {
    const patient = patientId ? getPatientById(patientId) : undefined;
    if (patient) return `${patient.firstName} ${patient.lastName}`;
    return fallback ?? "No patient attached";
  };

  const rows = useMemo<ClaimRow[]>(() => {
    const medical = buildClaimRows({ encounters: Object.values(allEncounters), nameForPatient });
    const dentalRow = buildDentalClaimRow(dental, dentalCaseLabel(dental));
    return dentalRow ? [dentalRow, ...medical] : medical;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEncounters, dental, getPatientById]);

  const shown = filterClaimRows(rows, filters);
  const payers = payerOptions(rows);
  const statuses = statusOptions(rows);
  const filtered = filters.status !== "" || filters.payer !== "" || filters.date !== "";

  const openStage = (patientId: string | null, role: Role) => {
    requestPatientOpen(patientId, undefined, role);
    void navigate({ to: "/" });
  };

  const asRailRows: RailRow[] = shown;

  return (
    <AppShell
      track={readActiveTrack()}
      activeNav="claims"
      selectedPatientId={activePatientId ?? undefined}
      banner={<ActivePatientBanner />}
      footer={railFooter}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <RailPageHeader
          icon={FileText}
          title="Claims"
          purpose="Your claims with where each one stands — filter by status, payer or date of service."
          count={shown.length}
          countLabel={
            rows.length === shown.length
              ? rows.length === 1
                ? "claim in total"
                : "claims in total"
              : `of ${rows.length} claims`
          }
        />

        {rows.length > 0 && (
          <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Status
              </span>
              <select
                value={filters.status}
                onChange={(event) => setFilters({ ...filters, status: event.target.value })}
                className={fieldClass}
                aria-label="Filter claims by status"
              >
                <option value="">Every status</option>
                {statuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Payer
              </span>
              <select
                value={filters.payer}
                onChange={(event) => setFilters({ ...filters, payer: event.target.value })}
                className={fieldClass}
                aria-label="Filter claims by payer"
              >
                <option value="">Every payer</option>
                {payers.map((payer) => (
                  <option key={payer} value={payer}>
                    {payer}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Date of service
              </span>
              <input
                type="date"
                value={filters.date}
                onChange={(event) => setFilters({ ...filters, date: event.target.value })}
                className={fieldClass}
                aria-label="Filter claims by date of service"
              />
            </label>
          </div>
        )}

        {rows.length === 0 ? (
          <RailEmptyState nextStep="open a patient, code the encounter and build the claim in the Claim stage. It appears here with its status." />
        ) : shown.length === 0 ? (
          <div className="empty-state">
            <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
              No claim matches these filters.
            </p>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_CLAIM_FILTERS)}
              className="mt-1 inline-flex min-h-10 items-center rounded-lg px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:bg-brand-900/30"
            >
              Clear the filters
            </button>
          </div>
        ) : (
          <RailRowList rows={asRailRows} onOpenMedical={openStage} />
        )}

        <RailNote>
          {filtered
            ? "Filtered list. Every figure on a row comes from that claim's own record."
            : "Every claim here was built by your own work: the Claim stage mints the number, and its status is what the claim's own timeline last recorded."}
        </RailNote>
        </div>
      </div>
    </AppShell>
  );
}
