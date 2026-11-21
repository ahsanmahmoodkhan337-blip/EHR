/**
 * /cases/$track/$caseId/$stage — one case stage, at the address the brief names
 *
 * Inspired by: Epic's Chart activity URLs, where the encounter you are in is part
 * of the address. The owner's brief asks for `/cases/:track/:caseId/:stage`
 * (`track` = medical | dental, `stage` = the model's stage id), so a refresh, a
 * bookmark or a shared link lands the student exactly where they were.
 *
 * Spec `phase-1-navigation-addendum.md` item 2. The old per-track addresses
 * (`/medical-cases/$caseId/$stage`, `/dental/$caseId/$stage`) redirect here and
 * keep the case and the stage, so a link saved last week still works.
 *
 * The two runners keep their own stores and their own screens; this route only
 * says which one the track in the URL asks for. A stage id that a track used to
 * carry under another name is translated (`normalizeDentalStageId`), so an old
 * address is not a dead one.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { MedicalCasesPage } from "./medical-cases";
import { DentalTrackPage } from "./dental";
import { normalizeDentalStageId } from "../components/dental/DentalTrackStore";

export type CaseTrack = "medical" | "dental";

export const Route = createFileRoute("/cases/$track/$caseId/$stage")({
  beforeLoad: ({ params }) => {
    // A track that does not exist has no case to open — send them to the list
    // rather than rendering an empty runner.
    if (params.track !== "medical" && params.track !== "dental") {
      throw redirect({ to: "/cases", replace: true });
    }
  },
  component: CaseStageRoute,
});

function CaseStageRoute() {
  const { track, caseId, stage } = Route.useParams();

  // Opening a case does NOT change the student's track (owner item 4: the track
  // must change only when they click the toggle). The runner below draws its own
  // track, because the case is that track's work; the stored choice is untouched
  // and every shared page keeps showing what the student picked.

  if (track === "dental") {
    return <DentalTrackPage caseId={caseId} stage={normalizeDentalStageId(stage)} />;
  }
  return <MedicalCasesPage caseId={caseId} stage={stage} />;
}
