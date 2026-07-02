/**
 * DailySchedule — eCW-style Full Calendar with Appointment Management
 *
 * Inspiration: eClinicalWorks (eCW) calendar module with month/week/day views,
 * appointment creation, clinical notes, and Scribe workflow integration.
 * ──────────────────────────────────────────────────────────────────────
 */

import { useState, useMemo } from "react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, User, Plus, FileEdit,
  X, Save, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────

export interface Appointment {
  id: string;
  patientName: string;
  date: string; // ISO date string (YYYY-MM-DD)
  time: string; // HH:MM
  type: string;
  duration: number; // minutes
  notes: string;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  isNewPatient?: boolean;
}

export type ViewMode = "month" | "week" | "day";

// ─── Placeholder Data ───────────────────────────────────────────────

export const PLACEHOLDER_APPOINTMENTS: Appointment[] = [
  { id: "apt-1", patientName: "Emily Chen", date: "2026-07-02", time: "08:00", type: "Follow-up", duration: 30, notes: "", status: "completed" },
  { id: "apt-2", patientName: "Robert Johnson", date: "2026-07-02", time: "09:00", type: "COPD Check", duration: 30, notes: "", status: "in-progress" },
  { id: "apt-3", patientName: "Maria Garcia", date: "2026-07-02", time: "09:30", type: "Prenatal 32wk", duration: 45, notes: "", status: "scheduled" },
  { id: "apt-4", patientName: "James Wilson", date: "2026-07-02", time: "10:15", type: "New Patient", duration: 60, notes: "", status: "scheduled" },
  { id: "apt-5", patientName: "Sarah Thompson", date: "2026-07-02", time: "11:00", type: "Medication Review", duration: 30, notes: "", status: "scheduled" },
  { id: "apt-6", patientName: "David Kim", date: "2026-07-02", time: "13:00", type: "Lab Results", duration: 30, notes: "", status: "scheduled" },
  { id: "apt-7", patientName: "Lisa Brown", date: "2026-07-02", time: "14:00", type: "Follow-up", duration: 30, notes: "", status: "scheduled" },
  { id: "apt-8", patientName: "Michael Davis", date: "2026-07-02", time: "15:30", type: "Annual Physical", duration: 60, notes: "", status: "scheduled" },
  { id: "apt-9", patientName: "Ahmed Khan", date: "2026-07-03", time: "09:00", type: "New Patient Intake", duration: 60, notes: "", status: "scheduled" },
  { id: "apt-10", patientName: "Fatima Ali", date: "2026-07-03", time: "10:30", type: "Follow-up", duration: 30, notes: "", status: "scheduled" },
  { id: "apt-11", patientName: "Priya Sharma", date: "2026-07-05", time: "14:00", type: "Lab Results", duration: 30, notes: "", status: "scheduled" },
  { id: "apt-12", patientName: "Carlos Rodriguez", date: "2026-07-07", time: "11:00", type: "Diabetes Check", duration: 45, notes: "", status: "scheduled" },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const d = new Date(dateStr);
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = Array.from({ length: 12 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`);

// ─── Component ──────────────────────────────────────────────────────

interface DailyScheduleProps {
  onSelectPatient?: (name: string) => void;
  appointments?: Appointment[];
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
}

export function DailySchedule({ onSelectPatient, appointments: externalAppointments, setAppointments: setExternalAppointments }: DailyScheduleProps) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(formatDateString(today.getFullYear(), today.getMonth(), today.getDate()));
  const [localAppointments, setLocalAppointments] = useState<Appointment[]>(PLACEHOLDER_APPOINTMENTS);
  const [searchTerm, setSearchTerm] = useState("");

  // Use lifted state if provided, otherwise use local
  const appointments = externalAppointments ?? localAppointments;
  const setAppointments = setExternalAppointments ?? setLocalAppointments;

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editAppointment, setEditAppointment] = useState<Appointment | null>(null);
  const [modalPatientName, setModalPatientName] = useState("");
  const [modalType, setModalType] = useState("Follow-up");
  const [modalTime, setModalTime] = useState("09:00");
  const [modalDuration, setModalDuration] = useState(30);
  const [modalNotes, setModalNotes] = useState("");
  const [modalDate, setModalDate] = useState(selectedDate);

  // Appointments for selected date
  const selectedAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDate]);

  // Appointments grouped by date for calendar dots
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, number> = {};
    appointments.forEach((a) => {
      map[a.date] = (map[a.date] || 0) + 1;
    });
    return map;
  }, [appointments]);

  // Navigate
  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
    else { setCurrentMonth((m) => m - 1); }
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
    else { setCurrentMonth((m) => m + 1); }
  };

  // Open new appointment modal
  const openNewAppointment = (dateStr?: string) => {
    setEditAppointment(null);
    setModalPatientName("");
    setModalType("Follow-up");
    setModalTime("09:00");
    setModalDuration(30);
    setModalNotes("");
    setModalDate(dateStr || selectedDate);
    setShowModal(true);
  };

  // Open edit modal
  const openEditAppointment = (apt: Appointment) => {
    setEditAppointment(apt);
    setModalPatientName(apt.patientName);
    setModalType(apt.type);
    setModalTime(apt.time);
    setModalDuration(apt.duration);
    setModalNotes(apt.notes);
    setModalDate(apt.date);
    setShowModal(true);
  };

  // Save appointment (create or update)
  const saveAppointment = () => {
    if (!modalPatientName.trim()) return;
    if (editAppointment) {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === editAppointment.id
            ? { ...a, patientName: modalPatientName, type: modalType, time: modalTime, duration: modalDuration, notes: modalNotes, date: modalDate }
            : a
        )
      );
    } else {
      const newApt: Appointment = {
        id: `apt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        patientName: modalPatientName,
        date: modalDate,
        time: modalTime,
        type: modalType,
        duration: modalDuration,
        notes: modalNotes,
        status: "scheduled",
        isNewPatient: !appointments.some((a) => a.patientName.toLowerCase() === modalPatientName.toLowerCase()),
      };
      setAppointments((prev) => [...prev, newApt]);
    }
    setShowModal(false);
  };

  // Start visit for a patient
  const startVisit = (name: string) => {
    if (onSelectPatient) {
      onSelectPatient(name);
    }
  };

  // Calendar days
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [firstDay, daysInMonth]);

  // Filtered appointments for search
  const filteredAppointments = useMemo(() => {
    if (!searchTerm) return selectedAppointments;
    return selectedAppointments.filter((a) =>
      a.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [selectedAppointments, searchTerm]);

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-800">eCW-Style Schedule</h2>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            {viewMode === "month" ? "Month" : viewMode === "week" ? "Week" : "Day"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openNewAppointment(selectedDate)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-blue-500 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Appointment
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Calendar Panel ── */}
        <div className="flex flex-col w-full lg:w-1/2 border-r border-slate-200 overflow-hidden">
          {/* Month navigation */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="rounded p-1 hover:bg-slate-200 transition-colors">
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <button onClick={nextMonth} className="rounded p-1 hover:bg-slate-200 transition-colors">
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
              <span className="ml-2 text-sm font-semibold text-slate-700">
                {MONTHS[currentMonth]} {currentYear}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              <button
                onClick={() => setViewMode("month")}
                className={`rounded px-2 py-1 font-medium ${viewMode === "month" ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`rounded px-2 py-1 font-medium ${viewMode === "week" ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode("day")}
                className={`rounded px-2 py-1 font-medium ${viewMode === "day" ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"}`}
              >
                Day
              </button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="flex-1 overflow-y-auto p-2">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-1">
                  {d}
                </div>
              ))}
            </div>

            {/* Month grid */}
            {viewMode === "month" && (
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[80px]" />;
                  const dateStr = formatDateString(currentYear, currentMonth, day);
                  const isSelected = dateStr === selectedDate;
                  const isTodayDate = isToday(dateStr);
                  const count = appointmentsByDate[dateStr] || 0;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`relative min-h-[60px] sm:min-h-[80px] rounded-lg border p-1 cursor-pointer transition-colors ${
                        isSelected
                          ? "border-blue-400 bg-blue-50"
                          : isTodayDate
                            ? "border-blue-300 bg-blue-50/30"
                            : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-medium ${isTodayDate ? "text-blue-600" : "text-slate-600"}`}>
                          {day}
                        </span>
                        {isTodayDate && (
                          <span className="rounded-full bg-blue-500 h-1.5 w-1.5" />
                        )}
                      </div>
                      {count > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {Array.from({ length: Math.min(count, 3) }).map((_, j) => (
                            <div key={j} className="h-1 w-1 rounded-full bg-blue-400" />
                          ))}
                          {count > 3 && (
                            <span className="text-[8px] text-blue-500">+{count - 3}</span>
                          )}
                        </div>
                      )}
                      {/* Quick add button on hover */}
                      <button
                        onClick={(e) => { e.stopPropagation(); openNewAppointment(dateStr); }}
                        className="absolute bottom-1 right-1 hidden group-hover:flex hover:flex items-center justify-center h-4 w-4 rounded-full bg-blue-100 text-blue-600"
                        title="Add appointment"
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Week view — show selected date's week */}
            {viewMode === "week" && (
              <div className="space-y-1">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - d.getDay() + i);
                  const dateStr = formatDateString(d.getFullYear(), d.getMonth(), d.getDate());
                  const dayApps = appointments.filter((a) => a.date === dateStr);
                  const isSelected = dateStr === selectedDate;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`rounded-lg border p-2 cursor-pointer transition-colors ${
                        isSelected ? "border-blue-400 bg-blue-50" : "border-slate-100 hover:border-blue-200"
                      }`}
                    >
                      <p className="text-[10px] font-medium text-slate-500">
                        {DAYS[i]} — {d.toLocaleDateString()}
                        {isToday(dateStr) && <span className="ml-1 text-blue-600">(Today)</span>}
                      </p>
                      {dayApps.length === 0 ? (
                        <p className="text-[10px] text-slate-400 italic">No appointments</p>
                      ) : (
                        dayApps.slice(0, 3).map((a) => (
                          <p key={a.id} className="text-[10px] text-slate-600 truncate">
                            {a.time} — {a.patientName} ({a.type})
                          </p>
                        ))
                      )}
                      {dayApps.length > 3 && (
                        <p className="text-[9px] text-blue-500">+{dayApps.length - 3} more</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Day view — show time slots */}
            {viewMode === "day" && (
              <div className="space-y-0.5">
                {TIME_SLOTS.map((slot) => {
                  const slotApps = appointments.filter(
                    (a) => a.date === selectedDate && a.time === slot
                  );
                  return (
                    <div
                      key={slot}
                      className="flex items-start gap-2 rounded-lg border border-slate-100 p-1.5 min-h-[32px]"
                    >
                      <span className="text-[9px] font-medium text-slate-400 w-10 shrink-0 pt-0.5">{slot}</span>
                      <div className="flex-1 flex flex-wrap gap-1">
                        {slotApps.length === 0 ? (
                          <button
                            onClick={() => openNewAppointment(selectedDate)}
                            className="text-[9px] text-slate-300 hover:text-blue-400 italic"
                          >
                            + Click to add
                          </button>
                        ) : (
                          slotApps.map((a) => (
                            <div
                              key={a.id}
                              onClick={() => openEditAppointment(a)}
                              className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] cursor-pointer hover:bg-blue-100"
                            >
                              <span className="font-medium text-slate-700">{a.patientName}</span>
                              <span className="text-slate-500 ml-1">({a.type})</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Selected Day Appointment List ── */}
        <div className="flex flex-col w-full lg:w-1/2 overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">
                Appointments for {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                {selectedAppointments.length} visit{selectedAppointments.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-1.5 relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search appointments..."
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[10px] outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarDays className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-400">No appointments for this date</p>
                <button
                  onClick={() => openNewAppointment(selectedDate)}
                  className="mt-2 flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-100"
                >
                  <Plus className="h-3 w-3" /> Create Appointment
                </button>
              </div>
            ) : (
              filteredAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className={`rounded-lg border p-2.5 transition-all hover:shadow-sm ${
                    apt.status === "completed"
                      ? "border-green-200 bg-green-50/30"
                      : apt.status === "in-progress"
                        ? "border-blue-300 bg-blue-50"
                        : apt.status === "cancelled"
                          ? "border-red-200 bg-red-50/30"
                          : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100">
                        <User className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-800">{apt.patientName}</p>
                        <p className="text-[10px] text-slate-400">
                          {apt.time} · {apt.type} · {apt.duration}min
                        </p>
                      </div>
                    </div>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${
                      apt.status === "completed" ? "bg-green-100 text-green-700" :
                      apt.status === "in-progress" ? "bg-blue-100 text-blue-700" :
                      apt.status === "cancelled" ? "bg-red-100 text-red-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>
                      {apt.status === "completed" ? "Complete" : apt.status === "in-progress" ? "In Progress" : apt.status === "cancelled" ? "Cancelled" : "Scheduled"}
                    </span>
                  </div>
                  {apt.notes && (
                    <p className="mt-1.5 text-[10px] text-slate-500 italic bg-slate-50 rounded px-2 py-1">
                      {apt.notes}
                    </p>
                  )}
                  <div className="mt-2 flex gap-1.5">
                    <button
                      onClick={() => startVisit(apt.patientName)}
                      className="rounded bg-blue-600 px-2 py-0.5 text-[9px] font-medium text-white hover:bg-blue-500 transition-colors"
                    >
                      Start Visit
                    </button>
                    <button
                      onClick={() => openEditAppointment(apt)}
                      className="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      <FileEdit className="inline h-2.5 w-2.5 mr-0.5" />
                      Edit Notes
                    </button>
                    {apt.status === "scheduled" && (
                      <button
                        onClick={() => setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "in-progress" as const } : a))}
                        className="rounded bg-green-50 px-2 py-0.5 text-[9px] font-medium text-green-700 hover:bg-green-100 transition-colors"
                      >
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Appointment Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-800">
                {editAppointment ? "Edit Appointment" : "New Appointment"}
              </h3>
              <button onClick={() => setShowModal(false)} className="rounded p-1 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">Patient Name</label>
                <input
                  type="text"
                  value={modalPatientName}
                  onChange={(e) => setModalPatientName(e.target.value)}
                  placeholder="Enter patient name..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400"
                  autoFocus
                />
                {!appointments.some((a) => a.patientName.toLowerCase() === modalPatientName.toLowerCase()) && modalPatientName.trim().length > 0 && (
                  <p className="mt-0.5 text-[9px] text-amber-600">
                    <AlertTriangle className="inline h-2.5 w-2.5" /> New patient (not in existing database)
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Date</label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Time</label>
                  <input
                    type="time"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Visit Type</label>
                  <select
                    value={modalType}
                    onChange={(e) => setModalType(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400"
                  >
                    {["Follow-up", "New Patient", "Annual Physical", "Medication Review", "Lab Results", "Prenatal Visit", "Acute Visit", "COPD Check", "Diabetes Check", "Consultation"].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Duration (min)</label>
                  <select
                    value={modalDuration}
                    onChange={(e) => setModalDuration(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-400"
                  >
                    {[15, 30, 45, 60, 90, 120].map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">Clinical Notes</label>
                <textarea
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder="Add clinical notes for this appointment..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveAppointment}
                disabled={!modalPatientName.trim()}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-medium text-white hover:bg-blue-500 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Save className="h-3 w-3" />
                {editAppointment ? "Update Appointment" : "Create Appointment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}