/**
 * /dental/$caseId/$stage — one dental case stage at its own address
 *
 * Inspired by: Epic's Chart activity URLs, where the encounter you are in is
 * part of the address. It renders the same dental case-runner page as /dental;
 * the params only tell the runner which case and stage to open, so a refresh,
 * a bookmark or a shared link lands the student exactly there.
 */

import { createFileRoute } from "@tanstack/react-router";
import { DentalTrackPage } from "./dental";

export const Route = createFileRoute("/dental/$caseId/$stage")({
  component: DentalCaseStageRoute,
});

function DentalCaseStageRoute() {
  const { caseId, stage } = Route.useParams();
  return <DentalTrackPage caseId={caseId} stage={stage} />;
}
