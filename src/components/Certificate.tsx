/**
 * Certificate — Completion Certificate Generator
 *
 * When the pipeline completes (all stages done), shows a
 * "Generate Certificate" button. Opens a styled certificate
 * preview with student name, date, completed modules, and score.
 * Uses window.print() for printing.
 *
 * Inspiration: AAPC/CPC course completion certificates
 */

import { useState } from "react";
import { Award, Download, Printer, CheckCircle2, X, Star, FileDown } from "lucide-react";
import { exportCertificatePDF } from "../utils/pdfExport";

interface CertificateProps {
  studentName?: string;
  completedModules: string[];
  score?: number;
  date?: string;
}

const MODULE_ICONS: Record<string, string> = {
  "Scribe": "📋",
  "Coder": "🔍",
  "Biller": "💰",
  "Prior Auth": "📄",
  "AR Voice": "📞",
};

export function Certificate({ studentName, completedModules, score, date }: CertificateProps) {
  const [showCertificate, setShowCertificate] = useState(false);
  const displayName = studentName || "Student";
  const displayDate = date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const displayScore = score ?? 92;

  return (
    <>
      {/* Generate Certificate Button */}
      {!showCertificate && (
        <button
          onClick={() => setShowCertificate(true)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:from-amber-600 hover:to-amber-700 transition-all"
        >
          <Award className="h-5 w-5" />
          Generate Certificate
          <Star className="h-4 w-4 text-amber-200" />
        </button>
      )}

      {/* Certificate Modal */}
      {showCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative max-w-2xl w-full">
            {/* Close button */}
            <button
              onClick={() => setShowCertificate(false)}
              className="absolute -top-3 -right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-slate-700 shadow-md text-slate-500 hover:text-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Certificate */}
            <div className="rounded-2xl border-4 border-double border-amber-300 dark:border-amber-600 bg-gradient-to-br from-white via-amber-50/30 to-white dark:from-slate-800 dark:via-amber-900/10 dark:to-slate-800 p-8 shadow-2xl" id="certificate-content">
              {/* Gold border accent */}
              <div className="rounded-xl border-2 border-amber-200 dark:border-amber-700 p-6">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg">
                    <Award className="h-8 w-8 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    Certificate of Completion
                  </h1>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Healthcare Hustlers EHR Simulation
                  </p>
                </div>

                {/* Body */}
                <div className="text-center mb-6">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">This certifies that</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-200 border-b-2 border-dotted border-amber-300 dark:border-amber-600 inline-block px-6 pb-1">
                    {displayName}
                  </p>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    has successfully completed the complete RCM pipeline
                  </p>
                </div>

                {/* Modules */}
                <div className="mb-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 text-center">
                    Completed Modules
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {completedModules.length > 0 ? completedModules.map((mod) => (
                      <span key={mod} className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        {MODULE_ICONS[mod] || "✓"} {mod}
                      </span>
                    )) : (
                      <span className="text-[10px] text-slate-400">All 5 stages completed</span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="text-center mb-6">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-900/10 border border-amber-200 dark:border-amber-700 px-4 py-2">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">Score: {displayScore}%</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                  <div className="text-center">
                    <p className="font-semibold text-slate-500 dark:text-slate-400">Date</p>
                    <p>{displayDate}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-500 dark:text-slate-400">Certificate ID</p>
                    <p className="font-mono">HH-{Date.now().toString(36).toUpperCase()}</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-500 dark:text-slate-400">Duration</p>
                    <p>Self-Paced</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Print & Download buttons */}
            <div className="mt-3 flex justify-center gap-3">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-xs font-medium text-white hover:bg-slate-600 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Print Certificate
              </button>
              <button
                onClick={() => {
                  exportCertificatePDF({
                    studentName: displayName,
                    completedModules,
                    score: displayScore,
                    date: displayDate,
                  });
                }}
                className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <FileDown className="h-4 w-4" />
                Download Certificate as PDF
              </button>
              <button
                onClick={() => setShowCertificate(false)}
                className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}