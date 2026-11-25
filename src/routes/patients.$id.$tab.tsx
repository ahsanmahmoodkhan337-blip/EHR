/**
 * /patients/$id/$tab — one tab of the patient hub
 * (`specs/patient-hub.md`)
 *
 * Inspired by: eClinicalWorks' patient hub tabs. Each tab is its own route, so
 * Back works, a tab can be linked and a reload keeps the tab. The section itself
 * is drawn by `components/patients/PatientHubTabs.tsx`, except Insurance and
 * Appointments, which are the sections that landed in #124 and are reused as
 * they are.
 *
 * An unknown tab redirects to Demographics instead of drawing a blank panel, and
 * the panel is labelled by the tab that is selected.
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { usePatientStore } from "../store/patientStore";
import {
  AppointmentsSection,
  InsuranceSection,
} from "../components/patients/PatientHubSections";
import {
  DEFAULT_HUB_TAB,
  DemographicsSection,
  DocumentsSection,
  EncountersSection,
  LedgerSection,
  isHubTab,
  type HubTabId,
} from "../components/patients/PatientHubTabs";

export const Route = createFileRoute("/patients/$id/$tab")({
  beforeLoad: ({ params }) => {
    if (!isHubTab(params.tab)) {
      throw redirect({
        to: "/patients/$id/$tab",
        params: { id: params.id, tab: DEFAULT_HUB_TAB },
      });
    }
  },
  component: HubTabPage,
});

function HubTabPage() {
  const { id, tab } = Route.useParams();
  const { getPatientById } = usePatientStore();
  const patient = getPatientById(id);
  const activeTab = (isHubTab(tab) ? tab : DEFAULT_HUB_TAB) as HubTabId;

  if (!patient) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="text-sm font-bold text-slate-800">No patient on file with that id</h2>
        <Link
          to="/patients"
          className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-brand-900 px-3 text-xs font-semibold text-white hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Choose a patient
        </Link>
      </div>
    );
  }

  return (
    <div
      role="tabpanel"
      id="hub-panel"
      aria-labelledby={`hub-tab-${activeTab}`}
      tabIndex={0}
      className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      {activeTab === "demographics" && <DemographicsSection patient={patient} />}
      {activeTab === "insurance" && <InsuranceSection patient={patient} />}
      {activeTab === "appointments" && <AppointmentsSection patient={patient} />}
      {activeTab === "encounters" && <EncountersSection patient={patient} />}
      {activeTab === "ledger" && <LedgerSection patient={patient} />}
      {activeTab === "documents" && <DocumentsSection patient={patient} />}
    </div>
  );
}
