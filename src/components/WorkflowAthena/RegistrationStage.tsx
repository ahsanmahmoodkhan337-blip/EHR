/**
 * RegistrationStage — Patient Intake & Registration
 *
 * Inspiration: Front-desk check-in terminal UI concept (athenahealth-style
 * registration, with the insurance card transcribed into the coverage record).
 * Displays mock Driver's License and Insurance Card,
 * then challenges the student to transcribe fields correctly.
 * Educational twist: Insurance card says "Jonathon" but
 * Driver's License says "Jonathan" — blind copying is the trap. The student
 * answers "do the two names agree?" before Verify, and the mismatch and its
 * consequence at the payer are only printed after they commit (standing rule 6).
 *
 * What it saves: on Verify, the insurance fields the student transcribed —
 * payer name and EDI payer ID, subscriber ID, group number, relationship to the
 * subscriber and any secondary coverage — are written onto the selected patient
 * as its `insuranceRecord` (spec 3a item 1). Until 2026-11-20 they stayed in
 * component state and only fed the score, so the claim had nothing to read and
 * box 1a printed an invented member ID. The record now lives in the patient
 * store, so it survives a reload and follows the patient onto the claim.
 *
 * The transcribed identity — first and last name, and the date of birth turned
 * into the chart's `YYYY-MM-DD` — is written onto the patient in the same step,
 * filling only what the chart is missing. Before 2026-11-20 the DOB stayed in
 * component state, so a patient registered from the schedule kept showing
 * "DOB Invalid Date (0y)" in the banner and an empty box 3 on the claim.
 */

import { useEffect, useRef, useState } from "react";
import { CreditCard, IdCard, CheckCircle2, Star } from "lucide-react";
import { scoreRegistration, updateStageScore, getStudentName } from "../../utils/scoring";
import { usePatientStore } from "../../store/patientStore";
import { useEhrStore } from "../../store/ehrStore";
import {
  SUBSCRIBER_RELATIONSHIPS,
  buildInsuranceRecord,
} from "../../utils/insuranceRecord";
import { registrationCardFor } from "../../domain/patientCard";

/**
 * Turn the form's MM/DD/YYYY date of birth into the ISO `YYYY-MM-DD` the chart
 * stores. Returns null when the typed date is not a real date, so a bad entry
 * never reaches the patient record.
 */
function toIsoDate(dob: string): string | null {
  const trimmed = dob.trim();
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const [, month, day, year] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

interface RegistrationStageProps {
  /** The patient this registration writes its insurance record to. */
  patientId?: string | null;
}

export function RegistrationStage({ patientId }: RegistrationStageProps) {
  const { getPatientById } = usePatientStore();
  const updatePatientInsurance = useEhrStore((s) => s.updatePatientInsurance);
  const updatePatientIdentity = useEhrStore((s) => s.updatePatientIdentity);
  const patient = patientId ? getPatientById(patientId) : undefined;

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    payerName: "Northwind Health Plan",
    subscriberId: "",
    groupNumber: "",
    payerId: "",
    relationship: "Self",
    secondaryPayerName: "",
    secondaryPayerId: "",
    secondarySubscriberId: "",
    secondaryGroupNumber: "",
    /**
     * The student's own identity answer, asked before Verify. "" = not answered.
     * The two cards are both on screen, so the comparison is theirs to make; the
     * app never prints the mismatch while they type (standing rule 6).
     */
    nameAgrees: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [savedToChart, setSavedToChart] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** No insurance: the patient pays cash. Coverage is then "Self-pay". */
  const [selfPay, setSelfPay] = useState(false);

  // Re-open a patient that already has a card: show the card THIS patient owns,
  // so re-verifying corrects it instead of silently replacing it with blanks.
  //
  // The form is rebuilt from the selected patient on every patient change, and
  // never from the values already in it: the patient opened before this one may
  // have had a different card, and carrying its member ID over would both print
  // a neighbour's card and — on Verify — write it onto this patient's chart
  // (`domain/patientCard.ts`).
  const prefilledFor = useRef<string | null>(null);
  useEffect(() => {
    const id = patient?.id ?? null;
    if (prefilledFor.current === id) {
      // Same patient: the store hydrates after the first render, so a card that
      // lands late fills the boxes the student has not filled themselves.
      const record = patient?.insuranceRecord;
      if (!record) return;
      setForm((prev) => ({
        ...prev,
        payerName: prev.payerName || record.primary.payerName,
        subscriberId: prev.subscriberId || record.primary.subscriberId,
        groupNumber: prev.groupNumber || record.primary.groupNumber,
        payerId: prev.payerId || record.primary.ediPayerId,
        relationship: record.primary.relationshipToSubscriber || prev.relationship,
        secondaryPayerName: record.secondary?.payerName ?? "",
        secondaryPayerId: record.secondary?.ediPayerId ?? "",
        secondarySubscriberId: record.secondary?.subscriberId ?? "",
        secondaryGroupNumber: record.secondary?.groupNumber ?? "",
      }));
      return;
    }
    prefilledFor.current = id;
    const card = registrationCardFor(patient);
    const hasCard = Boolean(card.payerName || card.subscriberId || card.groupNumber || card.payerId);
    setForm((prev) => ({
      ...prev,
      // A patient with no card on file starts from the blank form — never from
      // the patient opened before them.
      ...(hasCard
        ? card
        : {
            payerName: "",
            subscriberId: "",
            groupNumber: "",
            payerId: "",
            relationship: "Self",
            secondaryPayerName: "",
            secondaryPayerId: "",
            secondarySubscriberId: "",
            secondaryGroupNumber: "",
          }),
    }));
  }, [patient?.id, patient?.insuranceRecord]);

  // The insurance card says "Jonathon" and the government ID says "Jonathan".
  // The cards are both on screen, so the student makes that comparison and
  // answers for it; the app prints nothing about it until they have (rule 6).

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (!form.dob.trim()) errs.dob = "Date of birth is required";
    else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.dob.trim())) errs.dob = "Use MM/DD/YYYY format";
    else {
      const iso = toIsoDate(form.dob);
      if (!iso) errs.dob = "That is not a real date — check the day and the month";
      else if (new Date(iso).getTime() > Date.now())
        errs.dob = "A date of birth cannot be in the future";
    }
    if (!form.nameAgrees) errs.nameAgrees = "Answer the identity question before verifying";
    if (!selfPay) {
      if (!form.payerName.trim()) errs.payerName = "Payer name is required";
      if (!form.subscriberId.trim()) errs.subscriberId = "Subscriber ID is required";
      if (!form.groupNumber.trim()) errs.groupNumber = "Group number is required";
      if (!form.payerId.trim()) errs.payerId = "Payer ID is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const [registrationScore, setRegistrationScore] = useState<number | null>(null);

  const handleSubmit = () => {
    if (validate()) {
      const score = scoreRegistration(
        form.firstName,
        form.lastName,
        form.dob,
        form.subscriberId,
        form.groupNumber,
        form.payerId
      );
      setRegistrationScore(score);
      updateStageScore(getStudentName(), "registration", score);
      setSubmitted(true);

      // Persist the coverage record onto the patient. No identifier is derived
      // or invented: what the student did not type stays empty, so the claim
      // box falls through to its tagged demo value instead.
      if (patient?.id) {
        // The identity the student transcribed goes onto the chart too, so the
        // banner, the summary and the claim stop showing a patient with no date
        // of birth after Registration has been worked.
        const isoDob = toIsoDate(form.dob);
        updatePatientIdentity(patient.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          ...(isoDob ? { dateOfBirth: isoDob } : {}),
        });

        const secondaryFilled =
          form.secondaryPayerName.trim() ||
          form.secondaryPayerId.trim() ||
          form.secondarySubscriberId.trim() ||
          form.secondaryGroupNumber.trim();
        updatePatientInsurance(
          patient.id,
          buildInsuranceRecord({
            primary: {
              payerName: selfPay ? "Self-pay" : form.payerName,
              ediPayerId: selfPay ? "" : form.payerId,
              subscriberId: selfPay ? "" : form.subscriberId,
              groupNumber: selfPay ? "" : form.groupNumber,
              relationshipToSubscriber: form.relationship,
              planName: selfPay ? "Self-pay" : form.payerName,
            },
            secondary: secondaryFilled
              ? {
                  payerName: form.secondaryPayerName,
                  ediPayerId: form.secondaryPayerId,
                  subscriberId: form.secondarySubscriberId,
                  groupNumber: form.secondaryGroupNumber,
                  relationshipToSubscriber: form.relationship,
                }
              : null,
          }),
        );
        setSavedToChart(true);
      }
    }
  };

  const isComplete = submitted;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Step 1: Patient Intake & Registration</h3>
          <p className="text-sm text-slate-500">Verify patient identity and insurance information</p>
        </div>
        {isComplete && (
          <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
          </span>
        )}
      </div>

      {/* ─── Mock Driver's License ─── */}
      <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-yellow-200 pb-2">
          <IdCard className="h-5 w-5 text-yellow-700" />
          <span className="text-sm font-bold uppercase tracking-wider text-yellow-800">Driver's License</span>
          <span className="ml-auto text-[10px] text-yellow-600">State of California</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="text-[10px] font-semibold uppercase text-yellow-700">Name</span><br /><span className="font-medium text-slate-800">Jonathan Doe</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-yellow-700">DOB</span><br /><span className="font-medium text-slate-800">04/15/1988</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-yellow-700">Address</span><br /><span className="font-medium text-slate-800">1234 Oak St, Sacramento, CA 95814</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-yellow-700">License #</span><br /><span className="font-medium text-slate-800">D45178239</span></p>
        </div>
      </div>

      {/* ─── Mock Insurance Card (Front) ─── */}
      <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-blue-200 pb-2">
          <CreditCard className="h-5 w-5 text-blue-700" />
          <span className="text-sm font-bold uppercase tracking-wider text-blue-800">Insurance Card — Front</span>
          <span className="ml-auto rounded bg-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">Northwind Health Plan</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Member Name</span><br /><span className="font-medium text-slate-800">Jonathon Doe</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Subscriber ID</span><br /><span className="font-medium text-slate-800">XYZ987654321</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Group Number</span><br /><span className="font-medium text-slate-800">GRP-4477</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Payer ID</span><br /><span className="font-medium text-slate-800">NWIND01</span></p>
        </div>
      </div>

      {/* ─── Transcription Form ─── */}
      <div className="clinical-card">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Transcribe Patient Information</h4>
        <label className="mb-3 flex items-center gap-2 text-[11px] font-medium text-slate-600">
          <input
            type="checkbox"
            checked={selfPay}
            onChange={(e) => setSelfPay(e.target.checked)}
            className="h-3.5 w-3.5 accent-brand-600"
          />
          Self-pay — the patient has no insurance (coverage is recorded as Self-pay)
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-slate-500">First Name</label>
            <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
              className="mt-1 input-field" placeholder="e.g. Jonathan" />
            {errors.firstName && <p className="mt-0.5 text-[10px] text-red-500">{errors.firstName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Last Name</label>
            <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
              className="mt-1 input-field" placeholder="e.g. Doe" />
            {errors.lastName && <p className="mt-0.5 text-[10px] text-red-500">{errors.lastName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Date of Birth (MM/DD/YYYY)</label>
            <input type="text" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })}
              className="mt-1 input-field" placeholder="e.g. 04/15/1988" />
            {errors.dob && <p className="mt-0.5 text-[10px] text-red-500">{errors.dob}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Payer Name</label>
            <input type="text" value={form.payerName} onChange={e => setForm({ ...form, payerName: e.target.value })}
              className="mt-1 input-field" placeholder="e.g. Northwind Health Plan" />
            {errors.payerName && <p className="mt-0.5 text-[10px] text-red-500">{errors.payerName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Subscriber ID</label>
            <input type="text" value={form.subscriberId} onChange={e => setForm({ ...form, subscriberId: e.target.value })}
              className="mt-1 input-field" placeholder="e.g. XYZ987654321" />
            {errors.subscriberId && <p className="mt-0.5 text-[10px] text-red-500">{errors.subscriberId}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Group Number</label>
            <input type="text" value={form.groupNumber} onChange={e => setForm({ ...form, groupNumber: e.target.value })}
              className="mt-1 input-field" placeholder="e.g. GRP-4477" />
            {errors.groupNumber && <p className="mt-0.5 text-[10px] text-red-500">{errors.groupNumber}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Payer ID (EDI)</label>
            <input type="text" value={form.payerId} onChange={e => setForm({ ...form, payerId: e.target.value })}
              className="mt-1 input-field" placeholder="e.g. NWIND01" />
            {errors.payerId && <p className="mt-0.5 text-[10px] text-red-500">{errors.payerId}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Relationship to Subscriber</label>
            <select value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value })}
              className="mt-1 input-field">
              {SUBSCRIBER_RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <p className="mt-0.5 text-[10px] text-slate-400">Fills claim box 6 — SELF unless the patient is a dependent.</p>
          </div>
        </div>

        {/* ─── Secondary coverage (claim box 9 / 11d) ─── */}
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <p className="text-[11px] font-semibold text-slate-600">Secondary Coverage — leave blank if there is none</p>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500">Secondary Payer Name</label>
              <input type="text" value={form.secondaryPayerName} onChange={e => setForm({ ...form, secondaryPayerName: e.target.value })}
                className="mt-1 input-field" placeholder="e.g. Medicare Part B" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500">Secondary Payer ID (EDI)</label>
              <input type="text" value={form.secondaryPayerId} onChange={e => setForm({ ...form, secondaryPayerId: e.target.value })}
                className="mt-1 input-field" placeholder="e.g. MCARE01" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500">Secondary Subscriber ID</label>
              <input type="text" value={form.secondarySubscriberId} onChange={e => setForm({ ...form, secondarySubscriberId: e.target.value })}
                className="mt-1 input-field" placeholder="e.g. MC123456789" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500">Secondary Group Number</label>
              <input type="text" value={form.secondaryGroupNumber} onChange={e => setForm({ ...form, secondaryGroupNumber: e.target.value })}
                className="mt-1 input-field" placeholder="e.g. MCB-4471" />
            </div>
          </div>
        </div>
        {/* ─── Identity question — answered before Verify (standing rule 6) ─── */}
        <fieldset className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <legend className="px-1 text-[11px] font-semibold text-slate-600">
            Do the name on the card and the name on the government ID agree?
          </legend>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            {[
              { v: "yes", label: "Yes" },
              { v: "no", label: "No" },
            ].map((o) => (
              <label
                key={o.v}
                className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-700"
              >
                <input
                  type="radio"
                  name="name-agrees"
                  value={o.v}
                  checked={form.nameAgrees === o.v}
                  onChange={() => setForm({ ...form, nameAgrees: o.v })}
                  className="h-4 w-4 accent-brand-600"
                />
                {o.label}
              </label>
            ))}
          </div>
          {errors.nameAgrees && (
            <p className="mt-1 text-[10px] text-red-500">{errors.nameAgrees}</p>
          )}
        </fieldset>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSubmit} className="btn-primary">
            {isComplete ? "Re-verify" : "Verify Identity & Insurance"}
          </button>
        </div>
        {isComplete && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Patient identity and insurance verified successfully.
            </div>
            {/* Revealed only after Verify: the student answered first. */}
            <div className="rounded bg-white/60 p-2 text-slate-700">
              <span className="font-semibold">Identity check</span> — card: "Jonathon" · government ID:
              "Jonathan". A subscriber name that differs from the payer's file fails eligibility at the
              payer (name mismatch); the chart carries the ID spelling.
              {form.nameAgrees === "yes" && (
                <span className="mt-1 block text-amber-700">
                  You answered that the two names agree — compare the two cards again before the next
                  patient.
                </span>
              )}
            </div>
            {savedToChart && (
              <div className="text-green-700/80">
                Insurance record saved to the chart — payer, member ID, group, relationship
                {patient?.insuranceRecord?.secondary ? " and secondary coverage" : ""} now fill the
                claim.
              </div>
            )}
            {!patient && (
              <div className="text-amber-700">
                No patient is selected, so this insurance record was scored but not saved to a chart.
              </div>
            )}
            {registrationScore !== null && (
              <div className="flex items-center gap-1.5 text-amber-700">
                <Star className="h-3.5 w-3.5" />
                Score: <strong>{registrationScore}/10</strong>
                {registrationScore < 10 && (
                  <span className="text-amber-500">— {registrationScore >= 5 ? "Good, but check the name mismatch!" : "Try again for a higher score"}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}