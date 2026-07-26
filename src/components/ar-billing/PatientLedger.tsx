/**
 * PatientLedger — Patient Statement & Co-pay Portal
 *
 * Itemized balances with aging summary. Mock payment form
 * with credit card processing and running balance update.
 */

import { useState } from "react";
import { CreditCard, DollarSign, CheckCircle2, X, ChevronDown } from "lucide-react";

// ─── Mock Data ──────────────────────────────────────────────────────

interface Transaction {
  date: string;
  service: string;
  cpt: string;
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientDue: number;
  balance: number;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { date: "2026-06-15", service: "Office Visit - Established", cpt: "99213", billed: 150, allowed: 120, insurancePaid: 96, patientDue: 24, balance: 0 },
  { date: "2026-06-01", service: "Comprehensive Metabolic Panel", cpt: "80053", billed: 85, allowed: 65, insurancePaid: 52, patientDue: 13, balance: 0 },
  { date: "2026-05-10", service: "Lipid Panel", cpt: "80061", billed: 75, allowed: 55, insurancePaid: 44, patientDue: 11, balance: 11 },
  { date: "2026-04-22", service: "ECG 12-Lead", cpt: "93005", billed: 200, allowed: 150, insurancePaid: 120, patientDue: 30, balance: 30 },
  { date: "2026-03-15", service: "Office Visit - New", cpt: "99203", billed: 220, allowed: 175, insurancePaid: 140, patientDue: 35, balance: 35 },
];

// ─── Component ───────────────────────────────────────────────────────

export function PatientLedger() {
  const [showPanel, setShowPanel] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [transactions] = useState(MOCK_TRANSACTIONS);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [cardForm, setCardForm] = useState({ name: "", number: "", expiry: "", cvv: "" });

  const totalBalance = transactions.reduce((s, t) => s + t.balance, 0);
  const totalBilled = transactions.reduce((s, t) => s + t.billed, 0);
  const totalInsurance = transactions.reduce((s, t) => s + t.insurancePaid, 0);

  const aging = {
    current: transactions.filter(t => t.balance > 0 && new Date(t.date) > new Date("2026-05-30")).reduce((s, t) => s + t.balance, 0),
    d30: transactions.filter(t => t.balance > 0 && new Date(t.date) <= new Date("2026-05-30") && new Date(t.date) > new Date("2026-04-30")).reduce((s, t) => s + t.balance, 0),
    d60: transactions.filter(t => t.balance > 0 && new Date(t.date) <= new Date("2026-04-30")).reduce((s, t) => s + t.balance, 0),
  };

  const processPayment = () => {
    setPaymentSuccess(true);
    setShowPayment(false);
    setTimeout(() => setPaymentSuccess(false), 3000);
  };

  return (
    <div className="relative">
      <button onClick={() => setShowPanel(!showPanel)} className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-600 hover:bg-amber-100">
        <DollarSign className="h-3.5 w-3.5" /> Ledger
        {totalBalance > 0 && <span className="rounded-full bg-amber-200 px-1.5 text-[9px] text-amber-700">${totalBalance}</span>}
      </button>
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 bg-black/20" onClick={() => setShowPanel(false)}>
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl p-5 animate-slide-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="text-sm font-bold text-slate-800">Patient Ledger</h3><p className="text-[9px] text-slate-400">Statement & Payment Portal</p></div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400"><X className="h-4 w-4" /></button>
            </div>

            {/* Aging Summary */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: "Current", amt: aging.current, color: "text-green-600" },
                { label: "31-60 Days", amt: aging.d30, color: "text-amber-600" },
                { label: "61-90 Days", amt: aging.d60, color: "text-orange-600" },
                { label: "Total Due", amt: totalBalance, color: totalBalance > 0 ? "text-red-600" : "text-green-600" },
              ].map((a) => (
                <div key={a.label} className="rounded-lg border border-slate-200 p-2 text-center">
                  <p className="text-[8px] text-slate-400">{a.label}</p>
                  <p className={`text-sm font-bold ${a.color}`}>${a.amt}</p>
                </div>
              ))}
            </div>

            {/* KPI Row */}
            <div className="flex gap-4 mb-3 text-[9px] text-slate-500">
              <span>Total Billed: <strong>${totalBilled}</strong></span>
              <span>Insurance Paid: <strong>${totalInsurance}</strong></span>
            </div>

            {/* Transactions Table */}
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-[9px]">
                <thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="pb-1 pr-2">Date</th><th className="pb-1 pr-2">Service</th><th className="pb-1 pr-2">CPT</th><th className="pb-1 pr-2">Billed</th><th className="pb-1 pr-2">Allowed</th><th className="pb-1 pr-2">Ins Paid</th><th className="pb-1 pr-2">Pt Due</th><th className="pb-1">Bal</th></tr></thead>
                <tbody>
                  {transactions.map((t, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-1 pr-2 text-slate-400">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="py-1 pr-2 text-slate-600">{t.service}</td>
                      <td className="py-1 pr-2 font-mono text-slate-500">{t.cpt}</td>
                      <td className="py-1 pr-2">${t.billed}</td>
                      <td className="py-1 pr-2">${t.allowed}</td>
                      <td className="py-1 pr-2 text-green-600">${t.insurancePaid}</td>
                      <td className="py-1 pr-2">${t.patientDue}</td>
                      <td className={`py-1 font-bold ${t.balance > 0 ? "text-red-600" : "text-green-600"}`}>${t.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {paymentSuccess && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div><p className="text-[10px] font-bold text-green-700">Payment Processed!</p><p className="text-[9px] text-green-600">Confirmation #: PAY-{Date.now().toString(36).toUpperCase()}</p></div>
              </div>
            )}

            {!showPayment ? (
              <button onClick={() => setShowPayment(true)} className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2.5 text-[10px] font-medium text-white hover:bg-amber-500">
                <CreditCard className="h-3.5 w-3.5" /> Make Payment
              </button>
            ) : (
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-semibold text-slate-700 mb-2">Payment Details</p>
                <div className="space-y-2">
                  <input type="text" placeholder="Cardholder Name" value={cardForm.name} onChange={e => setCardForm({...cardForm, name: e.target.value})} className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none" />
                  <input type="text" placeholder="Card Number" value={cardForm.number} onChange={e => setCardForm({...cardForm, number: e.target.value.replace(/\D/g,"").slice(0,16)})} className="w-full rounded-lg border px-3 py-2 text-[10px] outline-none" />
                  <div className="flex gap-2">
                    <input type="text" placeholder="MM/YY" value={cardForm.expiry} onChange={e => setCardForm({...cardForm, expiry: e.target.value})} className="flex-1 rounded-lg border px-3 py-2 text-[10px] outline-none" />
                    <input type="text" placeholder="CVV" value={cardForm.cvv} onChange={e => setCardForm({...cardForm, cvv: e.target.value.replace(/\D/g,"").slice(0,4)})} className="w-16 rounded-lg border px-3 py-2 text-[10px] outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={processPayment} className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-[10px] font-medium text-white">Pay ${totalBalance}</button>
                    <button onClick={() => setShowPayment(false)} className="rounded-lg border px-4 py-2 text-[10px]">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
