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

import { useEffect } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { MedicalCasesPage } from "./medical-cases";
import { DentalTrackPage } from "./dental";
import { normalizeDentalStageId } from "../components/dental/DentalTrackStore";
import { setActiveTrack } from "../components/shell/activeTrack";

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

  // Opening a case is also choosing its track: the case list the student comes
  // back to is the one this case belongs to, not whichever track was last used.
  useEffect(() => {
    if (track === "medical" || track === "dental") setActiveTrack(track);
  }, [track]);

  if (track === "dental") {
    return <DentalTrackPage caseId={caseId} stage={normalizeDentalStageId(stage)} />;
  }
  return <MedicalCasesPage caseId={caseId} stage={stage} />;
}
