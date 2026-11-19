/**
 * Settings — practice data controls (Phase 0, section 6)
 *
 * Inspiration: the "My Account / Data" screen in athenahealth and the export
 * tools in Epic's Chart Search utility — a single, plainly-worded place where a
 * student can see what the simulator has stored about them, move it between
 * computers, or start over.
 *
 * Everything here operates on the one central store (`src/store/ehrStore.ts`):
 *   - Reset my practice data — confirm screen, clears user data, keeps seed data.
 *   - Export all user data as JSON.
 *   - Import a JSON export — validates `schemaVersion` and migrates it.
 */

import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  History,
  RotateCcw,
  ShieldAlert,
  Upload,
  UserRound,
  Database,
} from "lucide-react";
import { getLoggedInPhone, isLoggedIn } from "../store/accessStore";
import {
  SCHEMA_VERSION,
  bootstrapEhrStore,
  flushEhrStore,
  useEhrStore,
  type ActivityEntry,
} from "../store/ehrStore";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

type Status = { tone: "ok" | "error"; message: string } | null;

function SettingsPage() {
  const loggedIn = isLoggedIn();
  const phone = getLoggedInPhone();
  const hydrated = useEhrStore((s) => s.hydrated);
  const patients = useEhrStore((s) => s.user.patients);
  const appointments = useEhrStore((s) => s.user.appointments);
  const caseStates = useEhrStore((s) => s.user.caseStates);
  const dental = useEhrStore((s) => s.user.dental);
  const activity = useEhrStore((s) => s.user.activity);
  const seedPatients = useEhrStore((s) => s.seedPatients);
  const resetUserData = useEhrStore((s) => s.resetUserData);
  const exportUserData = useEhrStore((s) => s.exportUserData);
  const importUserData = useEhrStore((s) => s.importUserData);

  const [confirmReset, setConfirmReset] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    bootstrapEhrStore(getLoggedInPhone());
  }, []);

  const handleExport = () => {
    const json = exportUserData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hh-practice-data-${(phone ?? "local").replace(/\D/g, "") || "local"}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus({ tone: "ok", message: "Exported. Keep that file to move your work to another computer." });
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const result = importUserData(text);
    if (!result.ok) {
      setStatus({ tone: "error", message: result.error ?? "That file could not be imported." });
      return;
    }
    flushEhrStore();
    setStatus({
      tone: "ok",
      message: `Imported ${result.counts?.patients ?? 0} patient(s) and ${
        result.counts?.appointments ?? 0
      } appointment(s).`,
    });
  };

  const handleReset = async () => {
    await resetUserData();
    setConfirmReset(false);
    setStatus({
      tone: "ok",
      message: "Practice data cleared. The built-in demo patients are still here.",
    });
  };

  if (!loggedIn || !phone) {
    return (
      <div className="brand-gradient flex min-h-dvh flex-col items-center justify-center p-4">
        <div className="surface-card w-full max-w-sm p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-brand-500" />
          <h1 className="text-base font-bold text-slate-800">Settings</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to manage your practice data.</p>
          <Link to="/login" className="btn-primary mt-4 w-full">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-brand-700 via-brand-600 to-brand-400 px-5 py-4 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight">Settings</h1>
            <p className="text-[11px] text-brand-100">
              Practice data for {phone} · schema v{SCHEMA_VERSION}
            </p>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-5">
        {status && (
          <div
            className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
              status.tone === "ok"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {status.tone === "ok" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {/* ── What is stored ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserRound className="h-4 w-4 text-brand-600" /> What this device has stored for you
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Your patients, appointments and per-patient workflow state are saved automatically to
            this browser. The built-in demo patients are separate and always available.
          </p>
          {!hydrated ? (
            <p className="mt-3 text-xs italic text-slate-400">Loading your saved data…</p>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Patients you registered" value={patients.length} />
              <Stat label="Appointments you booked" value={appointments.length} />
              <Stat label="Patient case files" value={Object.keys(caseStates).length} />
              <Stat label="Dental track saved" value={dental ? "Yes" : "No"} />
            </dl>
          )}
        </section>

        {/* ── Activity log (Phase 0, section 7) ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <History className="h-4 w-4 text-brand-600" /> Activity log
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Every patient, appointment and note you create, edit or delete is recorded here — when
            it happened, in which role, for which patient, and what changed. Newest first.
          </p>
          {!hydrated ? (
            <p className="mt-3 text-xs italic text-slate-400">Loading your saved data…</p>
          ) : activity.length === 0 ? (
            <p className="mt-3 text-xs italic text-slate-400">
              No activity yet. Register a patient or start a note and it appears here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {[...activity]
                .reverse()
                .slice(0, 50)
                .map((entry, i) => (
                  <ActivityRow
                    key={`${entry.time}-${i}`}
                    entry={entry}
                    patientName={patientLabel(entry.patientId, patients, seedPatients)}
                  />
                ))}
            </ul>
          )}
          {activity.length > 50 && (
            <p className="mt-2 text-[10px] text-slate-400">
              Showing the 50 most recent of {activity.length} entries.
            </p>
          )}
        </section>

        {/* ── Export / import ── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Download className="h-4 w-4 text-brand-600" /> Move your work between computers
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Export writes every record you own — patients, appointments and workflow state — to one
            JSON file. Import reads such a file back, checking its schema version first.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-500"
            >
              <Download className="h-3.5 w-3.5" /> Export all user data (JSON)
            </button>
            <button
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Upload className="h-3.5 w-3.5" /> Import a JSON export
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void handleImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        {/* ── Reset ── */}
        <section className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <RotateCcw className="h-4 w-4 text-red-600" /> Reset my practice data
          </h2>
          {!confirmReset ? (
            <>
              <p className="mt-1 text-[11px] text-slate-500">
                Clears every patient you registered, every appointment you booked and all workflow
                state on this device. The built-in demo patients stay.
              </p>
              <button
                onClick={() => setConfirmReset(true)}
                className="mt-3 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset my practice data
              </button>
            </>
          ) : (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold text-red-800">
                Delete all of your practice data on this device?
              </p>
              <p className="mt-1 text-[11px] text-red-700">
                This cannot be undone. Export a copy first if you want to keep your work.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void handleReset()}
                  className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
                >
                  Yes, reset my data
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        <p className="pb-4 text-center text-[10px] text-slate-400">
          Simulated data, not for clinical use. All patients are fictional.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold text-slate-800">{value}</dd>
    </div>
  );
}

// ─── Activity log rendering (Phase 0, section 7) ───────────────────

type NamedPatient = { id: string; firstName: string; lastName: string };

function patientLabel(
  patientId: string | null,
  patients: NamedPatient[],
  seedPatients: NamedPatient[],
): string {
  if (!patientId) return "no patient";
  const found = [...patients, ...seedPatients].find((p) => p.id === patientId);
  return found ? `${found.firstName} ${found.lastName}` : `patient ${patientId.slice(0, 10)}`;
}

/** One before/after value as plain text — objects become `key: value` pairs. */
function describeValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value || "—";
  if (typeof value === "object") {
    const parts = Object.entries(value as Record<string, unknown>).map(
      ([key, inner]) => `${key}: ${String(inner)}`,
    );
    return parts.length > 0 ? parts.join(", ") : "—";
  }
  return String(value);
}

function ActivityRow({ entry, patientName }: { entry: ActivityEntry; patientName: string }) {
  const time = new Date(entry.time).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const before = describeValue(entry.before);
  const after = describeValue(entry.after);
  return (
    <li className="py-2" title={`Recorded by ${entry.user}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px]">
        <span className="font-mono text-[10px] text-slate-400">{time}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
          {entry.role}
        </span>
        <span className="font-medium text-slate-700">
          {entry.action === "create" ? "Created" : entry.action === "delete" ? "Deleted" : "Edited"}{" "}
          {entry.entity}
        </span>
        <span className="text-slate-400">· {patientName}</span>
      </div>
      {(entry.before !== undefined || entry.after !== undefined) && (
        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
          {entry.before !== undefined && (
            <span className="text-slate-400 line-through decoration-slate-300">{before}</span>
          )}
          {entry.before !== undefined && entry.after !== undefined && <span> → </span>}
          {entry.after !== undefined && <span className="text-slate-600">{after}</span>}
        </p>
      )}
    </li>
  );
}
