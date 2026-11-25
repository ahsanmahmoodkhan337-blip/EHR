/**
 * InBasket — the student's outstanding work
 *
 * Inspiration: Epic Hyperspace InBasket.
 * Epic's InBasket is the clinician's own list: every row is a real item that
 * needs an action — a result to sign, a message to answer, an order to cosign.
 *
 * Until build 5 this panel was 100% placeholder: six invented alerts (Robert
 * Johnson's "BNP: 850 pg/mL", a "2 min ago" that was a typed string), a count
 * derived from that fake list, no controls, and a "Full InBasket coming soon"
 * box — a SOON label on a student screen.
 *
 * Every row here comes from `domain/inbasket.ts`, which reads the app's own
 * records: the encounter store, the AR work queue behind posted 835s, the one
 * note record's status, the patient's coverage, the appointment's copay, the
 * prior-authorisation records and the dental track. The count in the header and
 * the tab badge are the same `inboxCount`. A practice with nothing waiting says
 * so and names the step that would fill it — never a zero dressed as a queue,
 * and never an invented patient.
 */

import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileEdit,
  FileText,
  Hourglass,
  Inbox,
  ShieldCheck,
  Smile,
  Wallet,
} from "lucide-react";

import { usePipeline, type Role } from "../../store/pipelineStore";
import { usePatientStore } from "../../store/patientStore";
import { useAllAppointments } from "../../store/ehrStore";
import { readDentalTrackRecord } from "../dental/DentalTrackStore";
import {
  buildInboxItems,
  inboxCount,
  inboxWhen,
  type InboxItem,
  type InboxKind,
  type InboxPriority,
} from "../../domain/inbasket";
import { useHomeWorkQueues } from "../status/HomeWorkQueues";

/**
 * The rows, derived on render from the student's saved records and nothing
 * else. The tab badge and the panel both call this, so they cannot disagree.
 */
export function useInboxItems(): InboxItem[] {
  const { allEncounters, arWorkItems, paRecords, getRoleLabel } = usePipeline();
  const { patients } = usePatientStore();
  const appointments = useAllAppointments();
  // Dental work happens on the dental track; the inbox reflects what that track
  // last saved.
  const dental = useMemo(() => readDentalTrackRecord(), []);

  return useMemo(
    () =>
      buildInboxItems({
        encounters: Object.values(allEncounters),
        arWorkItems,
        paRecords,
        appointments,
        patients,
        dental,
        roleLabel: getRoleLabel,
      }),
    [allEncounters, arWorkItems, paRecords, appointments, patients, dental, getRoleLabel],
  );
}

const KIND_ICON: Record<InboxKind, typeof Inbox> = {
  denial: AlertTriangle,
  balance: Wallet,
  "claim-awaiting": Hourglass,
  "claim-ready": FileText,
  "claim-hold": AlertTriangle,
  eligibility: ShieldCheck,
  copay: Wallet,
  "note-draft": FileEdit,
  "mid-stage": ClipboardList,
  "prior-auth": ClipboardCheck,
  dental: Smile,
};

/** The 19 November priority left-borders, kept exactly. */
const PRIORITY_TONE: Record<InboxPriority, string> = {
  high: "border-l-amber-500 bg-amber-50",
  medium: "border-l-blue-500 bg-brand-50",
  low: "border-l-slate-300 bg-white",
};

const PRIORITY_BADGE: Record<InboxPriority, string> = {
  high: "bg-amber-100 text-amber-700",
  medium: "bg-brand-100 text-brand-700",
  low: "bg-slate-100 text-slate-500",
};

export interface InBasketProps {
  /**
   * Open a patient at the role whose screen holds the work. Home's stages are
   * workspace views rather than URLs, so this is the same navigation the
   * patient list and the Work Queues use.
   */
  onOpenMedicalStage: (patientId: string | null, role: Role) => void;
}

export function InBasket({ onOpenMedicalStage }: InBasketProps) {
  const items = useInboxItems();
  const count = inboxCount(items);
  // The next step a student would take to fill an empty queue — the wording the
  // Work Queues already use, so an empty InBasket teaches the same thing.
  const { medicalRows, dentalRows } = useHomeWorkQueues();
  const medicalNext = medicalRows[0]?.emptyNextStep;
  const dentalNext = dentalRows[0]?.emptyNextStep;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Inbox className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-800">InBasket / Alert Center</h2>
          <p className="text-sm text-slate-500">
            {count > 0
              ? `${count} ${count === 1 ? "item" : "items"} waiting — counted from your saved records.`
              : "No data yet — nothing waiting."}
          </p>
        </div>
      </div>

      <div className="clinical-card flex-1">
        {count === 0 ? (
          <div className="px-1 py-2 text-sm text-slate-500">
            <p>Nothing is waiting on you. Next: {medicalNext}</p>
            {dentalNext && <p className="mt-1">Or: {dentalNext}</p>}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const Icon = KIND_ICON[item.kind] ?? Inbox;
              const when = inboxWhen(item);
              return (
                <li
                  key={item.id}
                  className={`flex items-start gap-3 rounded-lg border-l-4 p-3 ${PRIORITY_TONE[item.priority]}`}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{item.title}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${PRIORITY_BADGE[item.priority]}`}
                      >
                        {item.priority}
                      </span>
                      {when && <span className="text-[10px] text-slate-400">{when}</span>}
                    </div>
                    <p className="text-xs text-slate-500">
                      <span className="font-medium text-slate-600">{item.patient}</span>
                      {" — "}
                      {item.detail}
                    </p>
                    <OpenStage item={item} onOpenMedicalStage={onOpenMedicalStage} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The one control on a row: open the stage that holds the work. */
function OpenStage({
  item,
  onOpenMedicalStage,
}: {
  item: InboxItem;
  onOpenMedicalStage: (patientId: string | null, role: Role) => void;
}) {
  const className =
    "mt-1 inline-flex min-h-10 items-center gap-1 rounded text-xs font-semibold text-brand-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";
  const label = (
    <>
      Open this stage
      <ChevronRight className="h-3 w-3" aria-hidden="true" />
    </>
  );

  if (item.target.kind === "medical") {
    const { patientId, role } = item.target;
    return (
      <button
        type="button"
        onClick={() => onOpenMedicalStage(patientId, role)}
        aria-label={`Open ${item.patient} at the stage that holds this work`}
        className={className}
      >
        {label}
      </button>
    );
  }

  if (item.target.kind === "dental") {
    const { caseId, stage } = item.target;
    return (
      <Link
        to="/cases/$track/$caseId/$stage"
        params={{ track: "dental", caseId, stage }}
        aria-label={`Open ${item.patient} at the ${stage} stage`}
        className={className}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link to="/cases" aria-label="Open the dental cases" className={className}>
      {label}
    </Link>
  );
}
