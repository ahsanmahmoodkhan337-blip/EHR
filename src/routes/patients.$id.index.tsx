/**
 * /patients/$id — landing tab
 * (`specs/patient-hub.md`)
 *
 * The hub's address without a tab opens Demographics, the first tab in the
 * owner's order. It redirects rather than drawing a seventh panel, so the URL a
 * student copies is always one of the six real tabs.
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { DEFAULT_HUB_TAB } from "../components/patients/PatientHubTabs";

export const Route = createFileRoute("/patients/$id/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/patients/$id/$tab",
      params: { id: params.id, tab: DEFAULT_HUB_TAB },
    });
  },
});
