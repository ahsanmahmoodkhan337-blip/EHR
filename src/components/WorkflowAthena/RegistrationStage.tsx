/**
 * RegistrationStage — Patient Intake & Registration
 *
 * Inspiration: Front-desk check-in terminal UI concept (athenahealth-style
 * registration, with the insurance card transcribed into the coverage record).
 * Displays the selected patient's own Driver's License and Insurance Card,
 * then challenges the student to transcribe fields correctly.
 * Educational twist: this case's insurance card carries one deliberate
 * misspelling that the government ID does not — blind copying is the trap. The
 * student answers "do the two names agree?" before Verify, and the mismatch and
 * its consequence at the payer are only printed after they commit (standing
 * rule 6).
 *
 * Both cards are built by `domain/patientCard.ts` from the selected patient's
 * own demographics and `insuranceRecord` — before 2026-11-21 they were two
 * literal blocks printing "Jonathan/Jonathon Doe" for every patient, and the
 * payer box started at a hardcoded "Northwind Health Plan". A field the chart
 * does not hold prints "Not on file"; nothing is borrowed from another patient.
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
import { CreditCard, IdCard, CheckCircle2, Star, Lock } from "lucide-react";
import { scoreRegistration, updateStageScore, getStudentName } from "../../utils/scoring";
import { usePatientStore } from "../../store/patientStore";
import { useEhrStore } from "../../store/ehrStore";
import {
  SUBSCRIBER_RELATIONSHIPS,
  buildInsuranceRecord,
} from "../../utils/insuranceRecord";
import {
  caseMismatch,
  onFileOr,
  patientCard,
  registrationCardFor,
  registrationExpectations,
  registrationIdentityFor,
} from "../../domain/patientCard";
import { box11Value, payerIssuesGroupNumber } from "../../domain/claimParties";
import { scoreTranscription, type TranscriptionScore } from "../../domain/registrationTranscription";

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

import { ReadOnlyNote, readOnlyAttrs, readOnlyNoteId } from "../shell/ReadOnlyStage";

/** The reason drawn under Verify, at the point of the click. */
const VERIFY_REASON = readOnlyNoteId("registration-verify");
/** The sentence under the locked boxes, so a screen reader lands on it. */
const READ_CARD_REASON_ID = "registration-read-card-reason";
/** The same sentence at the top of the locked form, so it is read there too. */
const READ_CARD_LOCK_ID = "registration-read-card-lock";

interface RegistrationStageProps {
  /** The standard reference chart: a control that would write is disabled and says why. */
  readOnly?: boolean;
  /** The patient this registration writes its insurance record to. */
  patientId?: string | null;
}

export function RegistrationStage({ patientId, readOnly = false }: RegistrationStageProps) {
  const { getPatientById } = usePatientStore();
  const updatePatientInsurance = useEhrStore((s) => s.updatePatientInsurance);
  const updatePatientIdentity = useEhrStore((s) => s.updatePatientIdentity);
  const patient = patientId ? getPatientById(patientId) : undefined;

  // The two documents on screen, both built from this patient's own record.
  const card = patientCard(patient);
  const mismatch = caseMismatch(patient);
  const expectations = registrationExpectations(patient);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    payerName: "",
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
  /**
   * Has the student read the two documents on screen?
   *
   * Registration is a read-then-transcribe exercise, so the identity and
   * insurance boxes open LOCKED and the student presses "Read the card" to
   * unlock them. Nothing is revealed by reading — the documents are already in
   * front of them — so the gate costs the answer key nothing; it only stops a
   * student transcribing from memory or from the banner instead of the card.
   *
   * The Tutorial Patient's chart is the reference and keeps its own behaviour:
   * `readOnly` there means no gate at all, and the fields stay locked by the
   * chart itself.
   */
  const [cardRead, setCardRead] = useState(false);
  // Whether a card was on file at the moment it was read. A student who reads
  // an empty card and types the coverage themselves is its only source.
  const [cardOnFileAtRead, setCardOnFileAtRead] = useState<boolean | null>(null);
  /** The saved transcription's own count — null until the student saves. */
  const [transcription, setTranscription] = useState<TranscriptionScore | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  /**
   * No insurance: the patient pays cash. Coverage is then "Self-pay".
   *
   * Only ever on offer for a patient whose own card names no payer. The chart
   * this stage is opened on holds Medicare Part B, and a screen that offers to
   * record it as self-pay contradicts its own card and banner (owner rule,
   * 2026-11-23: one screen must not call a patient self-pay while its card names
   * a payer). The tick is also cleared whenever the patient changes, so a
   * decision made on one chart never follows the next patient.
   */
  const [selfPayWanted, setSelfPay] = useState(false);
  /** The patient's own saved coverage — the source of the form below. */
  const cardNamesPayer = Boolean(card.payerName.trim());
  const selfPay = selfPayWanted && !cardNamesPayer;

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
    // The identity half is read from the chart, not the card: the name and date
    // of birth are already on the record, and the government ID's spelling is
    // the one that wins. A box the student has typed is never overwritten.
    const identity = registrationIdentityFor(patient);
    if (prefilledFor.current === id) {
      // Same patient: the store hydrates after the first render, so a card that
      // lands late fills the boxes the student has not filled themselves.
      const record = patient?.insuranceRecord;
      setForm((prev) => ({
        ...prev,
        firstName: prev.firstName || identity.firstName,
        lastName: prev.lastName || identity.lastName,
        dob: prev.dob || identity.dateOfBirth,
        ...(record
          ? {
              payerName: prev.payerName || record.primary.payerName,
              subscriberId: prev.subscriberId || record.primary.subscriberId,
              groupNumber:
                prev.groupNumber ||
                box11Value(record.primary.groupNumber, record.primary.payerName),
              payerId: prev.payerId || record.primary.ediPayerId,
              relationship: record.primary.relationshipToSubscriber || prev.relationship,
              secondaryPayerName: record.secondary?.payerName ?? "",
              secondaryPayerId: record.secondary?.ediPayerId ?? "",
              secondarySubscriberId: record.secondary?.subscriberId ?? "",
              secondaryGroupNumber: record.secondary?.groupNumber ?? "",
            }
          : {}),
      }));
      return;
    }
    prefilledFor.current = id;
    // The read gate and the saved count belong to one patient's chart: opening
    // the next patient re-locks the form and clears the previous chart's score.
    setCardRead(false);
    setTranscription(null);
    const card = registrationCardFor(patient);
    const hasCard = Boolean(card.payerName || card.subscriberId || card.groupNumber || card.payerId);
    // The self-pay decision belongs to the chart, not to the last one opened: a
    // tick left on a patient with no card never carries onto this patient.
    setSelfPay(false);
    setForm((prev) => ({
      ...prev,
      firstName: identity.firstName,
      lastName: identity.lastName,
      dob: identity.dateOfBirth,
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

  // The insurance card carries this case's one deliberate misspelling and the
  // government ID does not. Both documents are on screen, so the student makes
  // that comparison and answers for it; the app prints nothing about it until
  // they have (rule 6). A patient with no card on file has nothing to compare,
  // so the question is not asked.

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
    if (mismatch && !form.nameAgrees) errs.nameAgrees = "Answer the identity question before verifying";
    if (!selfPay) {
      if (!form.payerName.trim()) errs.payerName = "Payer name is required";
      if (!form.subscriberId.trim()) errs.subscriberId = "Subscriber ID is required";
      // A payer that issues no group number (original Medicare) prints N/A, and
      // the box is not required on its claims — the same rule box 11 follows
      // (`domain/claimParties.ts`). Requiring one made a Medicare chart
      // unverifiable without inventing a number.
      if (!form.groupNumber.trim() && payerIssuesGroupNumber(form.payerName)) {
        errs.groupNumber = "Group number is required";
      }
      if (!form.payerId.trim()) errs.payerId = "Payer ID is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const [registrationScore, setRegistrationScore] = useState<number | null>(null);

  // A student's chart opens with the identity and insurance boxes locked until
  // the card has been read. The reference chart (`readOnly`) shows no gate: it
  // is already read-only, and the owner's rule is that it stays unchanged.
  const gateLocked = !readOnly && !cardRead;

  const handleSubmit = () => {
    // Locked boxes are not a form to score: pressing Verify before reading the
    // card says what is missing, and nothing is written or revealed.
    if (gateLocked) {
      setErrors({ readCard: "Read the card above before verifying." });
      return;
    }
    if (validate()) {
      const score = scoreRegistration(
        {
          firstName: form.firstName,
          lastName: form.lastName,
          dob: form.dob,
          subscriberId: form.subscriberId,
          groupNumber: form.groupNumber,
          payerId: form.payerId,
        },
        expectations,
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
            // Keep what an earlier save knew; otherwise, whether a card existed
            // when the student read it.
            cardIssued: patient.insuranceRecord?.cardIssued ?? cardOnFileAtRead ?? card.onFile,
          }),
        );
        setSavedToChart(true);
      }

      // The field count appears only here — after the student has committed
      // their transcription. Counting as they type would name the wrong box
      // before they had decided, which is the answer key on a working screen.
      setTranscription(
        scoreTranscription(
          {
            firstName: form.firstName,
            lastName: form.lastName,
            dob: form.dob,
            payerName: selfPay ? "Self-pay" : form.payerName,
            subscriberId: form.subscriberId,
            groupNumber: form.groupNumber,
            payerId: form.payerId,
            relationship: form.relationship,
          },
          patient,
        ),
      );
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

      {/* ─── The patient's own Driver's License ─── */}
      <div className="rounded-xl border-2 border-yellow-400 bg-yellow-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-yellow-200 pb-2">
          <IdCard className="h-5 w-5 shrink-0 text-yellow-700" />
          <span className="text-sm font-bold uppercase tracking-wider text-yellow-800">Driver's License</span>
          <span className="ml-auto text-[10px] text-yellow-600">State of {onFileOr(card.licenceState)}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <p><span className="text-[10px] font-semibold uppercase text-yellow-700">Name</span><br /><span className="font-medium text-slate-800">{onFileOr(card.fullName)}</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-yellow-700">DOB</span><br /><span className="font-medium text-slate-800">{onFileOr(card.dateOfBirth)}</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-yellow-700">Sex</span><br /><span className="font-medium text-slate-800">{onFileOr(card.sex)}</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-yellow-700">License #</span><br /><span className="font-medium text-slate-800">{onFileOr(card.licenceNumber)}</span></p>
          <p className="sm:col-span-2"><span className="text-[10px] font-semibold uppercase text-yellow-700">Address</span><br /><span className="font-medium text-slate-800">{onFileOr(card.address)}</span></p>
        </div>
      </div>

      {/* ─── The patient's own Insurance Card (Front) ─── */}
      <div className="rounded-xl border-2 border-blue-300 bg-blue-50 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-200 pb-2">
          <CreditCard className="h-5 w-5 shrink-0 text-blue-700" />
          <span className="text-sm font-bold uppercase tracking-wider text-blue-800">Insurance Card — Front</span>
          <span className="ml-auto max-w-full truncate rounded bg-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">{onFileOr(card.payerName)}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {/* What the card prints — the case's one deliberate misspelling lives here. */}
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Member Name</span><br /><span className="font-medium text-slate-800">{onFileOr(mismatch ? mismatch.onCard : card.fullName)}</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Subscriber ID</span><br /><span className="font-medium text-slate-800">{onFileOr(card.memberId)}</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Group Number</span><br /><span className="font-medium text-slate-800">{onFileOr(card.groupNumber)}</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Payer ID</span><br /><span className="font-medium text-slate-800">{onFileOr(card.payerId)}</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Plan</span><br /><span className="font-medium text-slate-800">{onFileOr(card.planName)}</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Relationship</span><br /><span className="font-medium text-slate-800">{onFileOr(card.relationship)}</span></p>
        </div>
        {/* Read the card, then the count. The two things this panel owes the
            student: the gate that unlocks the boxes below, and — only after they
            have saved — how many boxes hold what the documents print. */}
        {!readOnly && (
          <div className="mt-3 flex flex-col gap-1.5 border-t border-blue-200 pt-3">
            {!cardRead ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCardOnFileAtRead(card.onFile);
                    setCardRead(true);
                  }}
                  aria-describedby={READ_CARD_REASON_ID}
                  className="btn-primary min-h-10 self-start"
                >
                  <IdCard className="h-4 w-4" aria-hidden="true" />
                  Read the card
                </button>
                <p id={READ_CARD_REASON_ID} className="text-[11px] text-slate-600">
                  The identity and insurance boxes below stay locked until you have read both
                  documents.
                </p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-blue-800">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Card read — transcribe the boxes below.
                </p>
                {transcription && (
                  <p
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"
                    aria-live="polite"
                  >
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                    {transcription.correct} of {transcription.total} fields transcribed correctly
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Transcription Form ─── */}
      <div className="clinical-card">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Transcribe Patient Information</h4>
        {/* The read gate: every box below, and Verify with them, is locked until
            the card above has been read. The sentence naming the reason sits
            directly above the dead boxes (standing rule 9 / the dead-control
            rule), and the control that unlocks them is the one button on the
            card panel, still pressable. */}
        {gateLocked && (
          <p id={READ_CARD_LOCK_ID} className="mb-3 text-[11px] text-slate-600">
            These boxes are locked — press “Read the card” above to unlock them.
          </p>
        )}
        <fieldset
          disabled={gateLocked}
          aria-describedby={gateLocked ? READ_CARD_LOCK_ID : undefined}
          className="m-0 min-w-0 border-0 p-0"
        >
        {/* Offered only to a patient whose own card names no payer: a chart that
            holds Medicare Part B is never recorded as self-pay (owner rule). */}
        {!cardNamesPayer && (
          <label className="mb-3 flex items-center gap-2 text-[11px] font-medium text-slate-600">
            <input
              type="checkbox"
              checked={selfPay}
              onChange={(e) => setSelfPay(e.target.checked)}
              className="h-3.5 w-3.5 accent-brand-600"
            />
            Record as self-pay — no insurance to bill (coverage is saved as Self-pay)
          </label>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-slate-500">First Name</label>
            <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
              className="mt-1 input-field" placeholder="As printed on the ID" />
            {errors.firstName && <p className="mt-0.5 text-[10px] text-red-500">{errors.firstName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Last Name</label>
            <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
              className="mt-1 input-field" placeholder="As printed on the ID" />
            {errors.lastName && <p className="mt-0.5 text-[10px] text-red-500">{errors.lastName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Date of Birth (MM/DD/YYYY)</label>
            <input type="text" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })}
              className="mt-1 input-field" placeholder="MM/DD/YYYY" />
            {errors.dob && <p className="mt-0.5 text-[10px] text-red-500">{errors.dob}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Payer Name</label>
            <input type="text" value={form.payerName} onChange={e => setForm({ ...form, payerName: e.target.value })}
              className="mt-1 input-field" placeholder="As printed on the card" />
            {errors.payerName && <p className="mt-0.5 text-[10px] text-red-500">{errors.payerName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Subscriber ID</label>
            <input type="text" value={form.subscriberId} onChange={e => setForm({ ...form, subscriberId: e.target.value })}
              className="mt-1 input-field" placeholder="As printed on the card" />
            {errors.subscriberId && <p className="mt-0.5 text-[10px] text-red-500">{errors.subscriberId}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Group Number</label>
            <input type="text" value={form.groupNumber} onChange={e => setForm({ ...form, groupNumber: e.target.value })}
              className="mt-1 input-field" placeholder="As printed on the card" />
            {errors.groupNumber && <p className="mt-0.5 text-[10px] text-red-500">{errors.groupNumber}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Payer ID (EDI)</label>
            <input type="text" value={form.payerId} onChange={e => setForm({ ...form, payerId: e.target.value })}
              className="mt-1 input-field" placeholder="As printed on the card" />
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
        {mismatch && (
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
        )}
        </fieldset>
        <div className="mt-4 flex flex-col items-end">
          <button
            onClick={handleSubmit}
            className="btn-primary disabled:cursor-not-allowed disabled:bg-slate-300"
            {...readOnlyAttrs(readOnly, VERIFY_REASON)}
          >
            {isComplete ? "Re-verify" : "Verify Identity & Insurance"}
          </button>
          {/* Verify stays pressable while the boxes are locked — a dead button is
              the bug — and pressing it says what is missing instead of scoring
              an empty form. */}
          {errors.readCard && (
            <p className="mt-1 text-[10px] text-red-500">{errors.readCard}</p>
          )}
          <ReadOnlyNote readOnly={readOnly} id={VERIFY_REASON} className="max-w-md text-right" />
        </div>
        {isComplete && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Patient identity and insurance verified successfully.
            </div>
            {/* Revealed only after Verify: the student answered first. */}
            {mismatch ? (
              <div className="rounded bg-white/60 p-2 text-slate-700">
                <span className="font-semibold">Identity check — {mismatch.field}</span> · insurance card:
                “{mismatch.onCard}” · government ID: “{mismatch.onLicence}”. {mismatch.consequence}
                {form.nameAgrees === "yes" && (
                  <span className="mt-1 block text-amber-700">
                    You answered that the two names agree — compare the two cards again before the next
                    patient.
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded bg-white/60 p-2 text-slate-700">
                <span className="font-semibold">Identity check</span> — no insurance card is on file for
                this patient, so there is nothing to compare the government ID against. The identity
                question is asked again once a card is on file.
              </div>
            )}
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