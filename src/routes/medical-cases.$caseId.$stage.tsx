/**
 * /medical-cases/$caseId/$stage — the old medical case-stage address
 *
 * Inspired by: Epic's Chart activity URLs. The brief's shape is
 * `/cases/:track/:caseId/:stage` now (`phase-1-navigation-addendum.md` item 2),
 * so this address redirects there and keeps both the case and the stage: a
 * bookmark from last week lands on the same stage of the same case.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/medical-cases/$caseId/$stage")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/cases/$track/$caseId/$stage",
      params: { track: "medical", caseId: params.caseId, stage: params.stage },
      replace: true,
    });
  },
});
