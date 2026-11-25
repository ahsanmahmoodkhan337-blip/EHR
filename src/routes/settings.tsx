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
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Download,
  History,
  Laptop,
  RotateCcw,
  ShieldAlert,
  Upload,
  UserRound,
} from "lucide-react";
import { getLoggedInPhone, isLoggedIn } from "../store/accessStore";
import { getSharingSignal, MAX_DEVICE_COUNT, resetOtherSessions } from "../store/accountSecurity";
import { PatientProvider } from "../store/patientStore";
import { AppShell } from "../components/AppShell";
import { useActiveTrack } from "../components/shell/activeTrack";
import { requestPatientOpen } from "../components/shell/pendingPatient";
import {
  SCHEMA_VERSION,
  bootstrapEhrStore,
  flushEhrStore,
  readChartFromIdb,
  useEhrStore,
  type ActivityEntry,
} from "../store/ehrStore";
import { RESET_GROUPS, buildResetExport, type ResetGroupId } from "../store/resetData";
import { localDay } from "../utils/localDay";

export const Route = createFileRoute("/settings")({
  // Same shell as every other page; the top bar's search needs the patient list.
  component: () => (
    <PatientProvider>
      <SettingsPage />
    </PatientProvider>
  ),
});

type Status = { tone: "ok" | "error"; message: string } | null;

function SettingsPage() {
  const track = useActiveTrack();
  const navigate = useNavigate();
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

  const [resetOpen, setResetOpen] = useState(false);
  const [chosen, setChosen] = useState<ResetGroupId[]>([]);
  const [typed, setTyped] = useState("");
  const [exporting, setExporting] = useState(false);
  const [resettingDevices, setResettingDevices] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    bootstrapEhrStore(getLoggedInPhone());
  }, []);

  // The confirm button is never the default focus (spec: not the default).
  useEffect(() => {
    if (resetOpen) cancelRef.current?.focus();
  }, [resetOpen]);

  const download = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const phoneTag = (phone ?? "local").replace(/\D/g, "") || "local";

  const handleExport = () => {
    const json = exportUserData();
    download(json, `hh-practice-data-${phoneTag}-${localDay()}.json`);
    setStatus({ tone: "ok", message: "Exported. Keep that file to move your work to another computer." });
  };

  /** The copy the student keeps: every store the dialog lists, plus the chart. */
  const handleResetExport = async () => {
    setExporting(true);
    setStatus(null);
    try {
      const json = await buildResetExport(
        phone ?? "",
        RESET_GROUPS.map((group) => group.id),
        () => readChartFromIdb(phone ?? ""),
      );
      download(json, `hh-data-before-reset-${phoneTag}-${localDay()}.json`);
      setStatus({ tone: "ok", message: "Export saved. Check your downloads before you delete." });
    } finally {
      setExporting(false);
    }
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

  const chosenLabels = RESET_GROUPS.filter((group) => chosen.includes(group.id)).map(
    (group) => group.label,
  );
  /** Why the delete button is off, in words the button itself carries. */
  const blockedReason = exporting
    ? "Wait for the export to finish."
    : chosen.length === 0
      ? "Choose at least one group to delete."
      : typed.trim() !== "RESET"
        ? "Type RESET to confirm."
        : null;

  const handleReset = async () => {
    if (blockedReason) return;
    const groups = [...chosen];
    await resetUserData(groups);
    // Reload what is left, so the screen shows the truth straight away.
    bootstrapEhrStore(phone);
    setResetOpen(false);
    setChosen([]);
    setTyped("");
    setStatus({
      tone: "ok",
      message: `Deleted: ${chosenLabels.join(", ")}. Nothing else was touched.`,
    });
  };

  const closeReset = () => {
    setResetOpen(false);
    setChosen([]);
    setTyped("");
  };

  // "Sign out other devices" — clears every other binding, keeps this one. It
  // lives here now: the dashboard footer's device line moved to Settings (owner's
  // student-experience work order, 2026-11-21, item 6).
  const handleResetOtherDevices = async () => {
    if (!phone) return;
    setResettingDevices(true);
    try {
      await resetOtherSessions(phone);
      window.location.reload();
    } finally {
      setResettingDevices(false);
    }
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

  // The device-binding signal the dashboard footer used to print.
  const signal = getSharingSignal(phone);

  return (
    <>
    <AppShell
      track={track}
      activeNav="settings"
      onPatientSelect={(patientId) => {
        // Settings has no patient workspace: open the chart at "/".
        requestPatientOpen(patientId);
        void navigate({ to: "/" });
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50">
        <div className="mx-auto max-w-3xl space-y-4 p-5">
          <div>
            <h1 className="text-base font-bold leading-tight text-slate-800">Settings</h1>
            <p className="text-[11px] text-slate-500">
              Practice data for {phone} · schema v{SCHEMA_VERSION}
            </p>
          </div>
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
            this browser. The autosave indicator in the top bar shows when the last save happened,
            and says so if a save fails. The built-in demo patients are teaching charts, not yours:
            they stay out of your Inbox and patient list, and you open them from Practice Cases.
            The Tutorial Patient is the one chart always pinned in your Inbox.
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

        {/* ── Where you are signed in ──
            Moved here from the dashboard footer (owner's student-experience work
            order, 2026-11-21, item 6): the device-binding line and the
            "Sign out other devices" control belong with the account controls,
            not on the screen a student works from. Same wording, same rule. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Laptop className="h-4 w-4 text-brand-600" /> Where you are signed in
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            Your sign-in is bound to the devices it is used from. A second device
            shows here, so sharing an account is visible.
          </p>
          <p className="mt-2 text-xs text-slate-600">
            {signal.distinctDeviceCount > 0 ? (
              <span>
                Signed in on {signal.distinctDeviceCount} device
                {signal.distinctDeviceCount === 1 ? "" : "s"}
                {signal.lastLoginAt
                  ? ` · last sign-in ${new Date(signal.lastLoginAt).toLocaleString()}`
                  : ""}
              </span>
            ) : (
              <span>First sign-in on this device</span>
            )}
            {signal.flagged && (
              <span
                className="ml-1 text-amber-600"
                title="This account has been used from more than one device or had overlapping sessions."
              >
                (multi-device)
              </span>
            )}
          </p>
          {signal.distinctDeviceCount > 1 && (
            <button
              type="button"
              onClick={handleResetOtherDevices}
              disabled={resettingDevices}
              className="mt-3 flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              title={`Sign out every other device and keep only this one (device limit: ${MAX_DEVICE_COUNT}).`}
            >
              {resettingDevices ? "Signing out…" : "Sign out other devices"}
            </button>
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
              aria-label="Choose a JSON export file to import"
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
          <p className="mt-1 text-[11px] text-slate-500">
            You choose what to delete. Nothing you did not tick is touched.
          </p>
          <button
            onClick={() => setResetOpen(true)}
            className="mt-3 flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset my practice data
          </button>
        </section>

        <p className="pb-4 text-center text-[10px] text-slate-400">
          Simulated data, not for clinical use. All patients are fictional.
        </p>
        </div>
      </div>
    </AppShell>

      {resetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
          onKeyDown={(e) => {
            if (e.key === "Escape") closeReset();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl"
          >
            <h2 id="reset-title" className="text-sm font-semibold text-slate-800">
              Delete saved data
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              This cannot be undone. Export a copy first if you want to keep your work.
            </p>

            <fieldset className="mt-3">
              <legend className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                What to delete
              </legend>
              <ul className="mt-1 divide-y divide-slate-100">
                {RESET_GROUPS.map((group) => {
                  const checked = chosen.includes(group.id);
                  return (
                    <li key={group.id}>
                      <label className="flex min-h-[44px] cursor-pointer items-start gap-2 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setChosen((prev) =>
                              prev.includes(group.id)
                                ? prev.filter((id) => id !== group.id)
                                : [...prev, group.id],
                            )
                          }
                          className="mt-0.5 h-4 w-4 shrink-0 accent-red-600"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-700">
                            {group.label}
                          </span>
                          <span className="block text-[11px] leading-snug text-slate-500">
                            {group.holds}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>

            <button
              onClick={() => void handleResetExport()}
              disabled={exporting}
              className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <Download className="h-3.5 w-3.5" />
              {exporting ? "Preparing export…" : "Download my data (JSON)"}
            </button>

            <label className="mt-3 block">
              <span className="text-[11px] font-semibold text-slate-600">
                Type RESET to confirm
              </span>
              <input
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="RESET"
                className="mt-1 min-h-[40px] w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              />
            </label>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => void handleReset()}
                disabled={blockedReason !== null}
                title={blockedReason ?? undefined}
                aria-describedby="reset-blocked"
                className="min-h-[40px] flex-1 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                Delete {chosenLabels.length > 0 ? `${chosenLabels.length} selected` : "selected data"}
              </button>
              <button
                ref={cancelRef}
                onClick={closeReset}
                className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                Cancel
              </button>
            </div>
            <p id="reset-blocked" className="mt-2 text-[10px] text-slate-500" aria-live="polite">
              {blockedReason ?? `Deletes: ${chosenLabels.join(", ")}.`}
            </p>
          </div>
        </div>
      )}
    </>
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
