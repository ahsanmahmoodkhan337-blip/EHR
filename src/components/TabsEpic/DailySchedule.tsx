/**
 * DailySchedule — eCW-style Full Calendar with Appointment Management
 *
 * Inspiration: eClinicalWorks (eCW) calendar module with month/week/day views,
 * appointment creation, clinical notes, and Scribe workflow integration.
 *
 * Redesigned to match the new landing/enrollment/login design language:
 * slate + blue medical palette, gradient header, framer-motion entrance
 * animations (respecting prefers-reduced-motion), rounded-2xl cards, lucide
 * icons, a day/week/month pill toggle, a colour-coded time-slot day view,
 * "today" highlight, and v2 realism tags (no-show status, provider initials,
 * NP / EST patient tags).
 * ──────────────────────────────────────────────────────────────────────
 */

import { useState, useMemo, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays, ChevronLeft, ChevronRight, User, Plus, FileEdit,
  X, Save, CheckCircle2, AlertTriangle, Clock, Search, Stethoscope, UserX,
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
  status: "scheduled" | "in-progress" | "completed" | "cancelled" | "no-show";
  /** Optional provider assigned to the visit (rendered as initials + name). */
  provider?: string;
  isNewPatient?: boolean;
}

export type ViewMode = "month" | "week" | "day";

// ─── Placeholder Data ───────────────────────────────────────────────

export const PLACEHOLDER_APPOINTMENTS: Appointment[] = [
  { id: "apt-1", patientName: "Emily Chen", date: "2026-07-02", time: "08:00", type: "Follow-up", duration: 30, notes: "", status: "completed", provider: "Dr. Sarah Lee" },
  { id: "apt-2", patientName: "Robert Johnson", date: "2026-07-02", time: "09:00", type: "COPD Check", duration: 30, notes: "", status: "in-progress", provider: "Dr. Michael Ross" },
  { id: "apt-3", patientName: "Maria Garcia", date: "2026-07-02", time: "09:30", type: "Prenatal 32wk", duration: 45, notes: "", status: "scheduled", provider: "Dr. Sarah Lee" },
  { id: "apt-4", patientName: "James Wilson", date: "2026-07-02", time: "10:15", type: "New Patient", duration: 60, notes: "", status: "scheduled", provider: "Dr. Sarah Lee", isNewPatient: true },
  { id: "apt-5", patientName: "Sarah Thompson", date: "2026-07-02", time: "11:00", type: "Medication Review", duration: 30, notes: "", status: "scheduled", provider: "Dr. Michael Ross" },
  { id: "apt-6", patientName: "David Kim", date: "2026-07-02", time: "13:00", type: "Lab Results", duration: 30, notes: "", status: "scheduled", provider: "Dr. Priya Nair" },
  { id: "apt-7", patientName: "Lisa Brown", date: "2026-07-02", time: "14:00", type: "Follow-up", duration: 30, notes: "", status: "scheduled", provider: "Dr. Priya Nair" },
  { id: "apt-8", patientName: "Michael Davis", date: "2026-07-02", time: "15:30", type: "Annual Physical", duration: 60, notes: "", status: "scheduled", provider: "Dr. Michael Ross" },
  { id: "apt-9", patientName: "Ahmed Khan", date: "2026-07-03", time: "09:00", type: "New Patient Intake", duration: 60, notes: "", status: "scheduled", provider: "Dr. Sarah Lee", isNewPatient: true },
  { id: "apt-10", patientName: "Fatima Ali", date: "2026-07-03", time: "10:30", type: "Follow-up", duration: 30, notes: "", status: "scheduled", provider: "Dr. Priya Nair" },
  { id: "apt-11", patientName: "Priya Sharma", date: "2026-07-05", time: "14:00", type: "Lab Results", duration: 30, notes: "", status: "no-show", provider: "Dr. Sarah Lee" },
  { id: "apt-12", patientName: "Carlos Rodriguez", date: "2026-07-07", time: "11:00", type: "Diabetes Check", duration: 45, notes: "", status: "scheduled", provider: "Dr. Michael Ross" },
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

/** Derive 1–2 uppercase initials from a free-text name. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = Array.from({ length: 12 }, (_, i) => `${String(i + 8).padStart(2, "0")}:00`);

// ─── Status & tag styling (keyed by the full status union) ───────────

const STATUS_META: Record<Appointment["status"], { label: string; badge: string; card: string; dot: string }> = {
  "scheduled":   { label: "Scheduled",   badge: "bg-blue-50 text-blue-700 ring-blue-200",         card: "border-blue-200 bg-blue-50/40",     dot: "bg-blue-500" },
  "in-progress": { label: "In Progress", badge: "bg-amber-50 text-amber-700 ring-amber-200",     card: "border-amber-200 bg-amber-50/40",   dot: "bg-amber-500" },
  "completed":   { label: "Completed",   badge: "bg-emerald-50 text-emerald-700 ring-emerald-200", card: "border-emerald-200 bg-emerald-50/40", dot: "bg-emerald-500" },
  "cancelled":   { label: "Cancelled",   badge: "bg-rose-50 text-rose-700 ring-rose-200",        card: "border-rose-200 bg-rose-50/40",     dot: "bg-rose-500" },
  "no-show":     { label: "No-Show",     badge: "bg-orange-50 text-orange-700 ring-orange-200",  card: "border-orange-200 bg-orange-50/40", dot: "bg-orange-500" },
};

// ─── Component ──────────────────────────────────────────────────────

interface DailyScheduleProps {
  onSelectPatient?: (name: string) => void;
  appointments?: Appointment[];
  setAppointments?: React.Dispatch<React.SetStateAction<Appointment[]>>;
  onDateChange?: (date: string) => void;
}

export function DailySchedule({ onSelectPatient, appointments: externalAppointments, setAppointments: setExternalAppointments, onDateChange }: DailyScheduleProps) {
  const today = new Date();
  const reduceMotion = useReducedMotion();
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
  const [modalProvider, setModalProvider] = useState("");
  const [modalStatus, setModalStatus] = useState<Appointment["status"]>("scheduled");

  // Shared entrance preset — collapses to no-op under prefers-reduced-motion.
  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: reduceMotion ? 0 : 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.4, delay: reduceMotion ? 0 : delay },
  });

  // Appointments for selected date
  const selectedAppointments = useMemo(() => {
    return appointments
      .filter((a) => a.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDate]);

  // Notify parent when selected date changes
  useEffect(() => {
    onDateChange?.(selectedDate);
  }, [selectedDate]);

  // Appointments grouped by date (full lists for dots + counts)
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      (map[a.date] ||= []).push(a);
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
  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(formatDateString(now.getFullYear(), now.getMonth(), now.getDate()));
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
    setModalProvider("");
    setModalStatus("scheduled");
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
    setModalProvider(apt.provider ?? "");
    setModalStatus(apt.status);
    setShowModal(true);
  };

  // Save appointment (create or update)
  const saveAppointment = () => {
    if (!modalPatientName.trim()) return;
    if (editAppointment) {
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === editAppointment.id
            ? { ...a, patientName: modalPatientName, type: modalType, time: modalTime, duration: modalDuration, notes: modalNotes, date: modalDate, provider: modalProvider.trim() || undefined, status: modalStatus }
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
        status: modalStatus,
        provider: modalProvider.trim() || undefined,
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
      a.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.provider ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [selectedAppointments, searchTerm]);

  const viewLabel = viewMode === "month" ? "Month" : viewMode === "week" ? "Week" : "Day";

  return (
    <motion.div className="flex flex-1 flex-col h-full overflow-hidden bg-slate-50" {...fadeUp(0)}>
      {/* ── Gradient header ── */}
      <motion.header
        className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-700 via-blue-600 to-sky-600 px-5 py-4 text-white shadow-md"
        {...fadeUp(0)}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">Daily Schedule</h2>
            <p className="text-[11px] text-blue-100">
              {MONTHS[currentMonth]} {currentYear} · {viewLabel} view
            </p>
          </div>
        </div>
        <button
          onClick={() => openNewAppointment(selectedDate)}
          className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
        >
          <Plus className="h-3.5 w-3.5" />
          New Appointment
        </button>
      </motion.header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Calendar Panel ── */}
        <motion.div className="flex w-full flex-col border-r border-slate-200 bg-white lg:w-1/2" {...fadeUp(0.05)}>
          {/* Toolbar: navigation + view toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-1">
              <button
                onClick={goToToday}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Today
              </button>
              <button onClick={prevMonth} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={nextMonth} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100">
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="ml-1 text-sm font-semibold text-slate-700">
                {MONTHS[currentMonth]} {currentYear}
              </span>
            </div>

            {/* Segmented view toggle */}
            <div className="flex items-center rounded-xl bg-slate-100 p-0.5">
              {(["month", "week", "day"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-[10px] px-3 py-1 text-[11px] font-semibold capitalize transition-all ${
                    viewMode === mode
                      ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar body */}
          <div className="flex-1 overflow-y-auto p-3">
            {/* Weekday header row */}
            <div className="mb-1 grid grid-cols-7">
              {DAYS.map((d) => (
                <div key={d} className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {d}
                </div>
              ))}
            </div>

            {/* Month grid */}
            {viewMode === "month" && (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} className="min-h-[56px] sm:min-h-[76px]" />;
                  const dateStr = formatDateString(currentYear, currentMonth, day);
                  const isSelected = dateStr === selectedDate;
                  const isTodayDate = isToday(dateStr);
                  const dayApps = appointmentsByDate[dateStr] ?? [];

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`group relative min-h-[56px] cursor-pointer rounded-xl border p-1.5 transition-colors sm:min-h-[76px] ${
                        isSelected
                          ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                          : isTodayDate
                            ? "border-blue-300 bg-blue-50/40"
                            : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        <span
                          className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium ${
                            isTodayDate ? "bg-blue-600 text-white" : isSelected ? "text-blue-700" : "text-slate-600"
                          }`}
                        >
                          {day}
                        </span>
                      </div>
                      {dayApps.length > 0 && (
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-0.5">
                          {dayApps.slice(0, 3).map((a) => (
                            <span key={a.id} className={`h-1.5 w-1.5 rounded-full ${STATUS_META[a.status].dot}`} />
                          ))}
                          {dayApps.length > 3 && (
                            <span className="text-[9px] font-medium text-slate-400">+{dayApps.length - 3}</span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openNewAppointment(dateStr); }}
                        className="absolute bottom-1 right-1 hidden h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-colors hover:bg-blue-200 group-hover:flex"
                        title="Add appointment"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Week view — show selected date's week */}
            {viewMode === "week" && (
              <div className="space-y-1.5">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(selectedDate);
                  d.setDate(d.getDate() - d.getDay() + i);
                  const dateStr = formatDateString(d.getFullYear(), d.getMonth(), d.getDate());
                  const dayApps = appointments.filter((a) => a.date === dateStr);
                  const isSelected = dateStr === selectedDate;
                  const isTodayDate = isToday(dateStr);

                  return (
                    <div
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`cursor-pointer rounded-xl border p-2.5 transition-colors ${
                        isSelected ? "border-blue-400 bg-blue-50" : "border-slate-100 hover:border-blue-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                          isTodayDate ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                          {d.getDate()}
                        </span>
                        <p className="text-[11px] font-medium text-slate-600">
                          {DAYS[i]}
                          {isTodayDate && <span className="ml-1 font-semibold text-blue-600">(Today)</span>}
                        </p>
                      </div>
                      {dayApps.length === 0 ? (
                        <p className="mt-1.5 pl-7 text-[10px] italic text-slate-400">No appointments</p>
                      ) : (
                        <div className="mt-1.5 space-y-1 pl-7">
                          {dayApps.slice(0, 3).map((a) => (
                            <div key={a.id} className="flex items-center gap-1.5 truncate text-[10px] text-slate-600">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_META[a.status].dot}`} />
                              <span className="tabular-nums text-slate-400">{a.time}</span>
                              <span className="truncate">{a.patientName} · {a.type}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {dayApps.length > 3 && (
                        <p className="mt-1 pl-7 text-[9px] font-medium text-blue-500">+{dayApps.length - 3} more</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Day view — colour-coded time slots */}
            {viewMode === "day" && (
              <div className="space-y-1">
                {TIME_SLOTS.map((slot) => {
                  const slotApps = appointments.filter(
                    (a) => a.date === selectedDate && a.time === slot
                  );
                  return (
                    <div
                      key={slot}
                      className="flex items-start gap-2 rounded-xl border border-slate-100 p-1.5 min-h-[36px]"
                    >
                      <span className="flex w-12 shrink-0 items-center gap-1 pt-0.5 text-[10px] font-medium text-slate-400">
                        <Clock className="h-3 w-3" />
                        {slot}
                      </span>
                      <div className="flex flex-1 flex-wrap gap-1">
                        {slotApps.length === 0 ? (
                          <button
                            onClick={() => openNewAppointment(selectedDate)}
                            className="text-[9px] italic text-slate-300 transition-colors hover:text-blue-400"
                          >
                            + Click to add
                          </button>
                        ) : (
                          slotApps.map((a) => (
                            <div
                              key={a.id}
                              onClick={() => openEditAppointment(a)}
                              className={`cursor-pointer rounded-lg border px-2 py-1 text-[10px] transition-colors ${STATUS_META[a.status].card}`}
                            >
                              <span className="font-semibold text-slate-700">{a.patientName}</span>
                              <span className="ml-1 text-slate-500">({a.type})</span>
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
        </motion.div>

        {/* ── Selected Day Appointment List ── */}
        <motion.div className="flex w-full flex-col bg-slate-50 lg:w-1/2" {...fadeUp(0.1)}>
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">
                {new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                {selectedAppointments.length} visit{selectedAppointments.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by patient, visit type, or provider..."
                className="w-full rounded-xl border border-slate-200 py-1.5 pl-8 pr-2 text-[11px] outline-none transition-colors focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {filteredAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-10 text-center">
                <CalendarDays className="mb-2 h-8 w-8 text-slate-300" />
                <p className="text-xs text-slate-400">No appointments for this date</p>
                <button
                  onClick={() => openNewAppointment(selectedDate)}
                  className="mt-2 flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-100"
                >
                  <Plus className="h-3 w-3" /> Create Appointment
                </button>
              </div>
            ) : (
              filteredAppointments.map((apt, idx) => {
                const meta = STATUS_META[apt.status];
                const initials = getInitials(apt.provider || apt.patientName);
                return (
                  <motion.div
                    key={apt.id}
                    {...fadeUp(Math.min(idx, 6) * 0.04)}
                    className={`rounded-2xl border p-3 shadow-sm transition-shadow hover:shadow-md ${meta.card}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[11px] font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-800">{apt.patientName}</p>
                          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[9px] font-semibold ring-1 ${meta.badge}`}>
                            {meta.label}
                          </span>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="h-3 w-3" />
                          {apt.time} · {apt.type} · {apt.duration} min
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span
                            title={apt.isNewPatient ? "New patient" : "Established patient"}
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${apt.isNewPatient ? "bg-sky-100 text-sky-700" : "bg-slate-200 text-slate-600"}`}
                          >
                            {apt.isNewPatient ? "NP" : "EST"}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-slate-500 ring-1 ring-slate-200">
                            <Stethoscope className="h-2.5 w-2.5 text-indigo-500" />
                            {apt.provider ? apt.provider : "Unassigned"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {apt.notes && (
                      <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-[10px] italic text-slate-500">
                        {apt.notes}
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-200/60 pt-2">
                      <button
                        onClick={() => startVisit(apt.patientName)}
                        className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-medium text-white transition-colors hover:bg-blue-500"
                      >
                        <User className="h-3 w-3" /> Start Visit
                      </button>
                      <button
                        onClick={() => openEditAppointment(apt)}
                        className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600 ring-1 ring-slate-200 transition-colors hover:bg-slate-100"
                      >
                        <FileEdit className="h-3 w-3" /> Edit
                      </button>
                      {apt.status === "scheduled" && (
                        <button
                          onClick={() => setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "in-progress" as const } : a))}
                          className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-[10px] font-medium text-amber-700 transition-colors hover:bg-amber-100"
                        >
                          Check In
                        </button>
                      )}
                      {apt.status === "in-progress" && (
                        <button
                          onClick={() => setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "completed" as const } : a))}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[10px] font-medium text-white transition-colors hover:bg-emerald-400"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Complete
                        </button>
                      )}
                      {(apt.status === "scheduled" || apt.status === "in-progress") && (
                        <>
                          <button
                            onClick={() => setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "no-show" as const } : a))}
                            className="flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-[10px] font-medium text-orange-700 transition-colors hover:bg-orange-100"
                          >
                            <UserX className="h-3 w-3" /> No-Show
                          </button>
                          <button
                            onClick={() => setAppointments((prev) => prev.map((a) => a.id === apt.id ? { ...a, status: "cancelled" as const } : a))}
                            className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-[10px] font-medium text-rose-600 transition-colors hover:bg-rose-100"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Appointment Modal ── */}
      {showModal && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          initial={{ opacity: reduceMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
            initial={{ opacity: reduceMotion ? 1 : 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-gradient-to-r from-blue-700 to-sky-600 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">
                {editAppointment ? "Edit Appointment" : "New Appointment"}
              </h3>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/15 hover:text-white">
                <X className="h-4 w-4" />
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
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-blue-400"
                  autoFocus
                />
                {!appointments.some((a) => a.patientName.toLowerCase() === modalPatientName.toLowerCase()) && modalPatientName.trim().length > 0 && (
                  <p className="mt-1 text-[9px] text-amber-600">
                    <AlertTriangle className="mr-0.5 inline h-2.5 w-2.5" /> New patient (not in existing database)
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Time</label>
                  <input
                    type="time"
                    value={modalTime}
                    onChange={(e) => setModalTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-blue-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Visit Type</label>
                  <select
                    value={modalType}
                    onChange={(e) => setModalType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-blue-400"
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
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-blue-400"
                  >
                    {[15, 30, 45, 60, 90, 120].map((d) => (
                      <option key={d} value={d}>{d} min</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Provider</label>
                  <input
                    type="text"
                    value={modalProvider}
                    onChange={(e) => setModalProvider(e.target.value)}
                    placeholder="e.g. Dr. Sarah Lee"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium text-slate-500">Status</label>
                  <select
                    value={modalStatus}
                    onChange={(e) => setModalStatus(e.target.value as Appointment["status"])}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition-colors focus:border-blue-400"
                  >
                    {(["scheduled", "in-progress", "completed", "cancelled", "no-show"] as Appointment["status"][]).map((s) => (
                      <option key={s} value={s}>{STATUS_META[s].label}</option>
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
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-[10px] outline-none transition-colors focus:border-blue-400"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-[10px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveAppointment}
                disabled={!modalPatientName.trim()}
                className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Save className="h-3 w-3" />
                {editAppointment ? "Update Appointment" : "Create Appointment"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
