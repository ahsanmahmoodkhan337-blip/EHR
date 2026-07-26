/**
 * OrderSetBundles — CPOE Condition-Specific Order Bundles
 *
 * Dropdown of order bundles that auto-populate a checklist.
 * Bundles: Diabetes Annual, Chest Pain Protocol, Pre-Op Clearance,
 * Annual Wellness, Hypertension Follow-Up.
 */

import { useState } from "react";
import { ClipboardList, CheckCircle2, AlertTriangle, X, ChevronDown } from "lucide-react";

// ─── Order Bundle Data ──────────────────────────────────────────────

interface Order {
  name: string;
  type: "Lab" | "Imaging" | "Medication" | "Referral";
  cpt: string;
}

const ORDER_BUNDLES: Record<string, { label: string; orders: Order[] }> = {
  "diabetes-annual": {
    label: "Diabetes Annual",
    orders: [
      { name: "HbA1c", type: "Lab", cpt: "83036" },
      { name: "Lipid Panel", type: "Lab", cpt: "80061" },
      { name: "Microalbumin/Creatinine Ratio", type: "Lab", cpt: "82570" },
      { name: "Eye Exam Referral", type: "Referral", cpt: "92014" },
      { name: "Metformin 500mg", type: "Medication", cpt: "N/A" },
    ],
  },
  "chest-pain": {
    label: "Chest Pain Protocol",
    orders: [
      { name: "Troponin I", type: "Lab", cpt: "84484" },
      { name: "ECG 12-Lead", type: "Imaging", cpt: "93005" },
      { name: "Chest X-Ray PA/LAT", type: "Imaging", cpt: "71046" },
      { name: "Aspirin 325mg", type: "Medication", cpt: "N/A" },
      { name: "Cardiology Consult", type: "Referral", cpt: "99244" },
    ],
  },
  "pre-op": {
    label: "Pre-Op Clearance",
    orders: [
      { name: "CBC with Differential", type: "Lab", cpt: "85025" },
      { name: "Basic Metabolic Panel", type: "Lab", cpt: "80048" },
      { name: "PT/PTT", type: "Lab", cpt: "85610" },
      { name: "ECG 12-Lead", type: "Imaging", cpt: "93005" },
      { name: "Chest X-Ray PA/LAT", type: "Imaging", cpt: "71046" },
      { name: "Type & Screen", type: "Lab", cpt: "86900" },
    ],
  },
  "annual-wellness": {
    label: "Annual Wellness",
    orders: [
      { name: "CBC", type: "Lab", cpt: "85027" },
      { name: "Comprehensive Metabolic Panel", type: "Lab", cpt: "80053" },
      { name: "Lipid Panel", type: "Lab", cpt: "80061" },
      { name: "TSH", type: "Lab", cpt: "84443" },
      { name: "Vitamin D 25-Hydroxy", type: "Lab", cpt: "82306" },
      { name: "Mammogram (screening)", type: "Imaging", cpt: "77067" },
    ],
  },
  "htn-followup": {
    label: "Hypertension Follow-Up",
    orders: [
      { name: "Basic Metabolic Panel", type: "Lab", cpt: "80048" },
      { name: "Lipid Panel", type: "Lab", cpt: "80061" },
      { name: "ECG 12-Lead", type: "Imaging", cpt: "93005" },
      { name: "Lisinopril 10mg", type: "Medication", cpt: "N/A" },
    ],
  },
};

// ─── Component ──────────────────────────────────────────────────────

export function OrderSetBundles() {
  const [showPanel, setShowPanel] = useState(false);
  const [selectedBundle, setSelectedBundle] = useState<string>("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [placed, setPlaced] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const selectBundle = (key: string) => {
    setSelectedBundle(key);
    setOrders(ORDER_BUNDLES[key].orders);
    setPlaced(false);
  };

  const placeAllOrders = () => {
    setPlaced(true);
    setShowConfirm(false);
  };

  const typeColor = (t: string) => {
    switch (t) {
      case "Lab": return "bg-blue-100 text-blue-700";
      case "Imaging": return "bg-purple-100 text-purple-700";
      case "Medication": return "bg-green-100 text-green-700";
      case "Referral": return "bg-amber-100 text-amber-700";
      default: return "bg-slate-100";
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[10px] font-medium text-teal-600 hover:bg-teal-100">
        <ClipboardList className="h-3.5 w-3.5" /> Order Sets
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">CPOE Order Sets</h3><p className="text-[9px] text-slate-400">Condition-specific order bundles</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            <div className="mb-3">
              <select value={selectedBundle} onChange={e => selectBundle(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[10px] outline-none">
                <option value="">Select order bundle...</option>
                {Object.entries(ORDER_BUNDLES).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.orders.length} orders)</option>)}
              </select>
            </div>

            {orders.length > 0 && (
              <div className="space-y-1 mb-3">
                <p className="text-[10px] font-semibold text-slate-600 mb-1">Orders ({orders.length})</p>
                {orders.map((o, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
                    <div className="flex items-center gap-2">
                      {placed ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <span className="h-3.5 w-3.5 rounded border border-slate-300" />}
                      <div>
                        <p className="text-[10px] font-medium text-slate-700">{o.name}</p>
                        <p className="text-[8px] text-slate-400">CPT: {o.cpt}</p>
                      </div>
                    </div>
                    <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${typeColor(o.type)}`}>{o.type}</span>
                  </div>
                ))}
              </div>
            )}

            {orders.length > 0 && !placed && (
              <button onClick={() => setShowConfirm(true)} className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-[10px] font-medium text-white hover:bg-teal-500">
                Place All Orders
              </button>
            )}
            {placed && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-[10px] font-medium text-green-700">All orders placed successfully!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="w-72 rounded-xl bg-white p-4 shadow-2xl">
            <p className="text-xs font-bold text-slate-800 mb-2">Confirm Order Placement</p>
            <p className="text-[10px] text-slate-500 mb-3">Place {orders.length} orders from {ORDER_BUNDLES[selectedBundle]?.label}?</p>
            <div className="flex gap-2">
              <button onClick={placeAllOrders} className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-[10px] font-medium text-white">Confirm</button>
              <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-lg border px-3 py-2 text-[10px]">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
