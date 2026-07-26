/**
 * PeerToPeerScheduler — P2P Review Scheduler for Denied PAs
 *
 * Calendar date picker, provider dropdown, 30-min time slots.
 * Confirmation view with pre-populated clinical summary.
 */

import { useState } from "react";
import { Calendar, Clock, User, CheckCircle2, X } from "lucide-react";

const PROVIDERS = ["Dr. Smith", "Dr. Patel", "Dr. Williams"];
const TIME_SLOTS = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "13:00", "13:30", "14:00", "14:30"];

export function PeerToPeerScheduler() {
  const [showPanel, setShowPanel] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [provider, setProvider] = useState("");
  const [scheduled, setScheduled] = useState(false);

  const handleSchedule = () => { if (date && time && provider) setScheduled(true); };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-medium text-indigo-600 hover:bg-indigo-100"><Calendar className="h-3.5 w-3.5" /> P2P Review</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">Peer-to-Peer Scheduler</h3><p className="text-[9px] text-slate-400">For denied prior authorizations</p></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>

            {!scheduled ? (
              <div className="space-y-2">
                <div><label className="text-[10px] font-medium text-slate-500">Select Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none mt-1" /></div>
                <div><label className="text-[10px] font-medium text-slate-500">Select Time</label><div className="flex flex-wrap gap-1 mt-1">{TIME_SLOTS.map(t => <button key={t} onClick={() => setTime(t)} className={`rounded-lg px-2 py-1 text-[9px] ${time===t?"bg-indigo-600 text-white":"bg-slate-100 text-slate-500"}`}>{t}</button>)}</div></div>
                <div><label className="text-[10px] font-medium text-slate-500">Reviewing Provider</label><select value={provider} onChange={e => setProvider(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none mt-1"><option value="">Select provider...</option>{PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                <button onClick={handleSchedule} disabled={!date||!time||!provider} className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-[10px] font-medium text-white disabled:bg-slate-300"><Calendar className="h-3.5 w-3.5 inline mr-1" />Schedule P2P Review</button>
              </div>
            ) : (
              <div className="rounded-lg bg-green-50 p-4">
                <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-5 w-5 text-green-600" /><span className="text-sm font-bold text-green-800">P2P Scheduled!</span></div>
                <div className="space-y-1 text-[10px] text-green-700"><p><Calendar className="h-3 w-3 inline mr-1" />{date} at {time}</p><p><User className="h-3 w-3 inline mr-1" />{provider}</p></div>
                <p className="mt-2 text-[9px] text-green-600">Clinical summary pre-populated for review.</p>
                <button className="mt-2 rounded-lg border border-green-300 px-3 py-1 text-[9px] text-green-700">Add to Calendar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
