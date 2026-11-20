/**
 * /patients/$id — the patient hub's frame
 * (`specs/patient-hub.md`, Phase 1)
 *
 * Inspired by: eClinicalWorks' patient hub, where one patient is a tabbed
 * screen — demographics, insurance, appointments, encounters, ledger,
 * documents — and the banner above it is the same patient on every tab.
 *
 * This file is the layout only: the patient banner, the tab bar and the
 * scrollable area the tab's own panel draws into. It renders no section itself
 * and it has no rail item of its own — the rail's Patients page links here, and
 * that is the only way in (owner: "no new rail buttons").
 *
 * Each tab is a real route (`/patients/:id/insurance` …), so Back works, a tab
 * can be linked, and reloading keeps the tab. The tab bar keeps the tablist
 * roles and moves with the arrow keys, Home/End and `[` / `]`.
 */

import { useMemo, type KeyboardEvent } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, UserRound } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { PatientBanner, type BannerPatient } from "../components/shell/PatientBanner";
import { PatientProvider, usePatientStore } from "../store/patientStore";
import { PipelineProvider, usePipeline } from "../store/pipelineStore";
import { useAllAppointments } from "../store/ehrStore";
import { postedCopayForPatient } from "../domain/checkIn";
import { ledgerBalance } from "../domain/ledger";
import { HUB_TABS, type HubTabId } from "../components/patients/PatientHubTabs";

export const Route = createFileRoute("/patients/$id")({
  component: () => (
    <PatientProvider>
      <PipelineProvider>
        <PatientHubLayout />
      </PipelineProvider>
    </PatientProvider>
  ),
});

const footer = (
  <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
    Healthcare Hustlers EHR Simulation — built for healthcare education. All patients, payers and fees are
    fictional.
  </footer>
);

function PatientHubLayout() {
  const { id } = Route.useParams();
  const { getPatientById } = usePatientStore();
  const { getEncounter } = usePipeline();
  const appointments = useAllAppointments();
  const patient = getPatientById(id);

  // The copay the desk collected and the balance the ledger holds are read back
  // off the records that wrote them, so the banner cannot drift from the tabs.
  const copayUsd = postedCopayForPatient(appointments, patient?.id)?.copayUsd;
  const ledger = getEncounter(id)?.ledger ?? [];
  const patientBalance = ledger.length > 0 ? ledgerBalance(ledger).patientBalanceCents / 100 : undefined;

  const banner: BannerPatient | null = patient
    ? {
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        allergies: (patient.allergies ?? []).map((allergy) => ({
          allergen: allergy.allergen,
          severity: allergy.severity,
        })),
        insurance: patient.insurance,
        insuranceRecord: patient.insuranceRecord,
        primaryCareProvider: patient.primaryCareProvider,
      }
    : null;

  return (
    <AppShell
      track={patient?.track === "dental" ? "dental" : "medical"}
      activeNav="patients"
      banner={<PatientBanner patient={banner} copayUsd={copayUsd} patientBalance={patientBalance} />}
      footer={footer}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Link
            to="/patients"
            className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Patients
          </Link>
          <UserRound className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
          <h1 className="text-sm font-bold text-slate-800">
            {patient ? `${patient.firstName} ${patient.lastName}` : "Patient hub"}
          </h1>
          {patient && <p className="text-[11px] text-slate-500">MRN {patient.mrn || "—"}</p>}
        </div>

        {!patient ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
            <h2 className="text-sm font-bold text-slate-800">No patient on file with that id</h2>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-slate-500">
              The chart you asked for is not on this device. Choose a patient on Patients — the one you were
              working stays exactly as you left it.
            </p>
            <Link
              to="/patients"
              className="mt-3 inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Choose a patient
            </Link>
          </div>
        ) : (
          <>
            <HubTabBar patientId={patient.id} />
            <div className="mt-3">
              <Outlet />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

/**
 * The six tabs. They are links to real routes, wearing the tab roles the spec
 * asks for: the active tab is the only one in the tab order, and the arrow
 * keys, Home/End and `[` / `]` move between them.
 */
function HubTabBar({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const active = useActiveTab();

  const go = (tab: HubTabId) => {
    void navigate({ to: "/patients/$id/$tab", params: { id: patientId, tab } });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = HUB_TABS.findIndex((tab) => tab.id === active);
    const at = index === -1 ? 0 : index;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "]") next = (at + 1) % HUB_TABS.length;
    else if (event.key === "ArrowLeft" || event.key === "[")
      next = (at - 1 + HUB_TABS.length) % HUB_TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = HUB_TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    go(HUB_TABS[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label="Patient hub"
      onKeyDown={onKeyDown}
      className="flex flex-nowrap gap-1 overflow-x-auto border-b border-slate-200 [scrollbar-width:thin]"
    >
      {HUB_TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            to="/patients/$id/$tab"
            params={{ id: patientId, tab: tab.id }}
            role="tab"
            id={`hub-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls="hub-panel"
            tabIndex={selected ? 0 : -1}
            className={`inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-t-lg px-3 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
              selected
                ? "border-b-2 border-brand-600 text-brand-700"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * The tab the URL is on. Read from the router's location rather than from a
 * child's params, because the layout is the parent route and does not own
 * `$tab`.
 */
function useActiveTab(): HubTabId {
  const path = useRouterState({ select: (state) => state.location.pathname });
  return useMemo(() => {
    const segment = path.split("/").filter(Boolean).pop() ?? "";
    return (HUB_TABS.find((tab) => tab.id === segment)?.id ?? HUB_TABS[0].id) as HubTabId;
  }, [path]);
}
