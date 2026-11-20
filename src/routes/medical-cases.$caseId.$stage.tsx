/**
 * /medical-cases/$caseId/$stage — one medical case stage at its own address
 *
 * Inspired by: Epic's Chart activity URLs, where the encounter you are in is
 * part of the address. It renders the same case-runner page as /medical-cases;
 * the params only tell the runner which case and stage to open, so a refresh,
 * a bookmark or a shared link lands the student exactly there.
 */

import { createFileRoute } from "@tanstack/react-router";
import { MedicalCasesPage } from "./medical-cases";

export const Route = createFileRoute("/medical-cases/$caseId/$stage")({
  component: MedicalCaseStageRoute,
});

function MedicalCaseStageRoute() {
  const { caseId, stage } = Route.useParams();
  return <MedicalCasesPage caseId={caseId} stage={stage} />;
}
