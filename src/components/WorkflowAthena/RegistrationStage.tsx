/**
 * RegistrationStage — Patient Intake & Registration
 *
 * Inspiration: Front-desk check-in terminal UI concept.
 * Displays mock Driver's License and Insurance Card,
 * then challenges the student to transcribe fields correctly.
 * Educational twist: Insurance card says "Jonathon" but
 * Driver's License says "Jonathan" — blind copying triggers
 * a name mismatch warning.
 */

import { useState } from "react";
import { CreditCard, IdCard, AlertTriangle, CheckCircle2, XCircle, User, Calendar, Hash, Building } from "lucide-react";

export function RegistrationStage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    subscriberId: "",
    groupNumber: "",
    payerId: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The insurance card says "Jonathon" — blind copy reveals mismatch
  const expectsJonathon = form.firstName.toLowerCase() === "jonathon";

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.firstName.trim()) errs.firstName = "First name is required";
    if (!form.lastName.trim()) errs.lastName = "Last name is required";
    if (!form.dob.trim()) errs.dob = "Date of birth is required";
    else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.dob.trim())) errs.dob = "Use MM/DD/YYYY format";
    if (!form.subscriberId.trim()) errs.subscriberId = "Subscriber ID is required";
    if (!form.groupNumber.trim()) errs.groupNumber = "Group number is required";
    if (!form.payerId.trim()) errs.payerId = "Payer ID is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      setSubmitted(true);
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
          <span className="ml-auto rounded bg-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">Anthem Blue Cross</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Member Name</span><br /><span className="font-medium text-slate-800">Jonathon Doe</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Subscriber ID</span><br /><span className="font-medium text-slate-800">XYZ987654321</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Group Number</span><br /><span className="font-medium text-slate-800">GRP-4477</span></p>
          <p><span className="text-[10px] font-semibold uppercase text-blue-700">Payer ID</span><br /><span className="font-medium text-slate-800">ANTHEM01</span></p>
        </div>
      </div>

      {/* ─── Name Mismatch Warning ─── */}
      {expectsJonathon && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-xs font-semibold text-amber-800">⚠ Name mismatch detected</p>
            <p className="text-[11px] text-amber-700">
              The insurance card says "Jonathon" but the Driver's License says "Jonathan".
              Verify subscriber name against government ID before proceeding.
            </p>
          </div>
        </div>
      )}

      {/* ─── Transcription Form ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Transcribe Patient Information</h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-[11px] font-medium text-slate-500">First Name</label>
            <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="e.g. Jonathan" />
            {errors.firstName && <p className="mt-0.5 text-[10px] text-red-500">{errors.firstName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Last Name</label>
            <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="e.g. Doe" />
            {errors.lastName && <p className="mt-0.5 text-[10px] text-red-500">{errors.lastName}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Date of Birth (MM/DD/YYYY)</label>
            <input type="text" value={form.dob} onChange={e => setForm({ ...form, dob: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="e.g. 04/15/1988" />
            {errors.dob && <p className="mt-0.5 text-[10px] text-red-500">{errors.dob}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Subscriber ID</label>
            <input type="text" value={form.subscriberId} onChange={e => setForm({ ...form, subscriberId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="e.g. XYZ987654321" />
            {errors.subscriberId && <p className="mt-0.5 text-[10px] text-red-500">{errors.subscriberId}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Group Number</label>
            <input type="text" value={form.groupNumber} onChange={e => setForm({ ...form, groupNumber: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="e.g. GRP-4477" />
            {errors.groupNumber && <p className="mt-0.5 text-[10px] text-red-500">{errors.groupNumber}</p>}
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500">Payer ID</label>
            <input type="text" value={form.payerId} onChange={e => setForm({ ...form, payerId: e.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400" placeholder="e.g. ANTHEM01" />
            {errors.payerId && <p className="mt-0.5 text-[10px] text-red-500">{errors.payerId}</p>}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
            {isComplete ? "Re-verify" : "Verify Identity & Insurance"}
          </button>
        </div>
        {isComplete && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-xs text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            Patient identity and insurance verified successfully.
          </div>
        )}
      </div>
    </div>
  );
}