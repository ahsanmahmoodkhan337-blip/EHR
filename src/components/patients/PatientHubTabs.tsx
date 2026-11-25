/**
 * Patient hub — the four sections the hub adds to the Insurance and
 * Appointments sections that landed in #124
 * (`specs/patient-hub.md`: Demographics, Encounters, Ledger, Documents).
 *
 * Inspired by: eClinicalWorks' patient hub and Epic's Chart Review, where the
 * patient's demographics, the visits, the money and the papers are four views of
 * one record. Nothing here is a new model: the demographics are the chart's own
 * `Patient`, the encounter is the patient's `PipelineEncounter`, the ledger is
 * summed from the entries that were actually posted, and a document is either a
 * paper the record generated or one the student filed by name.
 *
 * What is honest here:
 *   - Every figure is summed or read; none is stored twice.
 *   - An empty tab says why it is empty and where the work comes from, rather
 *     than drawing a blank panel.
 *   - File upload does not exist in this build, and the Documents tab says so
 *     instead of offering a button that would do nothing.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, FileText, Receipt, UserRound } from "lucide-react";
import { useEhrStore } from "../../store/ehrStore";
import { usePipeline } from "../../store/pipelineStore";
import type { Patient } from "../../store/patientStore";
import {
  DOCUMENT_CATEGORY_LABELS,
  DOCUMENT_CATEGORY_OPTIONS,
  DOCUMENTS_UPLOAD_NOTE,
  documentsForPatient,
  generatedDocuments,
  type DocumentCategory,
} from "../../domain/documents";
import {
  LEDGER_ENTRY_LABELS,
  ledgerBalance,
  patientLedgerRows,
} from "../../domain/ledger";
import type { PipelineEncounter } from "../../store/pipelineEncounter";
import { requestPatientOpen } from "../shell/pendingPatient";

// ─── the six tabs, in the owner's order ─────────────────────────────────────

export const HUB_TABS = [
  { id: "demographics", label: "Demographics" },
  { id: "insurance", label: "Insurance" },
  { id: "appointments", label: "Appointments" },
  { id: "encounters", label: "Encounters" },
  { id: "ledger", label: "Ledger" },
  { id: "documents", label: "Documents" },
] as const;

export type HubTabId = (typeof HUB_TABS)[number]["id"];

export const DEFAULT_HUB_TAB: HubTabId = "demographics";

/** True when the URL's segment names one of the six tabs. */
export function isHubTab(value: string): value is HubTabId {
  return HUB_TABS.some((tab) => tab.id === value);
}

/** The stage label the encounter reached, in the eight-stage model's words. */
const PIPELINE_STAGE_LABEL: Record<PipelineEncounter["stage"], string> = {
  scribe: "Chart",
  coder: "Coding",
  biller: "Claim",
  "prior-auth": "Prior Auth",
  "ar-voice": "AR",
  complete: "Debrief",
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function day(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 border-b border-slate-100 py-1 last:border-0">
      <span className="w-40 shrink-0 text-xs font-semibold text-slate-500">
        {label}
      </span>
      <span className="text-[11px] text-slate-800">{value || "—"}</span>
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 p-3 text-[11px] text-slate-500">
      {children}
    </p>
  );
}

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-800">
      <UserRound className="h-3.5 w-3.5 text-brand-600" aria-hidden="true" />
      {children}
    </h2>
  );
}

// ─── Demographics ───────────────────────────────────────────────────────────

/**
 * The chart's own identity, then one form that writes the contact details the
 * front desk is allowed to correct. SSN, race, ethnicity and language are not
 * captured anywhere in this build, so they are not offered — a made-up field
 * teaches a made-up form.
 */
export function DemographicsSection({ patient }: { patient: Patient }) {
  const updatePatientDemographics = useEhrStore((s) => s.updatePatientDemographics);
  const [form, setForm] = useState({
    preferredName: patient.preferredName ?? "",
    phone: patient.phone ?? "",
    email: patient.email ?? "",
    address: patient.address ?? "",
    primaryCareProvider: patient.primaryCareProvider ?? "",
    emergencyName: patient.emergencyContact?.name ?? "",
    emergencyPhone: patient.emergencyContact?.phone ?? "",
    emergencyRelation: patient.emergencyContact?.relation ?? "",
  });
  const [message, setMessage] = useState("");

  const edit = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    updatePatientDemographics(patient.id, {
      preferredName: form.preferredName,
      phone: form.phone,
      email: form.email,
      address: form.address,
      primaryCareProvider: form.primaryCareProvider,
      emergencyContact: {
        name: form.emergencyName,
        phone: form.emergencyPhone,
        relation: form.emergencyRelation,
      },
    });
    setMessage("Saved to the chart.");
  };

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div>
      <label htmlFor={`hub-demo-${key}`} className="text-xs font-semibold text-slate-500">
        {label}
      </label>
      <input
        id={`hub-demo-${key}`}
        type={type}
        value={form[key]}
        onChange={(event) => edit(key, event.target.value)}
        className="mt-0.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      />
    </div>
  );

  return (
    <section aria-labelledby="hub-demographics">
      <SectionTitle id="hub-demographics">Demographics</SectionTitle>
      <div className="grid gap-2 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <Row label="Patient" value={`${patient.firstName} ${patient.lastName}`} />
          <Row label="MRN" value={patient.mrn} />
          <Row label="Date of birth" value={`${day(patient.dateOfBirth)}${patient.age ? ` · age ${patient.age}` : ""}`} />
          <Row label="Sex" value={patient.gender} />
          <Row label="Chief complaint" value={patient.chiefComplaint} />
          <Row label="Track" value={patient.track === "dental" ? "Dental" : "Medical"} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {field("preferredName", "Preferred name")}
            {field("phone", "Phone", "tel")}
            {field("email", "Email", "email")}
            {field("primaryCareProvider", "Primary care provider")}
          </div>
          <div className="mt-2">{field("address", "Address")}</div>

          <p className="mt-3 text-xs font-semibold text-slate-500">
            Emergency contact
          </p>
          <div className="mt-1 grid gap-2 sm:grid-cols-3">
            {field("emergencyName", "Name")}
            {field("emergencyPhone", "Phone", "tel")}
            {field("emergencyRelation", "Relation")}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              className="min-h-10 rounded-lg bg-brand-900 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Save details
            </button>
            <span role="status" aria-live="polite" className="text-[11px] text-emerald-700">
              {message}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Encounters ────────────────────────────────────────────────────────────

/**
 * The patient's encounter — the `PipelineEncounter`, which is the one record
 * that actually carries stages, claim, remittances, ledger and AR. This build
 * keeps one encounter per patient (unifying the three shapes is Phase 3), so the
 * list is one row and the row says where the work got to.
 */
export function EncountersSection({ patient }: { patient: Patient }) {
  const navigate = useNavigate();
  const { getEncounter } = usePipeline();
  const encounter = getEncounter(patient.id);

  const openWorkspace = () => {
    requestPatientOpen(patient.id);
    void navigate({ to: "/" });
  };

  const serviceDate = encounter?.codingLines[0]?.dateOfService ?? "";
  const placeOfService = encounter?.codingLines[0]?.placeOfService ?? "";
  const provider =
    encounter?.claimData?.providerSignature?.trim() ||
    [encounter?.claimData?.attendingFirstName, encounter?.claimData?.attendingLastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "";

  return (
    <section aria-labelledby="hub-encounters">
      <SectionTitle id="hub-encounters">Encounters</SectionTitle>
      {!encounter ? (
        <div>
          <Empty>
            No encounter on file for this patient. The encounter starts at Front Desk in the medical
            workspace, and it comes back here with its stage, claim and money.
          </Empty>
          <button
            type="button"
            onClick={openWorkspace}
            className="mt-2 inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-900 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Open the workspace <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-semibold text-slate-800">
              {patient.firstName} {patient.lastName}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {PIPELINE_STAGE_LABEL[encounter.stage]}
            </span>
            <span className="text-[11px] text-slate-500">{encounter.status}</span>
            {encounter.claimNumber && (
              <span className="text-[11px] text-slate-500">Claim {encounter.claimNumber}</span>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-600 sm:grid-cols-4">
            <div>
              <dt className="text-slate-400">Service date (24A)</dt>
              <dd className="tabular-nums">{serviceDate ? day(serviceDate) : "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Place of service (24B)</dt>
              <dd className="tabular-nums">{placeOfService || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Provider</dt>
              <dd>{provider || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Ledger entries</dt>
              <dd className="tabular-nums">{encounter.ledger.length}</dd>
            </div>
          </dl>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={openWorkspace}
              aria-label={`Open ${patient.firstName} ${patient.lastName}'s encounter in the workspace`}
              className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-900 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Open this encounter <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Ledger ────────────────────────────────────────────────────────────────

/**
 * Every entry posted against this patient, newest first, with the running
 * balance. The figures come from `domain/ledger.ts` only: the charge, the
 * insurance payment, the adjustment with its CARC and the patient payment are
 * the entries a posting wrote, and the balance is their sum.
 */
export function LedgerSection({ patient }: { patient: Patient }) {
  const { getEncounter } = usePipeline();
  const entries = getEncounter(patient.id)?.ledger ?? [];
  const rows = useMemo(() => patientLedgerRows(entries, patient.id), [entries, patient.id]);
  const totals = useMemo(() => ledgerBalance(rows.map((row) => row.entry)), [rows]);

  return (
    <section aria-labelledby="hub-ledger">
      <SectionTitle id="hub-ledger">Ledger</SectionTitle>
      {rows.length === 0 ? (
        <Empty>
          Nothing has been posted to this patient's ledger yet. A charge appears when a claim is
          posted, and a copay appears when the desk collects one at check-in.
        </Empty>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="relative overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Code</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.entry.id}>
                    <td className="whitespace-nowrap tabular-nums text-xs text-slate-500">
                      {day(row.entry.date)}
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-slate-600">
                      {LEDGER_ENTRY_LABELS[row.entry.type]}
                    </td>
                    <td className="whitespace-nowrap font-mono text-[11px] text-slate-500">
                      {row.entry.code || "—"}
                    </td>
                    <td className="text-[11px] text-slate-700">{row.entry.description}</td>
                    <td className="whitespace-nowrap text-right tabular-nums text-[11px] text-slate-800">
                      {money(row.entry.amountCents)}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums text-[11px] text-slate-800">
                      {money(row.balanceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-slate-100 p-3 text-[11px] text-slate-600 sm:grid-cols-5">
            <div>
              <dt className="text-slate-400">Charges</dt>
              <dd className="tabular-nums">{money(totals.chargesCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Insurance paid</dt>
              <dd className="tabular-nums">{money(totals.insurancePaidCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Adjustments</dt>
              <dd className="tabular-nums">{money(totals.adjustmentsCents)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Patient paid</dt>
              <dd className="tabular-nums">{money(totals.patientPaidCents)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-600">Patient balance</dt>
              <dd className="font-semibold tabular-nums text-slate-900">
                {money(totals.patientBalanceCents)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

// ─── Documents ─────────────────────────────────────────────────────────────

/**
 * The papers the record holds: the ones it generated (the claim form and the
 * 835 EOB) and the ones the student filed by name. A generated paper shows only
 * when the record behind it exists, so the tab never claims a paper that is not
 * there.
 */
export function DocumentsSection({ patient }: { patient: Patient }) {
  const { getEncounter } = usePipeline();
  const addDocument = useEhrStore((s) => s.addDocument);
  const added = useEhrStore((s) => s.user.documents);
  const encounter = getEncounter(patient.id);

  const generated = useMemo(
    () =>
      generatedDocuments({
        patientId: patient.id,
        encounterId: encounter?.patientId ?? null,
        claimNumber: encounter?.claimNumber ?? null,
        claimForm: Boolean(encounter?.claimForm),
        placeOfService: encounter?.codingLines[0]?.placeOfService ?? null,
        track: patient.track ?? "medical",
        remittances: (encounter?.remittances ?? []).map((remittance) => ({
          claimNumber: remittance.claimNumber,
          postedAt: remittance.postedAt ?? remittance.receivedAt,
        })),
        fallbackDate: encounter?.codingLines[0]?.dateOfService ?? "",
      }),
    [encounter, patient.id, patient.track],
  );

  const documents = useMemo(
    () => documentsForPatient(added, generated, patient.id),
    [added, generated, patient.id],
  );

  const [draft, setDraft] = useState({ name: "", category: "other" as DocumentCategory, description: "" });
  const [message, setMessage] = useState("");

  const submit = () => {
    const created = addDocument({
      patientId: patient.id,
      name: draft.name,
      category: draft.category,
      description: draft.description,
    });
    if (!created) {
      setMessage("Name the document before filing it.");
      return;
    }
    setDraft({ name: "", category: "other", description: "" });
    setMessage("Filed to the chart.");
  };

  return (
    <section aria-labelledby="hub-documents">
      <SectionTitle id="hub-documents">Documents</SectionTitle>

      {documents.length === 0 ? (
        <Empty>
          No document on this chart yet. A claim form appears here once the encounter has one, and
          an EOB once an 835 is posted.
        </Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((document) => (
            <li key={document.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <span className="text-xs font-semibold text-slate-800">{document.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                  {DOCUMENT_CATEGORY_LABELS[document.category]}
                </span>
                <span className="text-xs text-slate-400">
                  {document.source === "generated" ? "Generated" : "Added"}
                </span>
                <span className="ml-auto text-[11px] tabular-nums text-slate-500">
                  {day(document.createdAt)}
                </span>
              </div>
              {document.description && (
                <p className="mt-1 text-[11px] text-slate-500">{document.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <label htmlFor="hub-doc-name" className="text-xs font-semibold text-slate-500">
              Document name
            </label>
            <input
              id="hub-doc-name"
              type="text"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. Signed referral letter"
              className="mt-0.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
          </div>
          <div>
            <label htmlFor="hub-doc-category" className="text-xs font-semibold text-slate-500">
              Category
            </label>
            <select
              id="hub-doc-category"
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value as DocumentCategory })}
              className="mt-0.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {DOCUMENT_CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {DOCUMENT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="hub-doc-description" className="text-xs font-semibold text-slate-500">
              Description
            </label>
            <input
              id="hub-doc-description"
              type="text"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="One short line"
              className="mt-0.5 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={submit}
            className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-900 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <Receipt className="h-3.5 w-3.5" aria-hidden="true" /> Add document
          </button>
          <span role="status" aria-live="polite" className="text-[11px] text-slate-500">
            {message}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">{DOCUMENTS_UPLOAD_NOTE}</p>
      </div>
    </section>
  );
}
