/**
 * CopyForward — Copy Forward Previous Encounter
 *
 * Pulls last SOAP note into current fields with diff highlighting.
 */

import { useState } from "react";
import { Copy, CheckCircle2, Eye, X } from "lucide-react";

const PREV_ENCOUNTER = {
  subjective: "Patient reports intermittent headache over past 2 weeks. No associated nausea or visual changes.",
  objective: "BP 128/76, HR 72, Temp 98.6°F. Neuro exam grossly intact.",
  assessment: "Tension headache (G44.2). No red flag symptoms. HTN controlled on lisinopril.",
  plan: "Continue lisinopril 10mg. Advised stress management. Return in 3 months or sooner if headaches worsen.",
};

const CURRENT_DRAFT = {
  subjective: "",
  objective: "BP 130/78, HR 74.",
  assessment: "",
  plan: "Continue lisinopril. Follow up in 3 months.",
};

export function CopyForward() {
  const [showPanel, setShowPanel] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[10px] font-medium text-sky-600 hover:bg-sky-100"><Copy className="h-3.5 w-3.5" /> Copy Forward</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">Copy Forward</h3><p className="text-[9px] text-slate-400">Copy data from previous encounter</p></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>

            <div className="mb-3 rounded-lg bg-slate-50 p-3">
              <p className="text-[10px] font-semibold text-slate-600 mb-1">Previous Encounter (2026-06-15)</p>
              <p className="text-[9px] text-slate-500"><strong>S:</strong> {PREV_ENCOUNTER.subjective}</p>
              <p className="text-[9px] text-slate-500 mt-0.5"><strong>O:</strong> {PREV_ENCOUNTER.objective}</p>
              <p className="text-[9px] text-slate-500 mt-0.5"><strong>A:</strong> {PREV_ENCOUNTER.assessment}</p>
              <p className="text-[9px] text-slate-500 mt-0.5"><strong>P:</strong> {PREV_ENCOUNTER.plan}</p>
            </div>

            {showDiff && (
              <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-[10px] font-semibold text-amber-700 mb-1">Diff View</p>
                <p className="text-[9px]"><span className="bg-yellow-200">Last: HTN controlled.</span></p>
                <p className="text-[9px]"><span className="bg-yellow-200">New: BP mildly elevated.</span></p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex-1 rounded-lg bg-sky-600 px-4 py-2.5 text-[10px] font-medium text-white">{copied ? <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" /> : <Copy className="h-3.5 w-3.5 inline mr-1" />}{copied ? "Copied!" : "Accept All"}</button>
              <button onClick={() => setShowDiff(!showDiff)} className="rounded-lg border px-4 py-2.5 text-[10px]"><Eye className="h-3 w-3 inline mr-1" />Diff</button>
              <button className="rounded-lg border px-4 py-2.5 text-[10px] text-red-500">Clear All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
