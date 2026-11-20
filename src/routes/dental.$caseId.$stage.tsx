/**
 * /dental/$caseId/$stage — the old dental case-stage address
 *
 * Inspired by: Epic's Chart activity URLs. The brief's shape is
 * `/cases/:track/:caseId/:stage` now (`phase-1-navigation-addendum.md` item 2),
 * so this address redirects there and keeps both the case and the stage.
 *
 * The stage is translated on the way through: the two dental steps that used to
 * sit outside the eight-stage model are now `claim` and `remittance`, so a
 * bookmark to `/dental/DCASE-001/ledger` lands on Remittance, not on a stage id
 * that no longer exists.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { normalizeDentalStageId } from "../components/dental/DentalTrackStore";

export const Route = createFileRoute("/dental/$caseId/$stage")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/cases/$track/$caseId/$stage",
      params: { track: "dental", caseId: params.caseId, stage: normalizeDentalStageId(params.stage) },
      replace: true,
    });
  },
});
