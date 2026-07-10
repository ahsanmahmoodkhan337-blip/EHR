/**
 * AdminPage — Admin Panel for Access Request Management
 *
 * Password-gated admin dashboard where administrators can:
 * - View all pending access requests
 * - Approve or reject requests
 * - See approved phone numbers
 * - Simple authentication with "admin123" password
 *
 * Inspiration: Epic security / admin workflow
 */

import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  LogOut,
  Key,
  Lock,
  Eye,
  EyeOff,
  Save,
  UserPlus,
  Trash2,
} from "lucide-react";
import {
  getAccessRequests,
  updateRequestStatus,
  getApprovedPhones,
  getSessionTimeoutMinutes,
  setSessionTimeoutMinutes,
  type AccessRequest,
} from "../store/accessStore";
import {
  getAllPins,
  setStagePin,
  resetAllPins,
  getStagePin,
  type StagePinMap,
} from "../store/pinStore";
import type { Role } from "../store/pipelineStore";
import { WhatsAppFloat } from "../components/WhatsAppFloat";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [approvedPhones, setApprovedPhones] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pins, setPins] = useState<StagePinMap>({ scribe: "1111", coder: "2222", biller: "3333", "prior-auth": "4444", "ar-voice": "5555" });
  const [editPinRole, setEditPinRole] = useState<Role | null>(null);
  const [editPinValue, setEditPinValue] = useState("");
  const [showPins, setShowPins] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(getSessionTimeoutMinutes());
  const [timeoutSaved, setTimeoutSaved] = useState(false);

  // Load data from localStorage
  useEffect(() => {
    if (authenticated) {
      setRequests(getAccessRequests());
      setApprovedPhones(getApprovedPhones());
      setPins(getAllPins());
      setEditPinRole(null);
      setPinSaved(false);
    }
  }, [authenticated, refreshKey]);

  const handleLogin = () => {
    if (password === "Khankhail@1122") {
      setAuthenticated(true);
      setPasswordError("");
    } else {
      setPasswordError("Invalid admin password");
    }
  };

  const handleApprove = (id: string) => {
    updateRequestStatus(id, "approved");
    setRefreshKey((k) => k + 1);
  };

  const handleReject = (id: string) => {
    updateRequestStatus(id, "rejected");
    setRefreshKey((k) => k + 1);
  };

  const handleSavePin = (role: Role) => {
    if (editPinValue.length >= 4) {
      updateStagePin(role, editPinValue);
      setPins(getAllPins());
      setEditPinRole(null);
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2000);
    }
  };

  if (!authenticated) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-900 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-6 shadow-xl">
          <div className="mb-6 text-center">
            <Shield className="mx-auto mb-3 h-10 w-10 text-sky-400" />
            <h1 className="text-lg font-bold text-white">Admin Panel</h1>
            <p className="text-sm text-slate-400">Enter admin password to continue</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Enter admin password"
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-sky-500"
            />
            {passwordError && (
              <p className="text-xs text-red-400">{passwordError}</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full rounded-lg bg-sky-500 py-2.5 text-sm font-medium text-white hover:bg-sky-600"
            >
              Sign In
            </button>
          </div>
          <div className="mt-4 text-center">
            <Link to="/" className="text-xs text-slate-500 underline hover:text-slate-300">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "pending");
  const approvedRequests = requests.filter((r) => r.status === "approved");
  const rejectedRequests = requests.filter((r) => r.status === "rejected");

  return (
    <div className="min-h-dvh bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-sky-400" />
          <h1 className="text-sm font-bold text-white">Admin Panel</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
          <button
            onClick={() => setAuthenticated(false)}
            className="flex items-center gap-1 rounded-lg bg-red-900/50 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900"
          >
            <LogOut className="h-3 w-3" />
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-4 py-6">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-400">Pending</p>
            <p className="text-2xl font-bold text-amber-400">{pendingRequests.length}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-400">Approved</p>
            <p className="text-2xl font-bold text-green-400">{approvedRequests.length}</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-400">Approved Phones</p>
            <p className="text-2xl font-bold text-sky-400">{approvedPhones.length}</p>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800">
          <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
            <Clock className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">Pending Requests</h2>
            <span className="rounded-full bg-amber-900/50 px-2 py-0.5 text-[10px] font-medium text-amber-300">
              {pendingRequests.length}
            </span>
          </div>
          {pendingRequests.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No pending requests</div>
          ) : (
            <div className="divide-y divide-slate-700">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{req.fullName}</p>
                    <p className="text-xs text-slate-400">
                      {req.phone} | {req.paymentMethod} | ID: {req.transactionId}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(req.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Approved */}
          <div className="rounded-xl border border-slate-700 bg-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
              <h2 className="text-sm font-semibold text-white">Approved</h2>
            </div>
            {approvedRequests.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">None</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {approvedRequests.slice(0, 5).map((req) => (
                  <div key={req.id} className="px-4 py-2">
                    <p className="text-xs text-white">{req.fullName}</p>
                    <p className="text-[10px] text-slate-400">{req.phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approved Phone Numbers */}
          <div className="rounded-xl border border-slate-700 bg-slate-800">
            <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
              <Shield className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">Active Logins</h2>
            </div>
            {approvedPhones.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">No active logins</div>
            ) : (
              <div className="divide-y divide-slate-700">
                {approvedPhones.map((phone) => (
                  <div key={phone} className="px-4 py-2">
                    <p className="text-xs text-white">{phone}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── PIN Management ─── */}
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <Key className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">Stage PIN Management</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPins(!showPins)}
                className="flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1 text-[10px] text-slate-300 hover:bg-slate-600"
              >
                {showPins ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showPins ? "Hide" : "Show"}
              </button>
              <button
                onClick={() => {
                  resetAllPins();
                  setPins(getAllPins());
                  setPinSaved(true);
                  setTimeout(() => setPinSaved(false), 2000);
                }}
                className="flex items-center gap-1 rounded-lg bg-red-900/50 px-2.5 py-1 text-[10px] text-red-300 hover:bg-red-800"
              >
                Reset All to Defaults
              </button>
              {pinSaved && (
                <span className="text-[10px] text-green-400">PIN saved!</span>
              )}
            </div>
          </div>
          <div className="divide-y divide-slate-700">
            {(Object.entries(pins) as [Role, string][]).map(([role, pin]) => (
              <div key={role} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-sm text-slate-200">
                    {role === "prior-auth" ? "Prior Auth" :
                     role === "ar-voice" ? "AR Voice" :
                     role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {editPinRole === role ? (
                    <>
                      <input
                        type="text"
                        value={editPinValue}
                        onChange={(e) => setEditPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        onKeyDown={(e) => e.key === "Enter" && handleSavePin(role)}
                        className="w-20 rounded border border-sky-600 bg-slate-700 px-2 py-1 text-center text-xs text-white outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSavePin(role)}
                        className="flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-green-500"
                      >
                        <Save className="h-3 w-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditPinRole(null)}
                        className="rounded bg-slate-600 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-500"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`font-mono text-sm ${showPins ? "text-sky-300" : "text-slate-500"}`}>
                        {showPins ? pin : "••••"}
                      </span>
                      <button
                        onClick={() => {
                          setEditPinRole(role);
                          setEditPinValue(pin);
                        }}
                        className="rounded bg-slate-700 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-600 hover:text-white"
                      >
                        Change
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Session Timeout ─── */}
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-400" />
              <h2 className="text-sm font-semibold text-white">Session Timeout</h2>
            </div>
            {timeoutSaved && (
              <span className="text-[10px] text-green-400">Saved!</span>
            )}
          </div>
          <div className="p-4">
            <p className="text-xs text-slate-400 mb-3">
              Automatically revoke student credentials after a set period of inactivity.
              Set to 0 to disable auto-logout.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-medium text-slate-500 mb-1">Timeout Duration</label>
                <select
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(parseInt(e.target.value))}
                  className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
                >
                  <option value="0">No timeout (disabled)</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                  <option value="480">8 hours</option>
                  <option value="1440">24 hours</option>
                </select>
              </div>
              <button
                onClick={() => {
                  setSessionTimeoutMinutes(sessionTimeout);
                  setRefreshKey((k) => k + 1);
                }}
                className="mt-5 flex items-center gap-1 rounded-lg bg-sky-600 px-4 py-2 text-xs font-medium text-white hover:bg-sky-500"
              >
                <Save className="h-3.5 w-3.5" />
                Apply
              </button>
            </div>
            {sessionTimeout > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-sky-900/30 px-3 py-2">
                <Clock className="h-3.5 w-3.5 text-sky-400" />
                <p className="text-[10px] text-sky-300">
                  Students will be automatically logged out after <strong>{sessionTimeout} minutes</strong> of inactivity.
                  Their session resets each time they log in.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Scenario Builder */}
      <div className="mt-6 rounded-xl border border-slate-700 bg-slate-800 p-4">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-sky-400" />
          <h3 className="text-xs font-bold text-slate-200">Scenario Builder</h3>
          <span className="rounded-full bg-indigo-900/50 px-2 py-0.5 text-[9px] font-medium text-indigo-300">Create Custom Patient</span>
        </div>
        <ScenarioBuilder />
      </div>

      <div className="mt-6 text-center">
          <Link to="/" className="text-xs text-slate-500 underline hover:text-slate-300">
            Back to home
          </Link>
        </div>
      </div>

      <WhatsAppFloat />
    </div>
  );
}

// ─── Scenario Builder Component ──────────────────────────────────

interface CustomPatient {
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  problems: string[];
  medications: string[];
  insurance: string;
  vitals: { bp: string; hr: string; temp: string; rr: string; o2: string };
}

function ScenarioBuilder() {
  const [patients, setPatients] = useState<CustomPatient[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("hh_custom_patients") || "[]");
    } catch { return []; }
  });
  const [form, setForm] = useState<CustomPatient>({
    id: `CP-${Date.now()}`,
    firstName: "", lastName: "", age: 35, gender: "Male",
    chiefComplaint: "", problems: [], medications: [], insurance: "",
    vitals: { bp: "120/80", hr: "72", temp: "98.6", rr: "16", o2: "98" },
  });
  const [problemInput, setProblemInput] = useState("");
  const [medInput, setMedInput] = useState("");
  const [saved, setSaved] = useState(false);

  const savePatient = () => {
    if (!form.firstName.trim()) return;
    const newPatient = { ...form, id: `CP-${Date.now()}` };
    const updated = [...patients, newPatient];
    setPatients(updated);
    localStorage.setItem("hh_custom_patients", JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm({ id: `CP-${Date.now()}`, firstName: "", lastName: "", age: 35, gender: "Male", chiefComplaint: "", problems: [], medications: [], insurance: "", vitals: { bp: "120/80", hr: "72", temp: "98.6", rr: "16", o2: "98" } });
  };

  const deletePatient = (id: string) => {
    const updated = patients.filter(p => p.id !== id);
    setPatients(updated);
    localStorage.setItem("hh_custom_patients", JSON.stringify(updated));
  };

  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });
  const updateVital = (field: string, value: string) => setForm({ ...form, vitals: { ...form.vitals, [field]: value } });

  return (
    <div className="space-y-3">
      {/* Form */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">First Name</label>
          <input type="text" value={form.firstName} onChange={e => updateField("firstName", e.target.value)} placeholder="Jane" className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Last Name</label>
          <input type="text" value={form.lastName} onChange={e => updateField("lastName", e.target.value)} placeholder="Doe" className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Age</label>
          <input type="number" value={form.age} onChange={e => updateField("age", parseInt(e.target.value) || 0)} min={0} max={120} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Gender</label>
          <select value={form.gender} onChange={e => updateField("gender", e.target.value)} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400">
            <option>Male</option><option>Female</option><option>Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Chief Complaint</label>
          <input type="text" value={form.chiefComplaint} onChange={e => updateField("chiefComplaint", e.target.value)} placeholder="Chest pain and shortness of breath" className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400" />
        </div>
        <div>
          <label className="mb-1 block text-[9px] font-medium text-slate-400">Insurance</label>
          <input type="text" value={form.insurance} onChange={e => updateField("insurance", e.target.value)} placeholder="Blue Cross PPO" className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400" />
        </div>
      </div>
      {/* Vitals */}
      <div className="grid grid-cols-5 gap-2">
        {["bp", "hr", "temp", "rr", "o2"].map(v => (
          <div key={v}>
            <label className="mb-1 block text-[9px] font-medium text-slate-400 uppercase">{v}</label>
            <input type="text" value={(form.vitals as any)[v]} onChange={e => updateVital(v, e.target.value)} className="w-full rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400" />
          </div>
        ))}
      </div>
      {/* Problems */}
      <div>
        <label className="mb-1 block text-[9px] font-medium text-slate-400">Problems</label>
        <div className="flex gap-1 mb-1">
          <input type="text" value={problemInput} onChange={e => setProblemInput(e.target.value)} placeholder="e.g. Essential hypertension (I10)" className="flex-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400" />
          <button onClick={() => { if (problemInput.trim()) { updateField("problems", [...form.problems, problemInput.trim()]); setProblemInput(""); } }} className="rounded bg-sky-600 px-2 py-1 text-[10px] text-white">Add</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {form.problems.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-sky-900/50 px-1.5 py-0.5 text-[9px] text-sky-300">
              {p}
              <button onClick={() => updateField("problems", form.problems.filter((_, j) => j !== i))} className="text-sky-400 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      </div>
      {/* Medications */}
      <div>
        <label className="mb-1 block text-[9px] font-medium text-slate-400">Medications</label>
        <div className="flex gap-1 mb-1">
          <input type="text" value={medInput} onChange={e => setMedInput(e.target.value)} placeholder="e.g. Lisinopril 10mg" className="flex-1 rounded border border-slate-600 bg-slate-700 px-2 py-1 text-[10px] text-white outline-none focus:border-sky-400" />
          <button onClick={() => { if (medInput.trim()) { updateField("medications", [...form.medications, medInput.trim()]); setMedInput(""); } }} className="rounded bg-sky-600 px-2 py-1 text-[10px] text-white">Add</button>
        </div>
        <div className="flex flex-wrap gap-1">
          {form.medications.map((m, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded bg-emerald-900/50 px-1.5 py-0.5 text-[9px] text-emerald-300">
              {m}
              <button onClick={() => updateField("medications", form.medications.filter((_, j) => j !== i))} className="text-emerald-400 hover:text-red-400">×</button>
            </span>
          ))}
        </div>
      </div>
      {/* Save */}
      <div className="flex items-center gap-2">
        <button onClick={savePatient} className="flex items-center gap-1 rounded-lg bg-sky-600 px-4 py-2 text-[10px] font-medium text-white hover:bg-sky-500">
          <Save className="h-3 w-3" />
          {saved ? "Saved!" : "Save Patient Scenario"}
        </button>
      </div>
      {/* Saved patients list */}
      {patients.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          <p className="text-[10px] font-medium text-slate-400 mb-2">Custom Patients ({patients.length})</p>
          <div className="space-y-1">
            {patients.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded bg-slate-700/50 px-2 py-1">
                <span className="text-[10px] text-slate-300">{p.firstName} {p.lastName} — {p.chiefComplaint?.slice(0, 40)}</span>
                <button onClick={() => deletePatient(p.id)} className="text-red-400 hover:text-red-300"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}