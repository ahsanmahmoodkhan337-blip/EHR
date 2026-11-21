/**
 * /coding — the coder's queue
 *
 * Inspired by: Epic's coding workqueue — the list of encounters whose notes are
 * signed and whose codes are not done yet, one row per encounter, each row
 * opening that encounter's own Coding screen.
 *
 * Owner's audit, 2026-11-20, item 2: "Coding lists (a) every signed encounter not
 * yet coded and (b) every encounter coded but not yet sent to billing. It
 * currently shows 0 while Emily Chen has a signed note in coding — that is the
 * bug. Clicking a row opens that patient's Coding stage."
 *
 * Both lists come from `domain/codingQueue.ts`, which reads the **pipeline
 * store's** saved encounters (`store/pipelineStore.tsx`, persisted per student by
 * `store/persistence.ts` under `hh_userdata_<phone>`) and nothing else. There is
 * no count kept by hand on this page, and no demo row: an empty list means the
 * student's records are empty, and the page says which stage produces the first
 * row.
 *
 * Each row is the address `/encounter/<encounterId>/coding` — the same screen the
 * stepper opens — so a row is never a dead end and a refresh keeps the student
 * there.
 *
 * The dental track keeps its own record; this page reads it and never writes it.
 */

import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { PipelineProvider, usePipeline, type Role } from "../store/pipelineStore";
import { readActiveTrack } from "../components/shell/activeTrack";
import { readDentalTrackRecord } from "../components/dental/DentalTrackStore";
import { buildCodingQueue, type NameForPatient } from "../domain/codingQueue";
import { buildDentalCodingRow, dentalCaseLabel, type RailRow } from "../domain/railPages";
import {
  RailEmptyState,
  RailNote,
  RailPageHeader,
  RailRowList,
  RailSection,
  railFooter,
} from "../components/rail/RailPageFrame";

export const Route = createFileRoute("/coding")({
  component: () => (
    <PatientProvider>
      <PipelineProvider>
        <CodingPage />
      </PipelineProvider>
    </PatientProvider>
  ),
});

function CodingPage() {
  const { allEncounters } = usePipeline();
  const { getPatientById } = usePatientStore();

  // The dental track keeps its own record; this page reads it, never writes it.
  const dental = useMemo(() => readDentalTrackRecord(), []);

  const nameForPatient: NameForPatient = (patientId, fallback) => {
    const patient = patientId ? getPatientById(patientId) : undefined;
    if (patient) return `${patient.firstName} ${patient.lastName}`;
    return fallback ?? "No patient attached";
  };

  const queue = useMemo(
    () => buildCodingQueue({ encounters: Object.values(allEncounters), nameForPatient }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEncounters, getPatientById],
  );

  const dentalRow: RailRow | null = useMemo(
    () => buildDentalCodingRow(dental, dentalCaseLabel(dental)),
    [dental],
  );

  // The dental row has its own address already; it opens the case's own stage.
  const openStage = (_patientId: string | null, _role: Role) => {};

  const total = queue.total + (dentalRow ? 1 : 0);

  return (
    <AppShell track={readActiveTrack()} activeNav="coding" footer={railFooter}>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-8">
          <RailPageHeader
            icon={ClipboardList}
            title="Coding"
            purpose="Signed notes waiting for codes, and coded encounters not yet sent to Billing — newest first."
            count={total}
            countLabel={total === 1 ? "encounter waiting for the coder" : "encounters waiting for the coder"}
          />

          {total === 0 ? (
            <RailEmptyState nextStep="open a patient, write the progress note and press Sign & Lock. A signed note with no codes appears here." />
          ) : (
            <>
              <RailSection title="Signed, not coded" count={queue.signedNotCoded.length}>
                {queue.signedNotCoded.length === 0 ? (
                  <RailEmptyState nextStep="sign and lock a progress note; it appears here until its codes are submitted." />
                ) : (
                  <RailRowList rows={queue.signedNotCoded} onOpenMedical={openStage} />
                )}
              </RailSection>

              <RailSection title="Coded, not yet sent to Billing" count={queue.codedNotBilled.length}>
                {queue.codedNotBilled.length === 0 ? (
                  <RailEmptyState nextStep="submit diagnoses and procedures on a signed note; it stays here until its claim is created in Billing." />
                ) : (
                  <RailRowList rows={queue.codedNotBilled} onOpenMedical={openStage} />
                )}
              </RailSection>

              {dentalRow && (
                <RailSection title="Dental track" count={dentalRow ? 1 : 0}>
                  <RailRowList rows={[dentalRow]} onOpenMedical={openStage} />
                </RailSection>
              )}
            </>
          )}

          <RailNote>
            Every row is one of your own saved encounters, read from your records: its note is signed and
            locked, and the coder has either not submitted codes yet or has not sent the coded visit to
            Billing. A row opens that patient's Coding stage.
          </RailNote>
        </div>
      </div>
    </AppShell>
  );
}
