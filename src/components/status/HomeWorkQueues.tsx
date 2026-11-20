/**
 * HomeWorkQueues.tsx — the Home page's work queues, medical and dental
 *
 * Inspired by: Epic's "My Workqueue" worklist and athenahealth's Anytime
 * worklists — the screen a biller opens first, which answers "what is waiting
 * on me right now?" with counts that can each be opened and traced back to the
 * record that produced them.
 *
 * Every number on this panel is DERIVED on render from the student's own saved
 * records and from nothing else:
 *
 *  - the medical encounter store (`store.encounters`). A claim's status there is
 *    written only by that claim's append-only timeline (`domain/statusEvent`), so
 *    "submitted", "accepted", "draft" and "scrubbed" are things the student's own
 *    work recorded, not flags set by this screen;
 *  - the AR work queue (`domain/arWorkQueue`), itself derived from posted 835s
 *    and the ledger — an item exists only where money exists;
 *  - the dental track record (`hh_dental_track_<phone>`), read through the same
 *    `migrateDentalTrackState` the dental provider uses, so this panel can never
 *    read a shape the dental screens would not.
 *
 * Nothing here is stored, estimated or hardcoded, and nothing here writes. A
 * queue that holds nothing says **"No data yet — nothing waiting"** and names
 * the step that would fill it, instead of showing a 0 that looks like a real
 * queue. Each entry links to the stage that holds the work.
 */

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Hourglass,
  Smile,
  Stethoscope,
  Wallet,
} from "lucide-react";

import { usePipeline, type Role } from "../../store/pipelineStore";
import { usePatientStore } from "../../store/patientStore";
import { readDentalTrackRecord } from "../dental/DentalTrackStore";
import {
  buildDentalQueueRows,
  buildMedicalQueueRows,
  type QueueEntry,
  type QueueRow,
} from "../../domain/homeWorkQueues";

export interface HomeWorkQueuesProps {
  /**
   * Open a patient at the role whose stage holds the work. Home's stages are
   * workspace views rather than URLs, so this is the in-app navigation the row
   * performs — the same one the patient list uses.
   */
  onOpenMedicalStage: (patientId: string | null, role: Role) => void;
}

export function HomeWorkQueues({ onOpenMedicalStage }: HomeWorkQueuesProps) {
  const { allEncounters, arWorkItems, getRoleLabel } = usePipeline();
  const { getPatientById } = usePatientStore();
  const [openState, setOpenState] = useState<boolean | null>(null);

  // Read the dental record once, on mount. Dental work happens on the dental
  // track; the queues here reflect what that track last saved.
  const dental = useMemo(() => readDentalTrackRecord(), []);

  const nameForPatient = (patientId: string | null | undefined, fallback?: string | null): string => {
    const p = patientId ? getPatientById(patientId) : undefined;
    if (p) return `${p.firstName} ${p.lastName}`;
    if (fallback) return fallback;
    return "No patient attached";
  };

  // ── Medical: the encounter store, the AR queue and the claim timelines ──
  const medicalRows = useMemo<QueueRow[]>(
    () =>
      buildMedicalQueueRows({
        encounters: Object.values(allEncounters),
        arWorkItems,
        nameForPatient,
        roleLabel: getRoleLabel,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allEncounters, arWorkItems, getPatientById, getRoleLabel],
  );

  // ── Dental: the dental track record, its claim and its denied lines ──
  const dentalRows = useMemo<QueueRow[]>(() => buildDentalQueueRows(dental), [dental]);

  const total = [...medicalRows, ...dentalRows].reduce((sum, row) => sum + row.entries.length, 0);
  const expanded = openState ?? total > 0;

  return (
    <section
      aria-labelledby="home-work-queues-heading"
      className="shrink-0 border-b border-slate-200 bg-white px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ClipboardList className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <h2 id="home-work-queues-heading" className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
          Work queues
        </h2>
        <p className="text-[11px] text-slate-500">
          {total > 0 ? (
            <>
              <span className="font-semibold tabular-nums text-slate-700">{total}</span>{" "}
              {total === 1 ? "item" : "items"} waiting across medical and dental — counted from your saved records.
            </>
          ) : (
            <>
              No data yet — nothing waiting. Next: open a patient and sign a note, or start a dental case.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => setOpenState(!expanded)}
          aria-expanded={expanded}
          aria-controls="home-work-queues-body"
          className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
          {expanded ? "Hide queues" : "Show queues"}
        </button>
      </div>

      {expanded && (
        <div id="home-work-queues-body" className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <TrackPanel
            track="medical"
            title="Medical"
            icon={<Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />}
            tone="brand"
            rows={medicalRows}
            onOpenMedicalStage={onOpenMedicalStage}
          />
          <TrackPanel
            track="dental"
            title="Dental"
            icon={<Smile className="h-3.5 w-3.5" aria-hidden="true" />}
            tone="accent"
            rows={dentalRows}
            onOpenMedicalStage={onOpenMedicalStage}
          />
        </div>
      )}
    </section>
  );
}

const ROW_ICONS: Record<string, typeof Hourglass> = {
  "medical-awaiting": Hourglass,
  "dental-awaiting": Hourglass,
  "medical-ar": AlertTriangle,
  "dental-ar": AlertTriangle,
  "medical-ready": FileText,
  "dental-ready": FileText,
  "medical-mid": Wallet,
  "dental-mid": Wallet,
};

function TrackPanel({
  track,
  title,
  icon,
  tone,
  rows,
  onOpenMedicalStage,
}: {
  track: "medical" | "dental";
  title: string;
  icon: React.ReactNode;
  tone: "brand" | "accent";
  rows: QueueRow[];
  onOpenMedicalStage: (patientId: string | null, role: Role) => void;
}) {
  const count = rows.reduce((sum, row) => sum + row.entries.length, 0);
  return (
    <div className={`rounded-xl border ${tone === "brand" ? "border-brand-200" : "border-accent-200"} bg-white`}>
      <div
        className={`flex items-center gap-2 rounded-t-xl px-2.5 py-1.5 ${
          tone === "brand" ? "bg-brand-50 text-brand-800" : "bg-accent-50 text-accent-800"
        }`}
      >
        {icon}
        <h3 className="text-[11px] font-bold uppercase tracking-wide">{title}</h3>
        {count === 0 && <span className="text-[10px] font-medium opacity-80">No data yet — nothing waiting</span>}
      </div>
      <div className="space-y-1.5 p-2">
        {rows.map((row) => {
          const Icon = ROW_ICONS[row.id] ?? ClipboardList;
          return (
            <div key={row.id} className="rounded-lg border border-slate-200">
              <div className="flex items-start gap-2 px-2 py-1.5">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-slate-700">{row.title}</p>
                  <p className="text-[10px] leading-snug text-slate-500">{row.purpose}</p>
                </div>
                {row.entries.length > 0 ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                      tone === "brand" ? "bg-brand-100 text-brand-800" : "bg-accent-100 text-accent-800"
                    }`}
                  >
                    {row.entries.length}
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] font-medium text-slate-400">Nothing waiting</span>
                )}
              </div>

              {row.entries.length === 0 ? (
                <p className="border-t border-slate-100 px-2 py-1.5 text-[10px] leading-snug text-slate-500">
                  No data yet — next: {row.emptyNextStep}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {row.entries.map((entry) => (
                    <li key={entry.id} className="px-2 py-1">
                      <p className="truncate text-[11px] font-medium text-slate-700" title={entry.label}>
                        {entry.label}
                      </p>
                      <p className="text-[10px] leading-snug text-slate-500">{entry.detail}</p>
                      <EntryLink
                        track={track}
                        entry={entry}
                        tone={tone}
                        onOpenMedicalStage={onOpenMedicalStage}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The one control on a queue entry: open the stage that holds the work. */
function EntryLink({
  track,
  entry,
  tone,
  onOpenMedicalStage,
}: {
  track: "medical" | "dental";
  entry: QueueEntry;
  tone: "brand" | "accent";
  onOpenMedicalStage: (patientId: string | null, role: Role) => void;
}) {
  const className = `inline-flex min-h-10 items-center gap-1 rounded text-[10px] font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 ${
    tone === "brand" ? "text-brand-700 focus-visible:outline-brand-600" : "text-accent-700 focus-visible:outline-accent-600"
  }`;
  const label = (text: string) => (
    <>
      {text}
      <ChevronRight className="h-3 w-3" aria-hidden="true" />
    </>
  );

  if (entry.target.kind === "medical") {
    const { patientId, role } = entry.target;
    return (
      <button
        type="button"
        onClick={() => onOpenMedicalStage(patientId, role)}
        className={className}
        aria-label={`${track === "medical" ? "Open" : "Open"} ${entry.label} at the stage that holds this work`}
      >
        {label("Open this stage")}
      </button>
    );
  }
  if (entry.target.kind === "dental") {
    const { caseId, stage } = entry.target;
    return (
      <Link
        to="/cases/$track/$caseId/$stage"
        params={{ track: "dental", caseId, stage }}
        className={className}
        aria-label={`Open ${entry.label} at the ${stage} stage`}
      >
        {label("Open this stage")}
      </Link>
    );
  }
  return (
    <Link to="/cases" className={className} aria-label="Open the dental cases">
      {label("Open the dental track")}
    </Link>
  );
}
