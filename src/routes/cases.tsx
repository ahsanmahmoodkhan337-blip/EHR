/**
 * /cases — the case list, at its own address
 *
 * Inspired by: the case library a certification course hands a student — every
 * graded case in one list, with what it teaches and how long it takes, before
 * any of the work starts.
 *
 * Spec `phase-1-navigation.md` item 6: a real case list lives here, and both the
 * "Case list" button and the "Case" step of a case's stepper land on it. The
 * old `/medical-cases` and `/dental` addresses redirect here, so a bookmark or a
 * link a student saved still works.
 *
 * Two tracks side by side, because both revenue cycles are one product. A card
 * links to that case's briefing URL: the runner reads the URL, selects the case
 * and opens the briefing, so nothing here has to reach into a case store.
 *
 * STANDING-RULES 6: a card prints the case's setup — specialty, difficulty,
 * payer, minutes — never the trap, the expected action or the answer.
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Phone, Smile, Stethoscope } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { findPlan, MEDICAL_CASE_SCENARIOS } from "../data/medical";
import { DENTAL_CASE_SCENARIOS, findPlan as findDentalPlan } from "../data/dental";

export const Route = createFileRoute("/cases")({
  component: CasesPage,
});

function difficultyTone(difficulty: string): string {
  return difficulty === "beginner"
    ? "bg-emerald-50 text-emerald-700"
    : difficulty === "intermediate"
      ? "bg-amber-50 text-amber-700"
      : "bg-red-50 text-red-700";
}

function CasesPage() {
  return (
    <AppShell
      track="medical"
      activeNav="practice-cases"
      footer={
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          Healthcare Hustlers EHR Simulation — built for healthcare education. All patients, payers and
          fees are fictional.
        </footer>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <h1 className="text-sm font-bold text-slate-800">Practice Cases</h1>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Every graded case runs the same eight stages — Front Desk, Chart, Coding, Prior Auth, Claim,
          Remittance, AR, Debrief. Pick one to begin.
        </p>

        {/* ── Medical ─────────────────────────────────────────────────── */}
        <section aria-labelledby="cases-medical" className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <Stethoscope className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <h2 id="cases-medical" className="text-xs font-bold uppercase tracking-wide text-blue-700">
              Medical RCM
            </h2>
            <span className="text-[10px] font-medium text-blue-600">CPT / ICD-10 · CMS-1500</span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MEDICAL_CASE_SCENARIOS.map((scenario) => {
              const plan = findPlan(scenario.planId);
              return (
                <li
                  key={scenario.id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${difficultyTone(scenario.difficulty)}`}>
                      {scenario.difficulty}
                    </span>
                    <span className="text-[10px] text-slate-400">~{scenario.estimatedMinutes} min</span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-800">{scenario.title}</h3>
                  <p className="mt-1 flex-1 text-[11px] leading-relaxed text-slate-500">
                    {scenario.briefing}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {scenario.id} · {scenario.specialty}
                    {plan ? ` · ${plan.name}` : ""}
                  </p>
                  <Link
                    to="/cases/$track/$caseId/$stage"
                    params={{ track: "medical", caseId: scenario.id, stage: "briefing" }}
                    className="mt-3 flex min-h-10 items-center justify-center gap-1 rounded-lg bg-blue-700 px-3 text-xs font-semibold text-white hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Begin case <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ── Dental ──────────────────────────────────────────────────── */}
        <section aria-labelledby="cases-dental" className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <Smile className="h-4 w-4 shrink-0 text-teal-600" aria-hidden="true" />
            <h2 id="cases-dental" className="text-xs font-bold uppercase tracking-wide text-teal-700">
              Dental RCM
            </h2>
            <span className="text-[10px] font-medium text-teal-600">CDT · ADA J430D</span>
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50/60 p-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Practice AR</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Seven premade denials, already adjudicated. No case to start, no coding first, and
                nothing a graded case can see.
              </p>
            </div>
            <Link
              to="/practice-ar"
              className="flex min-h-10 items-center gap-1 rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Practice AR
            </Link>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {DENTAL_CASE_SCENARIOS.map((scenario) => {
              const plan = findDentalPlan(scenario.planId);
              return (
                <li
                  key={scenario.id}
                  className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase ${difficultyTone(scenario.difficulty)}`}>
                      {scenario.difficulty}
                    </span>
                    <span className="text-[10px] text-slate-400">~{scenario.estimatedMinutes} min</span>
                  </div>
                  <h3 className="mt-2 text-sm font-bold text-slate-800">{scenario.title}</h3>
                  <p className="mt-1 flex-1 text-[11px] leading-relaxed text-slate-500">
                    {scenario.briefing}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-400">
                    {scenario.id}
                    {plan ? ` · ${plan.payerName} · ${plan.planName}` : ""}
                  </p>
                  <Link
                    to="/cases/$track/$caseId/$stage"
                    params={{ track: "dental", caseId: scenario.id, stage: "briefing" }}
                    className="mt-3 flex min-h-10 items-center justify-center gap-1 rounded-lg bg-teal-700 px-3 text-xs font-semibold text-white hover:bg-teal-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
                  >
                    Begin case <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
