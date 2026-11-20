/**
 * /coding — the Coding rail page
 *
 * Inspired by: athenahealth's "Coding" worklist and Epic's Professional Billing
 * coding queue — the list a coder opens to see which signed notes are still
 * waiting for codes.
 *
 * Spec `eleven-rail-pages.md` (owner decision, 2026-11-20): the five entries the
 * rail used to hold back are real pages now. This one lists **encounters with a
 * signed and locked note and no submitted codes yet**, newest first, with the
 * count — and every row is read from the student's own saved records:
 *
 *  - the signature is the encounter's own `NOTE_SIGNED` timeline entry, which is
 *    the event the Sign & Lock step writes; a note that was never signed cannot
 *    appear here, and no draft is read as a signature;
 *  - "no submitted codes" is the encounter's own `icdCodes` / `cptCodes` being
 *    empty, which is what the Coder stage fills.
 *
 * A dental case sitting on its Coding stage with no coded lines appears in the
 * same list, marked with its case id, and its row opens the case's own stage.
 *
 * With nothing saved the page says which step fills it (Sign & Lock) instead of
 * showing a sample encounter as if the student had made it.
 */

import { useMemo } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { PipelineProvider, usePipeline, type Role } from "../store/pipelineStore";
import { readActiveTrack } from "../components/shell/activeTrack";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { readDentalTrackRecord } from "../components/dental/DentalTrackStore";
import {
  buildCodingRows,
  buildDentalCodingRow,
  dentalCaseLabel,
  type RailRow,
} from "../domain/railPages";
import {
  RailEmptyState,
  RailNote,
  RailPageHeader,
  RailRowList,
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
  const navigate = useNavigate();
  const { allEncounters } = usePipeline();
  const { getPatientById } = usePatientStore();

  // The dental track keeps its own record; this page reads it, never writes it.
  const dental = useMemo(() => readDentalTrackRecord(), []);

  const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string => {
    const patient = patientId ? getPatientById(patientId) : undefined;
    if (patient) return `${patient.firstName} ${patient.lastName}`;
    return fallback ?? "No patient attached";
  };

  const rows = useMemo<RailRow[]>(() => {
    const medical = buildCodingRows({
      encounters: Object.values(allEncounters),
      nameForPatient,
    });
    const dentalRow = buildDentalCodingRow(dental, dentalCaseLabel(dental));
    return dentalRow ? [dentalRow, ...medical] : medical;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allEncounters, dental, getPatientById]);

  const openStage = (patientId: string | null, role: Role) => {
    requestPatientOpen(patientId, undefined, role);
    void navigate({ to: "/" });
  };

  return (
    <AppShell track={readActiveTrack()} activeNav="coding" footer={railFooter}>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <RailPageHeader
          icon={ClipboardList}
          title="Coding"
          purpose="Signed notes with no codes submitted yet — newest first."
          count={rows.length}
          countLabel={rows.length === 1 ? "encounter waiting for codes" : "encounters waiting for codes"}
        />

        {rows.length === 0 ? (
          <RailEmptyState nextStep="open a patient, write the progress note and press Sign & Lock. A signed note with no codes appears here." />
        ) : (
          <RailRowList rows={rows} onOpenMedical={openStage} />
        )}

        <RailNote>
          Every row is one of your own saved encounters: its note is signed and locked, and the coder has not
          submitted diagnoses or procedures for it yet.
        </RailNote>
      </div>
    </AppShell>
  );
}
