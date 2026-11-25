/**
 * TutorialGuides — the six how-to guides as a list and a reader.
 *
 * The list is the order of the revenue cycle, so it is numbered. Picking a
 * guide swaps the reader; that swap is the only motion here, and it answers
 * the click.
 */

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock, MapPin } from "lucide-react";
import { HOW_TO_TUTORIALS } from "../../domain/howToTutorials";

export function TutorialGuides() {
  const reduceMotion = useReducedMotion();
  const [activeId, setActiveId] = useState(HOW_TO_TUTORIALS[0].id);
  const active = HOW_TO_TUTORIALS.find((t) => t.id === activeId) ?? HOW_TO_TUTORIALS[0];

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <ol className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0" aria-label="Tutorials">
        {HOW_TO_TUTORIALS.map((t, i) => {
          const selected = t.id === activeId;
          return (
            <li key={t.id} className="shrink-0 md:shrink">
              <button
                type="button"
                onClick={() => setActiveId(t.id)}
                aria-current={selected ? "step" : undefined}
                className={`flex w-full min-w-[13rem] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2040c0] md:min-w-0 ${
                  selected ? "bg-[#192166] text-white" : "text-slate-600 hover:bg-white"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    selected ? "bg-white text-[#192166]" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium leading-snug">{t.title}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="min-h-[22rem] rounded-2xl bg-white p-6 ring-1 ring-slate-200 md:p-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={active.id}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
          >
            <h3 className="text-xl font-bold text-slate-900">{active.title}</h3>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {active.where}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                About {active.minutes} min
              </span>
            </p>

            <ol className="mt-6 space-y-4">
              {active.steps.map((step, i) => (
                <li key={step.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-[#eef1fc] text-[12px] font-bold text-[#2040c0] tabular-nums">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">{step.title}</p>
                    <p className="mt-0.5 max-w-[60ch] text-[14px] leading-relaxed text-slate-600">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-6 border-t border-slate-100 pt-4 text-[13px] text-slate-500">
              <span className="font-semibold text-slate-700">You'll finish with: </span>
              {active.outcome}
            </p>
          </motion.article>
        </AnimatePresence>
      </div>
    </div>
  );
}
