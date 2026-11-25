/**
 * ClaimLifecycle — the landing page's one moving piece.
 *
 * A claim travels the revenue cycle on a loop: coded, sent as an 837P,
 * accepted on a 277CA, answered by an 835, posted. When the 835 arrives the
 * charge splits into what a biller is paid to understand — allowed amount,
 * contractual write-off, deductible, coinsurance, payment — using the Tutorial
 * Patient's own Medicare Part B numbers, so a student who enrolls meets the
 * same claim inside the EHR.
 *
 * Reduced motion: the card shows the finished, posted claim and does not loop.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const STAGES = [
  { id: "coded", label: "Coded", note: "ICD-10 and CPT linked line by line" },
  { id: "sent", label: "837P sent", note: "CMS-1500 transmitted to the clearinghouse" },
  { id: "accepted", label: "277CA accepted", note: "On the payer's file — nothing paid yet" },
  { id: "remit", label: "835 received", note: "The payer prices every line" },
  { id: "posted", label: "Posted", note: "Ledger matches the 835 to the cent" },
] as const;

const HOLD_MS = [2600, 1700, 1700, 4200, 3000];

const money = (n: number) => `$${n.toFixed(2)}`;

export function ClaimLifecycle() {
  const reduceMotion = useReducedMotion();
  const last = STAGES.length - 1;
  const [stage, setStage] = useState(reduceMotion ? last : 0);

  useEffect(() => {
    if (reduceMotion) {
      setStage(last);
      return;
    }
    const timer = window.setTimeout(() => setStage((s) => (s + 1) % STAGES.length), HOLD_MS[stage]);
    return () => window.clearTimeout(timer);
  }, [stage, reduceMotion, last]);

  const priced = stage >= 3;
  const posted = stage >= 4;

  return (
    <figure
      className="relative w-full max-w-md rounded-2xl bg-white text-slate-800 shadow-[0_30px_80px_-20px_rgba(8,14,60,0.55)] ring-1 ring-white/10"
      aria-label="A claim moving from coding to payment"
    >
      {/* Stage track */}
      <ol className="flex gap-1 border-b border-slate-100 px-4 pb-3 pt-4">
        {STAGES.map((s, i) => (
          <li key={s.id} className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="h-full rounded-full bg-[#2040c0]"
                initial={false}
                animate={{ width: i <= stage ? "100%" : "0%" }}
                transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
              />
            </div>
            <p
              className={`mt-1.5 text-[10px] leading-tight transition-colors ${
                i === stage ? "font-semibold text-[#192166]" : i < stage ? "text-slate-500" : "text-slate-300"
              }`}
            >
              {s.label}
            </p>
          </li>
        ))}
      </ol>

      <div className="px-5 pb-5 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900">CLM-000002</p>
            <p className="text-[11px] text-slate-500">Tutorial Patient, Medicare Part B</p>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={STAGES[stage].id}
              initial={{ opacity: 0, scale: reduceMotion ? 1 : 1.25, rotate: reduceMotion ? 0 : -8 }}
              animate={{ opacity: 1, scale: 1, rotate: reduceMotion ? 0 : -4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.28 }}
              className={`rounded-md border-2 px-2 py-0.5 text-[11px] font-bold ${
                posted
                  ? "border-[#5f8f22] text-[#4a7419]"
                  : priced
                    ? "border-[#0f766e] text-[#0f766e]"
                    : "border-[#2040c0] text-[#2040c0]"
              }`}
            >
              {STAGES[stage].label}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Service lines */}
        <table className="mt-4 w-full text-[12px] tabular-nums">
          <thead>
            <tr className="text-left text-[10px] text-slate-400">
              <th className="pb-1 font-medium">CPT</th>
              <th className="pb-1 font-medium">Diagnosis</th>
              <th className="pb-1 text-right font-medium">Charge</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            <tr className="border-t border-slate-100">
              <td className="py-1.5 font-semibold">99214</td>
              <td className="py-1.5 text-slate-500">R07.9, I10, I25.10</td>
              <td className="py-1.5 text-right">{money(225)}</td>
            </tr>
            <tr className="border-t border-slate-100">
              <td className="py-1.5 font-semibold">93000</td>
              <td className="py-1.5 text-slate-500">R07.9</td>
              <td className="py-1.5 text-right">{money(55)}</td>
            </tr>
          </tbody>
        </table>

        {/* The 835's answer */}
        <div className="mt-3 min-h-[148px] rounded-xl bg-slate-50 px-3 py-2.5">
          <AnimatePresence mode="wait" initial={false}>
            {!priced ? (
              <motion.p
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="pt-10 text-center text-[12px] text-slate-400"
              >
                {STAGES[stage].note}
              </motion.p>
            ) : (
              <motion.dl
                key="priced"
                initial="hidden"
                animate="shown"
                exit={{ opacity: 0 }}
                variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.35 } } }}
                className="space-y-1 text-[12px] tabular-nums"
              >
                {[
                  ["Allowed for 99214", money(106.21), "text-slate-800 font-semibold"],
                  ["CO-45 contractual write-off", `−${money(118.79)}`, "text-slate-500"],
                  ["CO-236 93000 bundled same day", `−${money(55)}`, "text-slate-500"],
                  ["PR-1 deductible", money(50), "text-[#0f766e]"],
                  ["PR-2 coinsurance 20%", money(11.24), "text-[#0f766e]"],
                  ["Medicare paid", money(44.97), "text-[#192166] font-bold"],
                ].map(([label, value, tone]) => (
                  <motion.div
                    key={label}
                    variants={{
                      hidden: { opacity: 0, x: reduceMotion ? 0 : -8 },
                      shown: { opacity: 1, x: 0 },
                    }}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <dt className="text-slate-500">{label}</dt>
                    <dd className={tone}>{value}</dd>
                  </motion.div>
                ))}
              </motion.dl>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-slate-200 pt-2.5 text-[12px] tabular-nums">
          <span className="text-slate-500">Patient owes</span>
          <motion.span
            initial={false}
            animate={{ opacity: posted ? 1 : 0.25 }}
            className="font-bold text-slate-900"
          >
            {posted ? money(61.24) : "—"}
          </motion.span>
        </div>
      </div>
    </figure>
  );
}
