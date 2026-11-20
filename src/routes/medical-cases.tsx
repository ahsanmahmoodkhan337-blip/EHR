/**
 * Medical Cases — standalone case-runner route
 *
 * Inspired by: the dental track's /dental route. The medical case-runner is
 * independently accessible at /medical-cases and never imports from the
 * free-form medical pipeline store — it runs its own graded case spine on the
 * MEDICAL_CASE_SCENARIOS data. It wraps the medical case store and runner.
 *
 * Every stage has its own address (spec `task-1-app-shell.md` item 4):
 *   /medical-cases                       the case picker
 *   /medical-cases/MCASE-001/coding      one case, one stage
 * so a refresh, a bookmark or the browser's back button lands the student on the
 * stage they were working in. Both addresses render this same page; the params
 * are handed to the shared URL ⇄ store sync.
 */

import { useCallback, useMemo } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Stethoscope } from "lucide-react";
import { isLoggedIn } from "../store/accessStore";
import { PatientProvider } from "../store/patientStore";
import {
  MedicalCaseProvider,
  MEDICAL_STAGE_ORDER,
  useMedicalCase,
  type MedicalCaseStageName,
} from "../components/medical/MedicalCaseStore";
import { MedicalCaseRunner, MEDICAL_STAGE_LABEL } from "../components/medical/MedicalCaseRunner";
import { AppShell } from "../components/AppShell";
import { PatientBanner, type BannerPatient } from "../components/shell/PatientBanner";
import { ReferenceDrawer } from "../components/shell/ReferenceDrawer";
import { medicalReferenceTabs } from "../components/shell/referenceTabs";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { LockedStageNotice, useStageUrlSync } from "../components/shell/useStageUrlSync";

/**
 * The case list has its own page now (`/cases`, spec `phase-1-navigation.md`
 * item 6). This address is kept only so a bookmark, a shared link or a saved
 * "Case list" click still lands somewhere real instead of on a 404.
 */
export const Route = createFileRoute("/medical-cases")({
  beforeLoad: () => {
    throw redirect({ to: "/cases", replace: true });
  },
});

/** URL params when the page is rendered by the per-stage route. */
export interface CaseStageParams {
  caseId?: string;
  stage?: string;
}

export function MedicalCasesPage({ caseId, stage }: CaseStageParams = {}) {
  return (
    <PatientProvider>
      <MedicalCaseProvider>
        <MedicalCasesShell urlCaseId={caseId} urlStage={stage} />
      </MedicalCaseProvider>
    </PatientProvider>
  );
}

function MedicalCasesShell({ urlCaseId, urlStage }: { urlCaseId?: string; urlStage?: string }) {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  // The graded case's own patient record — the patient this runner is working.
  const { state, activeCase, plan, selectCase, goTo } = useMedicalCase();

  const goToStage = useCallback(
    (caseId: string, stage: string, replace = false) => {
      void navigate({
        to: "/cases/$track/$caseId/$stage",
        params: { track: "medical", caseId, stage },
        replace,
      });
    },
    [navigate],
  );
  const goToBase = useCallback(() => {
    void navigate({ to: "/cases", replace: true });
  }, [navigate]);

  // Keep the address and the case record in step (refresh, back/forward, and a
  // stage the student has not unlocked yet).
  const { blockedStage, dismissBlocked } = useStageUrlSync({
    urlCaseId,
    urlStage,
    caseId: state.caseId,
    stage: state.stage,
    furthestStage: state.furthestStage,
    stageIds: MEDICAL_STAGE_ORDER,
    freshCaseStage: "briefing",
    selectCase,
    goTo: (next) => goTo(next as MedicalCaseStageName),
    goToStage,
    goToBase,
  });

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Stethoscope className="mx-auto mb-3 h-8 w-8 text-blue-500" />
          <h1 className="text-sm font-bold text-slate-800">Medical RCM Cases</h1>
          <p className="mt-1 text-xs text-slate-500">Log in to practice the graded medical revenue cycle.</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  // The case's patient is the patient the runner is working, so the shell's
  // sticky banner shows them for as long as a case is open. Only what the case
  // actually recorded is passed; the rest prints as "—" rather than being made
  // up. Nothing from the free-form chart leaks in here.
  const casePatient: BannerPatient | null = activeCase
    ? {
        firstName: activeCase.patient.firstName,
        lastName: activeCase.patient.lastName,
        dateOfBirth: activeCase.patient.dateOfBirth,
        gender: activeCase.patient.gender,
        insurance: plan?.name,
        insuranceRecord: plan
          ? { primary: { payerName: plan.name, subscriberId: activeCase.patient.memberId } }
          : undefined,
      }
    : null;

  // The drawer's four panels (chart note, insurance card, payer policy, code
  // reference) are rebuilt only when the open case changes, so switching tabs
  // never re-renders the work area.
  const referenceTabs = useMemo(
    () => (activeCase ? medicalReferenceTabs(activeCase, plan) : []),
    [activeCase, plan],
  );

  return (
    <AppShell
      track="medical"
      activeNav="practice-cases"
      banner={<PatientBanner patient={casePatient} />}
      reference={
        referenceTabs.length > 0 ? (
          <ReferenceDrawer tabs={referenceTabs} accent="blue" label="Case reference" />
        ) : undefined
      }
      onPatientSelect={(patientId) => {
        // Graded cases run inside this runner; a patient picked from the
        // shell's search opens in the free-form medical workspace instead.
        requestPatientOpen(patientId);
        void navigate({ to: "/" });
      }}
    >
      {blockedStage && (
        <LockedStageNotice
          stageLabel={MEDICAL_STAGE_LABEL[blockedStage as keyof typeof MEDICAL_STAGE_LABEL] ?? blockedStage}
          onDismiss={dismissBlocked}
        />
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        <MedicalCaseRunner />
      </div>
    </AppShell>
  );
}
