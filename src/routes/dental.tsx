/**
 * Dental RCM Track — standalone route
 *
 * Inspired by: the owner-required separation between the medical and dental RCM
 * tracks. The dental track is independently accessible at /dental and never
 * imports from the medical stage components. It wraps the dental track store
 * and case runner inside the one application shell (spec
 * `task-1-app-shell.md` item 1) — the same sidebar, top bar and patient search
 * every other page uses, instead of a header of its own.
 *
 * Every stage has its own address (item 4), the same way the medical track does:
 *   /dental                              the case picker
 *   /dental/DCASE-001/coding             one case, one stage
 */

import { useCallback, useMemo } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Smile } from "lucide-react";
import { isLoggedIn } from "../store/accessStore";
import { PatientProvider } from "../store/patientStore";
import { findPlan } from "../data/dental";
import {
  DentalTrackProvider,
  DENTAL_STAGE_ORDER,
  useDentalTrack,
  type DentalStageName,
} from "../components/dental/DentalTrackStore";
import { DentalCaseRunner, DENTAL_STAGE_LABEL } from "../components/dental/DentalCaseRunner";
import { AppShell } from "../components/AppShell";
import { ReferenceDrawer } from "../components/shell/ReferenceDrawer";
import { dentalReferenceTabs } from "../components/shell/referenceTabs";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import { LockedStageNotice, useStageUrlSync } from "../components/shell/useStageUrlSync";
import type { CaseStageParams } from "./medical-cases";

/**
 * The dental case list lives on `/cases` with the medical one now (spec
 * `phase-1-navigation.md` item 6). This address redirects so no bookmarked URL
 * dies; the dental runner keeps its own per-stage addresses below it.
 */
export const Route = createFileRoute("/dental")({
  beforeLoad: () => {
    throw redirect({ to: "/cases", replace: true });
  },
});

export function DentalTrackPage({ caseId, stage }: CaseStageParams = {}) {
  return (
    <PatientProvider>
      <DentalTrackProvider>
        <DentalTrackShell urlCaseId={caseId} urlStage={stage} />
      </DentalTrackProvider>
    </PatientProvider>
  );
}

function DentalTrackShell({ urlCaseId, urlStage }: { urlCaseId?: string; urlStage?: string }) {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();
  const { state, activeCase, selectCase, goTo } = useDentalTrack();

  const goToStage = useCallback(
    (caseId: string, stage: string, replace = false) => {
      void navigate({ to: "/dental/$caseId/$stage", params: { caseId, stage }, replace });
    },
    [navigate],
  );
  const goToBase = useCallback(() => {
    void navigate({ to: "/dental", replace: true });
  }, [navigate]);

  const { blockedStage, dismissBlocked } = useStageUrlSync({
    urlCaseId,
    urlStage,
    caseId: state.caseId,
    stage: state.stage,
    furthestStage: state.furthestStage,
    stageIds: DENTAL_STAGE_ORDER,
    freshCaseStage: "briefing",
    selectCase,
    goTo: (next) => goTo(next as DentalStageName),
    goToStage,
    goToBase,
  });

  if (!loggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Smile className="mx-auto mb-3 h-8 w-8 text-teal-500" />
          <h1 className="text-sm font-bold text-slate-800">Dental RCM Track</h1>
          <p className="mt-1 text-xs text-slate-500">Log in to practice the dental revenue cycle.</p>
          <Link
            to="/login"
            className="mt-4 inline-block rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  // The same four reference panels the medical track gets (spec item 6), read
  // from the dental case: note, card, plan rules and the CDT lookup.
  const referenceTabs = useMemo(() => {
    if (!activeCase) return [];
    return dentalReferenceTabs(activeCase, findPlan(activeCase.planId));
  }, [activeCase]);

  return (
    <AppShell
      track="dental"
      activeNav="practice-cases"
      reference={
        referenceTabs.length > 0 ? (
          <ReferenceDrawer tabs={referenceTabs} accent="teal" label="Case reference" />
        ) : undefined
      }
      onPatientSelect={(patientId) => {
        // The dental track has no patient workspace of its own: open the chart
        // in the medical workspace, where the patient record lives.
        requestPatientOpen(patientId);
        void navigate({ to: "/" });
      }}
    >
      {blockedStage && (
        <LockedStageNotice
          stageLabel={DENTAL_STAGE_LABEL[blockedStage as keyof typeof DENTAL_STAGE_LABEL] ?? blockedStage}
          onDismiss={dismissBlocked}
        />
      )}
      <div className="min-h-0 flex-1 overflow-hidden">
        <DentalCaseRunner />
      </div>
    </AppShell>
  );
}
