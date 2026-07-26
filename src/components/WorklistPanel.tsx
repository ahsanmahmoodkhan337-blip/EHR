/**
 * WorklistPanel — Left Panel "Digital Mailbox"
 *
 * Scrollable list of pending patient files showing mini
 * avatar, patient name, idle status, priority pulse indicator.
 * Demo/Tutorial patient is always pinned at the top.
 */

import { Clock, Circle, Pin } from "lucide-react";
import type { Patient } from "../store/patientStore";

interface WorklistPanelProps {
  patients: Patient[];
  selectedPatientId: string;
  onPatientSelect: (id: string) => void;
}

const IDLE_DAYS = [2, 3, 1, 4, 5, 2, 3, 0, 1, 2, 4, 3, 7, 2, 1];

function getInitials(p: Patient): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}

function getIdleDays(index: number): number {
  return IDLE_DAYS[index % IDLE_DAYS.length];
}

function getPriorityColor(days: number): string {
  if (days >= 5) return "text-rose-500";
  if (days >= 3) return "text-amber-500";
  return "text-emerald-500";
}

export function WorklistPanel({ patients, selectedPatientId, onPatientSelect }: WorklistPanelProps) {
  const demoPatient = patients.find(p => p.id === "DEMO");
  const regularPatients = patients.filter(p => p.id !== "DEMO");

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 flex items-center gap-2 border-b border-slate-100 pb-2">
        <Clock className="h-4 w-4 text-slate-500" />
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inbox</span>
        <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
          {patients.length}
        </span>
      </div>
      <div className="max-h-[calc(100vh-12rem)] space-y-1 overflow-y-auto">
        {/* Demo/Tutorial patient pinned at top */}
        {demoPatient && (
          <div
            key="DEMO"
            onClick={() => onPatientSelect(demoPatient.id)}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2.5 transition-all duration-200 ${
              selectedPatientId === "DEMO"
                ? "border-amber-400 bg-amber-50 shadow-md"
                : "border-amber-300/60 bg-amber-50/40 hover:border-amber-400 hover:shadow-sm"
            }`}
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              selectedPatientId === "DEMO" ? "bg-amber-500 text-white" : "bg-amber-200 text-amber-700"
            }`}>
              📋
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className={`truncate text-sm font-medium ${
                  selectedPatientId === "DEMO" ? "text-amber-800" : "text-slate-800"
                }`}>
                  {demoPatient.firstName} {demoPatient.lastName}
                </p>
              </div>
              <p className="truncate text-[10px] text-slate-400">{demoPatient.chiefComplaint}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <Pin className="h-3 w-3 text-amber-500" />
              <span className="whitespace-nowrap text-[9px] font-medium text-amber-600">Pinned</span>
            </div>
          </div>
        )}

        {/* Separator */}
        {demoPatient && regularPatients.length > 0 && (
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Patients</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        )}

        {/* Regular patients */}
        {regularPatients.map((p, i) => {
          const idleDays = getIdleDays(i);
          const isSelected = p.id === selectedPatientId;
          return (
            <div
              key={p.id}
              onClick={() => onPatientSelect(p.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-all duration-200 ${
                isSelected
                  ? "border-indigo-200 bg-indigo-50 shadow-sm"
                  : "border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm"
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isSelected ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
              }`}>
                {getInitials(p)}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${
                  isSelected ? "text-indigo-800" : "text-slate-800"
                }`}>
                  {p.firstName} {p.lastName}
                </p>
                <p className="truncate text-[10px] text-slate-400">{p.chiefComplaint}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <Circle className={`h-2 w-2 fill-current ${getPriorityColor(idleDays)}`} />
                <span className="whitespace-nowrap text-[9px] text-slate-400">{idleDays}d idle</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
