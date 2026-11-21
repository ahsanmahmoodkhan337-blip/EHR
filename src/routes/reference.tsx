/**
 * /reference — the reference page, at its own address
 *
 * Inspired by: the payer-policy binder and code book a coder keeps beside the
 * work, and by Epic's "reference" side panel — but as a page a student can open
 * from the rail without a case running.
 *
 * Two things live here, both lookups and neither an answer key (STANDING-RULES
 * 6): the teaching code sets (CPT / ICD-10 / CDT) and the single CARC table
 * (`src/data/claims/carc.ts`). A case's own payer policy and insurance card stay
 * in the reference drawer beside the case, where they belong to that patient.
 */

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeDollarSign, BookMarked } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { useActiveTrack } from "../components/shell/activeTrack";
import { CodeLookup } from "../components/shell/referenceTabs";
import { CARC_CODES, CARC_GROUP_MEANINGS, type CarcGroup } from "../data/claims/carc";

export const Route = createFileRoute("/reference")({
  component: ReferencePage,
});

const GROUPS: CarcGroup[] = ["CO", "PR", "OA", "PI"];

function ReferencePage() {
  const track = useActiveTrack();
  const [scope, setScope] = useState<"medical" | "dental">("medical");
  const [group, setGroup] = useState<CarcGroup | "all">("all");

  const codes = group === "all" ? CARC_CODES : CARC_CODES.filter((c) => c.group === group);

  return (
    <AppShell
      track={track}
      activeNav="reference"
      footer={
        <footer className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-400">
          Healthcare Hustlers EHR Simulation — built for healthcare education. Code descriptions are
          paraphrased teaching wording; the identifiers are real.
        </footer>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <h1 className="text-sm font-bold text-slate-800">Reference</h1>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Look up what a code means. Nothing here tells you which code a case expects.
        </p>

        {/* ── Code sets ────────────────────────────────────────────────── */}
        <section aria-labelledby="reference-codes" className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <BookMarked className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            <h2 id="reference-codes" className="text-xs font-bold uppercase tracking-wide text-slate-700">
              Code sets
            </h2>
            <div className="ml-auto flex gap-1" role="group" aria-label="Which code set to look up">
              {(["medical", "dental"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setScope(option)}
                  aria-pressed={scope === option}
                  className={`min-h-10 rounded-lg px-3 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                    scope === option
                      ? "bg-brand-600 text-white"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {option === "medical" ? "CPT + ICD-10" : "CDT"}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 text-[11px]">
            <CodeLookup scope={scope} />
          </div>
        </section>

        {/* ── CARC table ───────────────────────────────────────────────── */}
        <section aria-labelledby="reference-carc" className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeDollarSign className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            <h2 id="reference-carc" className="text-xs font-bold uppercase tracking-wide text-slate-700">
              Claim adjustment reason codes
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            The group letter is the money answer: CO is a provider write-off, PR is the patient&rsquo;s,
            OA is another payer&rsquo;s share, PI is payer-initiated.
          </p>

          <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Filter reason codes by group">
            {(["all", ...GROUPS] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGroup(option)}
                aria-pressed={group === option}
                className={`min-h-10 rounded-lg px-3 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  group === option
                    ? "bg-slate-800 text-white"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option === "all" ? "All groups" : option}
              </button>
            ))}
          </div>

          <dl className="mt-2 grid gap-1 sm:grid-cols-2">
            {GROUPS.map((g) => (
              <div key={g} className="rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600">
                <dt className="inline font-bold">{g}</dt>{" "}
                <dd className="inline">{CARC_GROUP_MEANINGS[g]}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-2 overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>What the payer did</th>
                  <th>What it means</th>
                  <th>What to do</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.code}>
                    <td className="whitespace-nowrap font-mono text-xs font-bold text-slate-800">{code.code}</td>
                    <td className="text-slate-700">{code.description}</td>
                    <td className="text-slate-600">{code.meaning}</td>
                    <td className="text-slate-600">{code.howToFix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
