/**
 * EncounterLiveView — the live tracker, the "what just happened" card and the
 * activity drawer for the open encounter, wired to the records they read.
 *
 * Kept out of routes/index.tsx: it gathers its own inputs (the pipeline's
 * encounter, the AR queue, the patient's appointment and 271) so the workspace
 * only has to place it under the stage stepper.
 */

import { useMemo, useState } from "react";
import { usePipeline } from "../../store/pipelineStore";
import { useAllAppointments } from "../../store/ehrStore";
import type { Patient } from "../../store/patientStore";
import { noteSignedAt } from "../../domain/noteStatus";
import { liveMilestones, liveMoney } from "../../domain/liveTracker";
import { TUTORIAL_PATIENT_ID } from "../../domain/tutorialIdentity";
import { LiveTracker } from "./LiveTracker";
import { LiveEventCard } from "./LiveEventCard";
import { ActivityDrawer } from "./ActivityDrawer";

export function EncounterLiveView({ patient }: { patient: Patient }) {
  const { state, arWorkItems } = usePipeline();
  const appointments = useAllAppointments();
  const [activityOpen, setActivityOpen] = useState(false);

  const events = useMemo(
    () => (state.statusEvents ?? []).filter((e) => !e.patientId || e.patientId === patient.id),
    [state.statusEvents, patient.id],
  );

  const appointment = useMemo(() => {
    const own = appointments.filter((a) => a.patientId === patient.id);
    return own.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1))[0];
  }, [appointments, patient.id]);

  const remittance = (state.remittances ?? []).find((r) => r.claimNumber === state.claimNumber) ?? (state.remittances ?? [])[0];
  const claimChargeCents = Math.round(
    (state.claimForm?.serviceLines ?? []).reduce(
      (sum, l) => sum + (Number(l.charge) || 0) * (Number(l.units) > 0 ? Number(l.units) : 1),
      0,
    ) * 100,
  );
  const openArItems = arWorkItems.filter(
    (i) => i.patientId === patient.id && i.status !== "resolved",
  ).length;

  const milestones = liveMilestones({
    // The Tutorial Patient is a finished reference visit: they arrived long ago,
    // so the tracker does not send the student to the Schedule to check them in.
    appointmentStatus: appointment?.status ?? (patient.id === TUTORIAL_PATIENT_ID ? "completed" : null),
    eligibility: patient.insuranceRecord?.primary?.eligibility ?? null,
    signedAt: noteSignedAt(state),
    cptCodes: state.cptCodes ?? [],
    events,
    ledger: state.ledger ?? [],
    openArItems,
    claimNumber: state.claimNumber,
  });
  const money = liveMoney({
    ledger: state.ledger ?? [],
    claimChargeCents,
    remitAllowedCents: remittance ? remittance.totals.allowedCents : null,
  });

  return (
    <>
      <LiveTracker
        milestones={milestones}
        money={money}
        activityCount={events.length}
        referenceChart={patient.id === TUTORIAL_PATIENT_ID}
        onOpenActivity={() => setActivityOpen(true)}
      />
      <LiveEventCard events={events} scopeKey={patient.id} onOpenActivity={() => setActivityOpen(true)} />
      <ActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        events={events}
        subject={state.claimNumber || undefined}
      />
    </>
  );
}
