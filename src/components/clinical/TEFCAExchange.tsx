/**
 * TEFCAExchange — TEFCA Nationwide Record Query
 *
 * Search external networks: Epic Care Everywhere, CommonWell, eHealth Exchange.
 * Mock results with matching scores. Import Records button.
 */

import { useState } from "react";
import { Search, Download, Globe, X, CheckCircle2 } from "lucide-react";

const NETWORKS = ["Epic Care Everywhere", "CommonWell", "eHealth Exchange", "Carequality"];
const MOCK_RESULTS = [
  { name: "Jane Doe", dob: "03/15/1979", mrn: "MRN-1001", lastVisit: "2026-06-15", facility: "Springfield General", score: 98, network: "Epic Care Everywhere" },
  { name: "Jane A. Doe", dob: "03/15/1979", mrn: "EXT-5421", lastVisit: "2026-05-20", facility: "Mercy Medical Center", score: 94, network: "CommonWell" },
  { name: "J. Doe", dob: "03/XX/1979", mrn: "EXT-7831", lastVisit: "2026-04-10", facility: "University Hospital", score: 82, network: "eHealth Exchange" },
];

export function TEFCAExchange() {
  const [showPanel, setShowPanel] = useState(false);
  const [network, setNetwork] = useState("Epic Care Everywhere");
  const [imported, setImported] = useState<Set<number>>(new Set());

  const importRecord = (i: number) => setImported(prev => new Set([...prev, i]));

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-[10px] font-medium text-cyan-600 hover:bg-cyan-100"><Globe className="h-3.5 w-3.5" /> TEFCA Exchange {imported.size > 0 && `(${imported.size})`}</button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><div><h3 className="text-sm font-bold text-slate-800">TEFCA Record Exchange</h3><p className="text-[8px] text-slate-400">Simulated TEFCA — educational purposes only</p></div><button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button></div>
            <div className="mb-3"><label className="text-[10px] font-medium text-slate-500">Select Network</label><select value={network} onChange={e => setNetwork(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none mt-1">{NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
            <div className="space-y-2">
              {MOCK_RESULTS.filter(r => r.network === network).map((r, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between mb-1"><span className="text-[10px] font-semibold text-slate-700">{r.name}</span><span className="rounded-full bg-blue-100 px-2 py-0.5 text-[8px] font-bold text-blue-700">{r.score}% match</span></div>
                  <div className="grid grid-cols-2 gap-0.5 text-[9px] text-slate-500"><span>DOB: {r.dob}</span><span>MRN: {r.mrn}</span><span>Last Visit: {r.lastVisit}</span><span>Facility: {r.facility}</span></div>
                  {imported.has(i) ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded bg-green-100 px-2 py-1 text-[9px] text-green-700"><CheckCircle2 className="h-3 w-3" /> Imported</span>
                  ) : (
                    <button onClick={() => importRecord(i)} className="mt-2 rounded bg-cyan-600 px-2 py-1 text-[9px] font-medium text-white"><Download className="h-3 w-3 inline mr-1" />Import Records</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
