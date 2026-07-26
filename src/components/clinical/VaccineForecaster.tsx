/**
 * VaccineForecaster — CDC Pediatric Vaccine Schedule
 *
 * Input birthdate, generates CDC-recommended vaccine schedule
 * with due dates, status, and color coding.
 */

import { useState, useMemo } from "react";
import { Syringe, Baby, Calendar, Printer, AlertTriangle, CheckCircle2, X } from "lucide-react";

// ─── CDC Schedule ───────────────────────────────────────────────────

interface Vaccine {
  name: string;
  doseNumber: number;
  ageMonths: number; // due at this age in months
  description: string;
}

const VACCINES: Vaccine[] = [
  { name: "HepB", doseNumber: 1, ageMonths: 0, description: "Hepatitis B — Birth dose" },
  { name: "HepB", doseNumber: 2, ageMonths: 2, description: "Hepatitis B" },
  { name: "DTaP", doseNumber: 1, ageMonths: 2, description: "Diphtheria, Tetanus, Pertussis" },
  { name: "Hib", doseNumber: 1, ageMonths: 2, description: "Haemophilus influenzae type B" },
  { name: "IPV", doseNumber: 1, ageMonths: 2, description: "Inactivated Poliovirus" },
  { name: "PCV13", doseNumber: 1, ageMonths: 2, description: "Pneumococcal Conjugate" },
  { name: "Rotavirus", doseNumber: 1, ageMonths: 2, description: "Rotavirus (oral)" },
  { name: "DTaP", doseNumber: 2, ageMonths: 4, description: "Diphtheria, Tetanus, Pertussis" },
  { name: "Hib", doseNumber: 2, ageMonths: 4, description: "Haemophilus influenzae type B" },
  { name: "IPV", doseNumber: 2, ageMonths: 4, description: "Inactivated Poliovirus" },
  { name: "PCV13", doseNumber: 2, ageMonths: 4, description: "Pneumococcal Conjugate" },
  { name: "Rotavirus", doseNumber: 2, ageMonths: 4, description: "Rotavirus (oral)" },
  { name: "DTaP", doseNumber: 3, ageMonths: 6, description: "Diphtheria, Tetanus, Pertussis" },
  { name: "Hib", doseNumber: 3, ageMonths: 6, description: "Haemophilus influenzae type B" },
  { name: "IPV", doseNumber: 3, ageMonths: 6, description: "Inactivated Poliovirus" },
  { name: "PCV13", doseNumber: 3, ageMonths: 6, description: "Pneumococcal Conjugate" },
  { name: "Rotavirus", doseNumber: 3, ageMonths: 6, description: "Rotavirus (oral)" },
  { name: "HepB", doseNumber: 3, ageMonths: 6, description: "Hepatitis B" },
  { name: "Influenza", doseNumber: 1, ageMonths: 6, description: "Inactivated Influenza (annual)" },
  { name: "MMR", doseNumber: 1, ageMonths: 12, description: "Measles, Mumps, Rubella" },
  { name: "Varicella", doseNumber: 1, ageMonths: 12, description: "Chickenpox" },
  { name: "HepA", doseNumber: 1, ageMonths: 12, description: "Hepatitis A" },
  { name: "HepA", doseNumber: 2, ageMonths: 18, description: "Hepatitis A (6mo after dose 1)" },
  { name: "DTaP", doseNumber: 4, ageMonths: 18, description: "Diphtheria, Tetanus, Pertussis" },
  { name: "MMR", doseNumber: 2, ageMonths: 48, description: "Measles, Mumps, Rubella" },
  { name: "Varicella", doseNumber: 2, ageMonths: 48, description: "Chickenpox" },
  { name: "IPV", doseNumber: 4, ageMonths: 48, description: "Inactivated Poliovirus booster" },
  { name: "DTaP", doseNumber: 5, ageMonths: 48, description: "Diphtheria, Tetanus, Pertussis (kindergarten)" },
  { name: "Tdap", doseNumber: 1, ageMonths: 132, description: "Tetanus, Diphtheria, Pertussis booster (age 11)" },
  { name: "HPV", doseNumber: 1, ageMonths: 132, description: "Human Papillomavirus (age 11, 2-dose)" },
  { name: "MenACWY", doseNumber: 1, ageMonths: 132, description: "Meningococcal ACWY (age 11)" },
  { name: "MenACWY", doseNumber: 2, ageMonths: 192, description: "Meningococcal ACWY booster (age 16)" },
  { name: "COVID-19", doseNumber: 1, ageMonths: 6, description: "COVID-19 vaccine" },
];

// ─── Component ──────────────────────────────────────────────────────

interface VaccineStatus {
  name: string;
  doseNumber: number;
  dueDate: string;
  monthsAge: number;
  status: "overdue" | "due-soon" | "upcoming" | "complete";
  description: string;
}

export function VaccineForecaster() {
  const [birthdate, setBirthdate] = useState("");
  const [showPanel, setShowPanel] = useState(false);

  const schedule = useMemo((): VaccineStatus[] => {
    if (!birthdate) return [];
    const birth = new Date(birthdate);
    const now = new Date();
    const ageMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());

    return VACCINES.map((v) => {
      const dueDate = new Date(birth);
      dueDate.setMonth(dueDate.getMonth() + v.ageMonths);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      let status: VaccineStatus["status"];
      if (ageMonths >= v.ageMonths) {
        status = daysUntilDue < 0 ? "overdue" : "complete";
      } else if (daysUntilDue <= 30) {
        status = "due-soon";
      } else {
        status = "upcoming";
      }
      return {
        name: v.name,
        doseNumber: v.doseNumber,
        dueDate: dueDate.toLocaleDateString(),
        monthsAge: v.ageMonths,
        status,
        description: v.description,
      };
    });
  }, [birthdate]);

  const overdue = schedule.filter((s) => s.status === "overdue");
  const dueSoon = schedule.filter((s) => s.status === "due-soon");

  const statusColor = (s: string) => {
    switch (s) {
      case "overdue": return "border-red-200 bg-red-50";
      case "due-soon": return "border-amber-200 bg-amber-50";
      case "upcoming": return "border-blue-200 bg-blue-50";
      default: return "border-green-200 bg-green-50";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[10px] font-medium text-cyan-600 hover:bg-cyan-100 transition-colors"
      >
        <Syringe className="h-3.5 w-3.5" />
        Vaccine Forecaster
      </button>

      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800">CDC Vaccine Forecaster</h3>
                <p className="text-[9px] text-slate-400">Pediatric schedule per CDC/ACIP guidelines</p>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            {/* Birthdate input */}
            <div className="mb-4">
              <label className="mb-1 block text-[10px] font-medium text-slate-500">Patient Birthdate</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none focus:border-cyan-400"
                />
                <button className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] text-slate-500 hover:bg-slate-50">
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {birthdate && (
              <>
                <div className="flex gap-2 mb-3 text-[9px]">
                  <span className="text-red-600">🚫 {overdue.length} Overdue</span>
                  <span className="text-amber-600">⚠ {dueSoon.length} Due Soon</span>
                </div>

                <div className="space-y-1">
                  {schedule
                    .filter((s) => s.status === "overdue" || s.status === "due-soon" || s.monthsAge <= 24)
                    .map((v, i) => (
                      <div key={`${v.name}-${v.doseNumber}-${i}`} className={`rounded-lg border p-2.5 ${statusColor(v.status)}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            {v.status === "overdue" ? (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                            ) : v.status === "complete" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            )}
                            <div>
                              <p className="text-[10px] font-semibold text-slate-700">
                                {v.name} — Dose {v.doseNumber}
                              </p>
                              <p className="text-[8px] text-slate-500">{v.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${
                              v.status === "overdue" ? "bg-red-500 text-white" :
                              v.status === "due-soon" ? "bg-amber-500 text-white" :
                              v.status === "upcoming" ? "bg-blue-100 text-blue-700" :
                              "bg-green-500 text-white"
                            }`}>
                              {v.status === "overdue" ? "OVERDUE" : v.status === "due-soon" ? "DUE SOON" : v.status === "upcoming" ? "Upcoming" : "Complete"}
                            </span>
                            <p className="text-[8px] text-slate-400">{v.dueDate}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
