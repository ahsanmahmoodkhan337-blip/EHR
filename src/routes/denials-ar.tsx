/**
 * /denials-ar — the "Denials and AR" rail page (one page, the label students saw)
 *
 * Inspired by: Epic's denial workqueue plus the AR follow-up worklist every
 * practice management system keeps behind the ledger. Two sections on one page,
 * because a biller works them together: the denials a payer just refused, and
 * the balances that are still owed.
 *
 * Spec `eleven-rail-pages.md` (owner decision, 2026-11-20):
 *
 *  - **Denials** — denied lines with the group code and CARC the 835 used, the
 *    RARC it carries (or "none on this 835" — the app ships no RARC list, so it
 *    never invents a code), the payer, the amount and the appeal deadline,
 *    split into not-yet-worked and appealed-awaiting-answer.
 *  - **AR** — the worklist with the 0-30 / 31-60 / 61-90 / 91-120 / 120+ aging,
 *    the follow-up date, the last action recorded and the note on the item.
 *
 * Both sections come from `domain/arWorkQueue.ts`, which derives an item only
 * where posted money exists: a denied line of a **posted** 835, or a patient
 * balance summed from the ledger. Nothing here is stored or estimated, and the
 * student's own work on an item is the only thing the app records.
 *
 * The dental practice bench (`/practice-ar`) is one labelled link away and still
 * works on its own; a dental case's own denied lines appear here too.
 */

import { useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { PipelineProvider, usePipeline, type Role } from "../store/pipelineStore";
import { readActiveTrack } from "../components/shell/activeTrack";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { readDentalTrackRecord } from "../components/dental/DentalTrackStore";
import {
  arAgingTotals,
  buildArRows,
  buildDenialRows,
  buildDentalDenialRows,
  dentalCaseLabel,
  splitDenialRows,
  type RailRow,
} from "../domain/railPages";
import { usd } from "../domain/homeWorkQueues";
import {
  RailEmptyState,
  RailNote,
  RailPageHeader,
  RailRowList,
  RailSection,
  railFooter,
} from "../components/rail/RailPageFrame";

export const Route = createFileRoute("/denials-ar")({
  component: () => (
    <PatientProvider>
      <PipelineProvider>
        <DenialsAndArPage />
      </PipelineProvider>
    </PatientProvider>
  ),
});

function DenialsAndArPage() {
  const navigate = useNavigate();
  const { allEncounters, arWorkItems } = usePipeline();
  const { getPatientById } = usePatientStore();
  const dental = useMemo(() => readDentalTrackRecord(), []);

  const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string => {
    const patient = patientId ? getPatientById(patientId) : undefined;
    if (patient) return `${patient.firstName} ${patient.lastName}`;
    return fallback ?? "No patient attached";
  };

  const encounters = useMemo(() => Object.values(allEncounters), [allEncounters]);

  const denialRows = useMemo(
    () => buildDenialRows({ items: arWorkItems, encounters, nameForPatient }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arWorkItems, encounters, getPatientById],
  );
  const { toWork, appealed } = splitDenialRows(denialRows);

  const arRows = useMemo<RailRow[]>(
    () => buildArRows({ items: arWorkItems, nameForPatient }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [arWorkItems, getPatientById],
  );
  const aging = useMemo(() => arAgingTotals(arWorkItems), [arWorkItems]);

  const dentalDenials = useMemo<RailRow[]>(
    () => buildDentalDenialRows(dental, dentalCaseLabel(dental)),
    [dental],
  );

  const openStage = (patientId: string | null, role: Role) => {
    requestPatientOpen(patientId, undefined, role);
    void navigate({ to: "/" });
  };

  return (
    <AppShell track={readActiveTrack()} activeNav="denials-ar" footer={railFooter}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <RailPageHeader
          icon={AlertTriangle}
          title="Denials and AR"
          purpose="Denied lines to work and the balances still owed, each with its age and follow-up date."
          count={denialRows.length + arRows.length}
          countLabel={
            denialRows.length + arRows.length === 1
              ? "item on this page"
              : "items on this page — denials and AR items"
          }
        />

        <RailSection title="Denials to work" count={toWork.length}>
          {toWork.length === 0 ? (
            <RailEmptyState nextStep="post an 835 from the Biller stage — a denied line of a posted 835 appears here with its group code, CARC and appeal deadline." />
          ) : (
            <RailRowList rows={toWork} onOpenMedical={openStage} />
          )}
        </RailSection>

        <RailSection title="Appealed — awaiting the payer's answer" count={appealed.length}>
          {appealed.length === 0 ? (
            <RailEmptyState nextStep="work a denial and choose Appeal. The money moves onto an appeal record and waits here until the payer answers." />
          ) : (
            <RailRowList rows={appealed} onOpenMedical={openStage} />
          )}
        </RailSection>

        <RailSection title="AR worklist" count={arRows.length}>
          <ul className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {aging.map((bucket) => (
              <li
                key={bucket.bucket}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {bucket.bucket} days
                </p>
                <p className="text-[12px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                  {usd(bucket.cents)}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  {bucket.count} {bucket.count === 1 ? "item" : "items"}
                </p>
              </li>
            ))}
          </ul>

          {arRows.length === 0 ? (
            <RailEmptyState nextStep="post an 835 from the Biller stage. Only posted money creates AR work — a refused line or a patient balance, with an age." />
          ) : (
            <RailRowList rows={arRows} onOpenMedical={openStage} />
          )}
        </RailSection>

        <RailSection title="Dental" count={dentalDenials.length}>
          {dentalDenials.length === 0 ? (
            <RailEmptyState nextStep="transmit an ADA claim from the dental claim stage — its denied lines appear here until you decide them." />
          ) : (
            <RailRowList rows={dentalDenials} onOpenMedical={openStage} />
          )}
        </RailSection>

        <Link
          to="/practice-ar"
          className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:text-brand-300 dark:hover:bg-brand-900/30"
        >
          Open the dental AR practice bench
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>

        <RailNote>
          An item exists only where posted money exists: a denied line of a posted 835, or a patient balance summed
          from the ledger. Clearing one moves money — it never just changes a label. The dental track stops at the
          ledger, so its denials come from that case's adjudication, not from an 835.
        </RailNote>
        </div>
      </div>
    </AppShell>
  );
}
