/**
 * /encounter/$encounterId/$stage — one stage of one patient's encounter
 *
 * Inspired by: Epic Hyperspace's Chart activity, where the encounter you are in
 * has one address per activity and a refresh puts you back in it.
 *
 * Owner's audit, 2026-11-20, item 2. This is the real address of the medical
 * encounter's seven stages (`domain/encounterFlow.ts`):
 *
 *   /encounter/MPT-2001/progress-note · /sign-lock · /coding · /prior-auth
 *   /billing · /payments · /denials-ar
 *
 * It draws the same workspace Home draws — one component, so the stepper, the
 * patient banner and the Medical track are the same on a pasted link as on the
 * screen the student walked to. The address's encounter and stage are handed to
 * that workspace, which opens them once after the patient's own session has
 * loaded (an explicit address beats the session's remembered screen).
 *
 * A stage this build does not know is not an address: the student is redirected
 * to the stage the encounter opens on, and the bad address never stays in the
 * bar. Nothing is written to the record by a redirect.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { Home } from "./index";
import { ToastProvider } from "../components/Toast";
import { PatientProvider } from "../store/patientStore";
import { PipelineProvider } from "../store/pipelineStore";
import { flowStage } from "../domain/encounterFlow";
import { openingStageId } from "../domain/encounterRoute";

export const Route = createFileRoute("/encounter/$encounterId/$stage")({
  beforeLoad: ({ params }) => {
    if (flowStage(params.stage)) return;
    // An unknown stage: open the stage the encounter starts on, replacing the
    // bad address rather than pushing a history entry for it.
    throw redirect({
      to: "/encounter/$encounterId/$stage",
      params: { encounterId: params.encounterId, stage: openingStageId() },
      replace: true,
    });
  },
  component: EncounterStage,
});

function EncounterStage() {
  const { encounterId, stage } = Route.useParams();
  return (
    <ToastProvider>
      <PatientProvider>
        <PipelineProvider>
          <Home encounterIdFromRoute={encounterId} stageFromRoute={stage} />
        </PipelineProvider>
      </PatientProvider>
    </ToastProvider>
  );
}
