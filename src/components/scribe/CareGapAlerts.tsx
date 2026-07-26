/**
 * CareGapAlerts — CDS Care Gap Alert System
 *
 * Banner showing overdue preventive screenings for active patient.
 * Color-coded: red (overdue >12 mo), amber (<12 mo), green (up to date).
 * "Order Now" quick-action + "Dismiss" with 7-day auto-reminder.
 */

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, X, ChevronDown, ChevronUp, Syringe } from "lucide-react";

// ─── Gap Data ────────────────────────────────────────────────────────

interface CareGap {
  id: string;
  name: string;
  description: string;
  overdueDays: number; // positive = overdue
  recommendation: string;
  cpt?: string;
}

const MOCK_GAPS: CareGap[] = [
  { id: "mammogram", name: "Mammogram", description: "Breast cancer screening", overdueDays: 540, recommendation: "Order screening mammogram (CPT 77067)", cpt: "77067" },
  { id: "hba1c", name: "HbA1c", description: "Diabetes monitoring", overdueDays: 90, recommendation: "Order HbA1c lab (CPT 83036)", cpt: "83036" },
  { id: "colonoscopy", name: "Colorectal Screening", description: "Colon cancer screening", overdueDays: 180, recommendation: "Refer for colonoscopy (CPT 45378)", cpt: "45378" },
  { id: "flu", name: "Flu Vaccine", description: "Seasonal influenza immunization", overdueDays: -60, recommendation: "Administer flu vaccine (CPT 90686)", cpt: "90686" },
  { id: "pneumococcal", name: "Pneumococcal Vaccine", description: "Pneumonia prevention", overdueDays: 400, recommendation: "Administer PPSV23 (CPT 90732)", cpt: "90732" },
  { id: "bone-density", name: "Bone Density", description: "Osteoporosis screening", overdueDays: 730, recommendation: "Order DEXA scan (CPT 77080)", cpt: "77080" },
];

// ─── Component ───────────────────────────────────────────────────────

export function CareGapAlerts() {
  const [gaps, setGaps] = useState(MOCK_GAPS);
  const [showPanel, setShowPanel] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const dismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
    setTimeout(() => {
      setDismissed(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 60000); // 7-day reminder (demo: 60 seconds)
  };

  const activeGaps = gaps.filter(g => !dismissed.has(g.id) && g.overdueDays > 0);
  const activeCount = activeGaps.length;

  const statusColor = (days: number) => {
    if (days <= 0) return "border-green-200 bg-green-50";
    if (days <= 365) return "border-amber-200 bg-amber-50";
    return "border-red-200 bg-red-50";
  };

  const textColor = (days: number) => {
    if (days <= 0) return "text-green-700";
    if (days <= 365) return "text-amber-700";
    return "text-red-700";
  };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-medium text-rose-600 hover:bg-rose-100">
        <AlertTriangle className="h-3.5 w-3.5" /> Care Gaps ({activeCount})
        {showPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">Care Gap Alerts</h3><p className="text-[9px] text-slate-400">Preventive screenings due</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {gaps.filter(g => !dismissed.has(g.id)).map(gap => {
                const overdue = gap.overdueDays > 0;
                const daysText = !overdue ? "Upcoming" : gap.overdueDays > 365 ? `${Math.floor(gap.overdueDays / 30)} months overdue` : `${gap.overdueDays} days overdue`;
                return (
                  <div key={gap.id} className={`rounded-lg border p-3 ${statusColor(gap.overdueDays)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-2">
                        {gap.overdueDays > 365 ? <AlertTriangle className="mt-0.5 h-4 w-4 text-red-500" /> : <Clock className="mt-0.5 h-4 w-4" />}
                        <div>
                          <p className="text-[10px] font-semibold text-slate-700">{gap.name}</p>
                          <p className="text-[9px] text-slate-500">{gap.description}</p>
                          <p className={`mt-0.5 text-[9px] font-medium ${textColor(gap.overdueDays)}`}>{daysText}</p>
                        </div>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[9px] text-slate-600"><span className="font-medium">Recommend:</span> {gap.recommendation}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-[9px] font-medium text-white hover:bg-blue-500">
                        <Syringe className="h-3 w-3" /> Order Now
                      </button>
                      <button onClick={() => dismiss(gap.id)} className="rounded border border-slate-200 px-2 py-1 text-[9px] text-slate-500 hover:bg-slate-50">
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {activeCount === 0 && (
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-400 mb-2" />
                <p className="text-sm font-medium text-slate-500">All screenings up to date!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
