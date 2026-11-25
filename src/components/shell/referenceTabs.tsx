/**
 * referenceTabs.tsx — what the reference drawer shows, per track
 *
 * Inspired by: Epic's Chart Review snapshots (note, coverage, benefits) and the
 * "payer policy" tab a real coder keeps open beside the coding screen. The
 * drawer itself (`ReferenceDrawer.tsx`) owns the split pane, the tabs and the
 * remembered tab; this file owns the four panels and reads them straight from
 * the case data, so nothing here invents a value.
 *
 * Spec `task-1-app-shell.md` item 6. Two rules govern the content:
 *   - Standing rule 6: the code reference is a *lookup*, never the case's answer
 *     key. The student types a code or a word and reads what it means — the
 *     drawer does not print which codes the case expects.
 *   - A value the case never recorded prints "—" with the reason, the same way
 *     the patient banner does, instead of being guessed.
 */

import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BookMarked,
  CreditCard,
  FileText,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { MedicalCaseScenario, MedicalPlan } from "../../data/medical";
import type { DentalCaseScenario, DentalPlan } from "../../data/dental";
import { searchCDT } from "../../data/dental";
import { searchCPT } from "../CodingQueue/cptData";
import { searchICD10 } from "../CodingQueue/icd10Data";
import type { ReferenceTab } from "./ReferenceDrawer";

// ─── small presentational pieces ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 first:mt-0">
      <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h4>
      {children}
    </section>
  );
}

/** One label/value pair. `undefined` prints "—" plus why, never a guess. */
function Field({ label, value, absent }: { label: string; value?: string | number | null; absent?: string }) {
  const has = value !== undefined && value !== null && value !== "";
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-100 py-1 last:border-0 dark:border-slate-800">
      <dt className="shrink-0 text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`text-right font-medium ${has ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}`}>
        {has ? value : `— ${absent ?? "not recorded on this case"}`}
      </dd>
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  return <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">{text}</p>;
}

function Bullets({ items }: { items: string[] }) {
  if (items.length === 0) return <p className="text-slate-400">— nothing recorded on this case</p>;
  return (
    <ul className="list-disc space-y-1 pl-4 text-slate-700 dark:text-slate-200">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

const money = (value: number) => `$${value.toFixed(2)}`;

// ─── code reference (a lookup, not an answer key) ───────────────────────────

interface CodeHit {
  code: string;
  label: string;
  set: string;
  note?: string;
}

export function CodeLookup({ scope }: { scope: "medical" | "dental" }) {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  const hits = useMemo<CodeHit[]>(() => {
    if (trimmed.length < 2) return [];
    if (scope === "dental") {
      return searchCDT(trimmed)
        .slice(0, 10)
        .map((c) => ({ code: c.code, label: c.shortName, set: `CDT · ${c.category}`, note: c.teachingDescription }));
    }
    const cpt = searchCPT(trimmed)
      .slice(0, 6)
      .map((c) => ({ code: c.code, label: c.description, set: `CPT · ${c.category}`, note: c.notes }));
    const icd = searchICD10(trimmed)
      .slice(0, 6)
      .map((c) => ({ code: c.code, label: c.description, set: `ICD-10-CM · ${c.chapter}`, note: c.notes }));
    return [...cpt, ...icd];
  }, [trimmed, scope]);

  return (
    <div>
      <label htmlFor="reference-code-search" className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Look up a code
      </label>
      <div className="relative mt-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          id="reference-code-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={scope === "dental" ? "e.g. D2740, crown, or Preventive" : "e.g. 99213, I10, or office visit"}
          aria-label="Search the code reference"
          className="min-h-10 w-full rounded-lg border border-slate-200 bg-white pl-7 pr-2 text-[11px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {trimmed.length < 2 ? (
        <p className="mt-2 text-slate-400">
          Type at least two characters. This is a reference — it shows what a code means, never which
          code this case expects.
        </p>
      ) : hits.length === 0 ? (
        <p className="mt-2 text-slate-400">
          No code in this teaching subset matches “{trimmed}”. The subset is deliberately small; a real
          coder would use the full code set.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {hits.map((hit) => (
            <li key={`${hit.set}-${hit.code}`} className="rounded-lg border border-slate-200 px-2 py-1.5 dark:border-slate-700">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-100">{hit.code}</span>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{hit.set}</span>
              </div>
              <p className="text-slate-700 dark:text-slate-200">{hit.label}</p>
              {hit.note && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hit.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── medical track ──────────────────────────────────────────────────────────

export function medicalReferenceTabs(
  scenario: MedicalCaseScenario,
  plan?: MedicalPlan,
): ReferenceTab[] {
  const patient = scenario.patient;
  const note = scenario.clinicalNote;

  return [
    {
      id: "chart-note",
      label: "Chart note",
      icon: <FileText className="h-3.5 w-3.5" />,
      content: (
        <>
          <Section title="Chief complaint">
            <Paragraph text={note.chiefComplaint} />
          </Section>
          <Section title="Subjective">
            <Paragraph text={note.subjective} />
          </Section>
          <Section title="Objective">
            <Paragraph text={note.objective} />
          </Section>
          <Section title="Assessment">
            <Paragraph text={note.assessment} />
          </Section>
          <Section title="Plan">
            <Paragraph text={note.plan} />
          </Section>
        </>
      ),
    },
    {
      id: "insurance-card",
      label: "Insurance card",
      icon: <CreditCard className="h-3.5 w-3.5" />,
      content: (
        <div className="rounded-xl border border-slate-300 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm dark:border-slate-600 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-brand-600" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-100">
              {plan?.name ?? "— plan not recorded on this case"}
            </span>
          </div>
          <dl className="mt-2 text-[11px]">
            <Field label="Member ID" value={patient.memberId} />
            <Field label="Subscriber" value={patient.subscriberName} />
            <Field label="Relationship" value={patient.relationshipToSubscriber} />
            <Field label="Patient" value={`${patient.firstName} ${patient.lastName}`} />
            <Field label="Date of birth" value={patient.dateOfBirth} />
            <Field label="Group number" absent="not captured on this case" />
            <Field label="Plan type" value={plan?.planType} />
            <Field label="Network" value={plan?.network} />
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">
            Simulated card. Every payer, member ID and patient here is fictional.
          </p>
        </div>
      ),
    },
    {
      id: "payer-policy",
      label: "Payer policy",
      icon: <BadgeDollarSign className="h-3.5 w-3.5" />,
      content: plan ? (
        <>
          <Section title="Plan">
            <dl className="text-[11px]">
              <Field label="Plan" value={plan.name} />
              <Field label="Type" value={plan.planType} />
              <Field label="Network" value={plan.network} />
            </dl>
          </Section>
          <Section title="Cost sharing">
            <dl className="text-[11px]">
              <Field label="Individual deductible" value={money(plan.deductibleUsd)} />
              <Field label="Plan pays after deductible" value={`${plan.planCoinsurancePercent}%`} />
              <Field label="Preventive" value={plan.preventivePaidInFull ? "Paid in full, no deductible" : "Cost sharing applies"} />
            </dl>
          </Section>
          <Section title="Prior authorisation required for">
            {plan.priorAuthCptCodes.length === 0 ? (
              <p className="text-slate-700 dark:text-slate-200">
                No CPT codes on this plan's prior-auth list.
              </p>
            ) : (
              <p className="font-mono text-slate-800 dark:text-slate-100">{plan.priorAuthCptCodes.join(", ")}</p>
            )}
          </Section>
          <Section title="Benefit limits">
            {plan.benefitLimits.length === 0 ? (
              <p className="text-slate-400">— no annual limits recorded on this plan</p>
            ) : (
              <ul className="space-y-1">
                {plan.benefitLimits.map((limit) => (
                  <li key={limit.serviceCategory}>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{limit.serviceCategory}</span>{" "}
                    — {limit.limitPerYear} per year, then {limit.carc}. {limit.note}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Plan notes">
            <Paragraph text={plan.notes} />
          </Section>
        </>
      ) : (
        <p className="text-slate-400">— no plan is attached to this case</p>
      ),
    },
    {
      id: "code-reference",
      label: "Code reference",
      icon: <BookMarked className="h-3.5 w-3.5" />,
      content: <CodeLookup scope="medical" />,
    },
  ];
}

// ─── dental track ───────────────────────────────────────────────────────────

export function dentalReferenceTabs(scenario: DentalCaseScenario, plan?: DentalPlan): ReferenceTab[] {
  const patient = scenario.patient;
  const note = scenario.clinicalNote;

  return [
    {
      id: "chart-note",
      label: "Chart note",
      icon: <FileText className="h-3.5 w-3.5" />,
      content: (
        <>
          <Section title="Chief complaint">
            <Paragraph text={note.chiefComplaint} />
          </Section>
          <Section title="Findings">
            <Bullets items={note.findings} />
          </Section>
          {note.periodontalSummary && (
            <Section title="Periodontal summary">
              <Paragraph text={note.periodontalSummary} />
            </Section>
          )}
          <Section title="Radiographic findings">
            <Bullets items={note.radiographicFindings} />
          </Section>
          <Section title="Diagnosis narrative">
            <Paragraph text={note.diagnosisNarrative} />
          </Section>
          <Section title="Treatment performed">
            <Bullets items={note.treatmentPerformed} />
          </Section>
          {note.providerNarrativeForPayer && (
            <Section title="Provider narrative for the payer">
              <Paragraph text={note.providerNarrativeForPayer} />
            </Section>
          )}
        </>
      ),
    },
    {
      id: "insurance-card",
      label: "Insurance card",
      icon: <CreditCard className="h-3.5 w-3.5" />,
      content: (
        <div className="rounded-xl border border-teal-300 bg-gradient-to-br from-teal-50 to-white p-3 shadow-sm dark:border-teal-700 dark:from-slate-800 dark:to-slate-900">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-100">
              {plan?.payerName ?? "— payer not recorded on this case"}
            </span>
          </div>
          <dl className="mt-2 text-[11px]">
            <Field label="Plan" value={plan?.planName} />
            <Field label="Member ID" value={patient.memberId} />
            <Field label="Group number" value={plan?.groupNumber} />
            <Field label="Payer ID" value={plan?.payerId} />
            <Field label="Subscriber" value={patient.subscriberName} />
            <Field label="Relationship" value={patient.relationshipToSubscriber} />
            <Field label="Coverage effective" value={patient.coverageEffectiveDate} />
            <Field label="Claims address" value={plan?.claimsAddress} />
          </dl>
          <p className="mt-2 text-[11px] text-slate-400">
            Simulated card. Every payer, group number and patient here is fictional.
          </p>
        </div>
      ),
    },
    {
      id: "payer-policy",
      label: "Payer policy",
      icon: <BadgeDollarSign className="h-3.5 w-3.5" />,
      content: plan ? (
        <>
          <Section title="Plan">
            <dl className="text-[11px]">
              <Field label="Payer" value={plan.payerName} />
              <Field label="Plan" value={plan.planName} />
              <Field label="Type" value={plan.planType} />
              <Field label="Benefit period" value={plan.benefitPeriod} />
            </dl>
          </Section>
          <Section title="Maximums and deductible">
            <dl className="text-[11px]">
              <Field
                label="Annual maximum"
                value={plan.annualMaximumUsd === null ? "No annual maximum" : money(plan.annualMaximumUsd)}
              />
              <Field label="Individual deductible" value={money(plan.deductible.individualUsd)} />
              <Field label="Family deductible" value={money(plan.deductible.familyUsd)} />
              <Field label="Deductible waived for preventive" value={plan.deductible.waivedForPreventive ? "Yes" : "No"} />
            </dl>
          </Section>
          <Section title="Coinsurance — the plan pays">
            <dl className="text-[11px]">
              {(["Preventive", "Basic", "Major", "Orthodontic"] as const).map((cls) => (
                <Field key={cls} label={cls} value={`${plan.coinsurancePlanPaysPct[cls]}%`} />
              ))}
            </dl>
          </Section>
          <Section title="Waiting periods (months)">
            <dl className="text-[11px]">
              <Field label="Preventive" value={plan.waitingPeriods.preventiveMonths} />
              <Field label="Basic" value={plan.waitingPeriods.basicMonths} />
              <Field label="Major" value={plan.waitingPeriods.majorMonths} />
              <Field label="Orthodontic" value={plan.waitingPeriods.orthodonticMonths} />
            </dl>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{plan.waitingPeriods.note}</p>
          </Section>
          <Section title="Missing tooth clause">
            <p className="text-slate-700 dark:text-slate-200">{plan.missingToothClause.explanation}</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">{plan.missingToothClause.studentNote}</p>
          </Section>
          <Section title="Alternate benefit provisions">
            {plan.alternateBenefits.length === 0 ? (
              <p className="text-slate-400">— none on this plan</p>
            ) : (
              <ul className="space-y-1">
                {plan.alternateBenefits.map((provision) => (
                  <li key={provision.id}>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{provision.label}</span> — pays to{" "}
                    {provision.paidAtCode} ({provision.appliesTo.replace(/-/g, " ")}).
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Exclusions">
            <Bullets items={plan.exclusions} />
          </Section>
          <Section title="Predetermination">
            <p className="text-slate-700 dark:text-slate-200">
              {plan.predeterminationRequiredOver === null
                ? "Not required on this plan."
                : `Required over ${money(plan.predeterminationRequiredOver)}.`}{" "}
              {plan.predeterminationNote}
            </p>
          </Section>
          <Section title="Teaching summary">
            <Paragraph text={plan.teachingSummary} />
          </Section>
        </>
      ) : (
        <p className="text-slate-400">— no plan is attached to this case</p>
      ),
    },
    {
      id: "code-reference",
      label: "Code reference",
      icon: <BookMarked className="h-3.5 w-3.5" />,
      content: <CodeLookup scope="dental" />,
    },
  ];
}
