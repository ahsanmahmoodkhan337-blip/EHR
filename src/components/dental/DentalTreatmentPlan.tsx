/**
 * DentalTreatmentPlan.tsx — Treatment planning workspace (Dentrix Tx Planner)
 *
 * Inspired by: Dentrix Treatment Planner / Open Dental Treatment Plan module,
 * where the front office builds a planned treatment list (procedure, tooth,
 * surface/quadrant, fee), sees a per-item insurance estimate BEFORE the work is
 * done, and then "accepts" the plan to convert it into completed procedures
 * that feed coding and billing.
 *
 * This component owns the "planning" stage. It reuses the dental data layer
 * (`searchCDT`, `findCDT`, tooth/area notation) and `adjudicateDentalClaim()`
 * for estimates — it contains NO adjudication logic of its own. Accepting the
 * plan calls `acceptPlan()`, which seeds the coding stage's claim lines.
 */

import { useMemo, useState } from "react";
import { Plus, Search, CheckCircle2, X, Stethoscope, ArrowRight, Info, Paperclip, Receipt } from "lucide-react";
import {
  ALL_TEETH,
  CDT_CATEGORY_ORDER,
  attachmentsForCode,
  cdtByCategory,
  findCDT,
  findTooth,
  isPredeterminationCandidate,
  ORAL_CAVITY_AREAS,
  searchCDT,
  type CDTCode,
  type CDTRequirement,
} from "../../data/dental";
import { useDentalTrack, type DentalClaimLine, type TxPlanItem } from "./DentalTrackStore";
import { adjudicateDentalClaim } from "./adjudication";

const style = {
  card: "rounded-xl border border-slate-200 bg-white shadow-sm",
  label: "text-[10px] font-semibold uppercase tracking-wider text-slate-500",
  input:
    "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500",
};

/** Convert a treatment-plan item into the claim-line shape the adjudicator expects. */
function toClaimLine(p: TxPlanItem): DentalClaimLine {
  return {
    id: p.id,
    code: p.code,
    tooth: p.tooth,
    surfaces: p.surfaces,
    quadrant: p.quadrant,
    dateOfService: p.dateOfService,
    feeUsd: p.feeUsd,
    predeterminationOnFile: false,
    attachments: [],
    note: p.note,
  };
}

export function DentalTreatmentPlan() {
  const { state, activeCase, addPlanItem, removePlanItem, acceptPlan, goTo } = useDentalTrack();

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(CDT_CATEGORY_ORDER[0] ?? "Diagnostic");
  const [draft, setDraft] = useState<{
    code?: string;
    tooth?: string;
    surfaces?: string;
    quadrant?: string;
    feeUsd: number;
    dateOfService: string;
  }>({ feeUsd: 0, dateOfService: "2027-02-11" });
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => (query.trim() ? searchCDT(query).slice(0, 50) : []), [query]);
  const currentCode: CDTCode | undefined = draft.code ? findCDT(draft.code) : undefined;
  const requires = currentCode?.requires ?? [];
  const needs = (r: CDTRequirement) => requires.includes(r);

  const planned = state.txPlan.filter((p) => p.status === "planned");
  const acceptedCount = state.txPlan.length - planned.length;

  // Insurance estimate over the planned (not yet accepted) items only.
  const estimate = useMemo(
    () => adjudicateDentalClaim(planned.map(toClaimLine), activeCase),
    [planned, activeCase],
  );

  const chooseCode = (code: CDTCode) => {
    setDraft((d) => ({ ...d, code: code.code, tooth: undefined, surfaces: undefined, quadrant: undefined }));
  };

  const toggleSurface = (surface: string) => {
    setDraft((d) => {
      const cur = (d.surfaces ?? "").split("");
      const next = cur.includes(surface) ? cur.filter((x) => x !== surface) : [...cur, surface];
      return { ...d, surfaces: next.join("") };
    });
  };

  const addToPlan = () => {
    if (!currentCode) return;
    const missing: string[] = [];
    if (needs("tooth") && !draft.tooth) missing.push("tooth");
    if (needs("surface") && !draft.surfaces) missing.push("surfaces");
    if ((needs("quadrant") || needs("arch") || needs("oral-cavity-area")) && !draft.quadrant) missing.push("area/quadrant");
    if (missing.length) {
      setError(`Still need: ${missing.join(", ")}.`);
      return;
    }
    const item: TxPlanItem = {
      id: `tp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: currentCode.code,
      tooth: draft.tooth,
      surfaces: draft.surfaces,
      quadrant: draft.quadrant,
      dateOfService: draft.dateOfService || "2027-02-11",
      feeUsd: draft.feeUsd || currentCode.illustrativeFeeUsd,
      attachments: [],
      status: "planned",
    };
    addPlanItem(item);
    setDraft({ feeUsd: 0, dateOfService: draft.dateOfService || "2027-02-11" });
    setError(null);
  };

  const accept = () => {
    if (planned.length === 0) {
      setError("Add at least one procedure to the plan before accepting treatment.");
      return;
    }
    acceptPlan(); // seeds coding lines and advances to the coding stage
  };

  return (
    <div className="flex h-full gap-3 overflow-hidden p-3">
      {/* ── Left: CDT repository ─────────────────────────────────────────── */}
      <div className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search CDT code or procedure…"
              className={style.input + " pl-8"}
            />
          </div>
          {!query.trim() && (
            <div className="mt-2 flex gap-1 overflow-x-auto pb-0.5">
              {CDT_CATEGORY_ORDER.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    activeCategory === cat ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {!query.trim() && (
            <p className="px-1 pb-1 text-[10px] text-slate-400">CDT teaching subset — fees are illustrative, not a fee schedule.</p>
          )}
          {(query.trim() ? results : cdtByCategory(activeCategory as Parameters<typeof cdtByCategory>[0])).map((code) => (
            <div
              key={code.code}
              onClick={() => chooseCode(code)}
              className={`mb-1 cursor-pointer rounded-lg border p-2 ${
                draft.code === code.code ? "border-teal-300 bg-teal-50" : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{code.code}</code>
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{code.shortName}</span>
                <span className="shrink-0 text-[9px] text-amber-600">${code.illustrativeFeeUsd}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: plan builder + estimate ─────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Treatment Planning</h3>
            <p className="text-[10px] text-slate-400">
              Build the plan, see the insurance estimate, then accept treatment to send it to coding.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => goTo("predetermination")}
              className="flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
            >
              <Receipt className="h-3.5 w-3.5" /> Predetermination
            </button>
            <button
              onClick={accept}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Accept treatment →
            </button>
          </div>
        </div>

        {/* case hint */}
        {activeCase && (
          <div className="rounded-xl border border-teal-100 bg-teal-50 p-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-teal-700">
              <Stethoscope className="h-3 w-3" /> Case treatment performed
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-teal-800">
              {activeCase.clinicalNote.treatmentPerformed.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* add form */}
        {currentCode && (
          <div className={style.card + " p-3"}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-sm font-bold text-slate-900">{currentCode.code}</span>
                <span className="ml-2 text-xs font-medium text-slate-600">{currentCode.shortName}</span>
              </div>
              <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                ${currentCode.illustrativeFeeUsd} illustrative
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{currentCode.teachingDescription}</p>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date of service</span>
                <input
                  type="date"
                  value={draft.dateOfService}
                  onChange={(e) => setDraft({ ...draft, dateOfService: e.target.value })}
                  className={style.input}
                />
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Fee (USD, illustrative)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.feeUsd === 0 ? "" : draft.feeUsd}
                  placeholder={String(currentCode.illustrativeFeeUsd)}
                  onChange={(e) => setDraft({ ...draft, feeUsd: e.target.valueAsNumber || 0 })}
                  className={style.input}
                />
              </label>
              {needs("tooth") && (
                <label className="block">
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Tooth (Universal)</span>
                  <select
                    value={draft.tooth ?? ""}
                    onChange={(e) => setDraft({ ...draft, tooth: e.target.value || undefined, surfaces: undefined })}
                    className={style.input}
                  >
                    <option value="">— select tooth —</option>
                    {ALL_TEETH.map((t) => (
                      <option key={t.universal} value={t.universal}>
                        #{t.universal} {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(needs("quadrant") || needs("arch") || needs("oral-cavity-area")) && (
                <label className="block">
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {needs("quadrant") ? "Quadrant" : needs("arch") ? "Arch" : "Area"}
                  </span>
                  <select
                    value={draft.quadrant ?? ""}
                    onChange={(e) => setDraft({ ...draft, quadrant: e.target.value || undefined })}
                    className={style.input}
                  >
                    <option value="">— select —</option>
                    {ORAL_CAVITY_AREAS.map((area) => (
                      <option key={area.code} value={area.code}>
                        {area.code} · {area.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {needs("surface") && draft.tooth && (
                <div className="col-span-2 sm:col-span-3">
                  <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Surfaces</span>
                  <div className="flex flex-wrap gap-1">
                    {(findTooth(draft.tooth)?.validSurfaces ?? []).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSurface(s)}
                        className={`h-6 w-6 rounded-md text-[10px] font-bold ${
                          (draft.surfaces ?? "").includes(s) ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {needs("none") && (
                <div className="col-span-2 rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-500 sm:col-span-1">
                  No tooth / area data required.
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={addToPlan}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-500"
              >
                <Plus className="h-3.5 w-3.5" /> Add to plan
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            {error}
          </div>
        )}

        {/* plan list + estimate */}
        <div className={style.card + " p-3"}>
          <div className="mb-2 flex items-center justify-between">
            <p className={style.label}>Treatment plan {planned.length > 0 ? `(${planned.length} planned)` : ""}</p>
            {acceptedCount > 0 && <span className="text-[10px] text-slate-400">{acceptedCount} accepted → coding</span>}
          </div>
          {planned.length === 0 && (
            <p className="py-4 text-center text-[11px] text-slate-400">
              No planned procedures yet. Pick a CDT code on the left to start the plan.
            </p>
          )}
          <div className="space-y-1.5">
            {planned.map((p) => {
              const c = findCDT(p.code);
              const est = estimate.lines.find((l) => l.lineId === p.id);
              const reqs = attachmentsForCode(p.code);
              const gathered = (p.attachments ?? []).filter((a) => reqs.some((r) => r.type === a)).length;
              const missing = reqs.length - gathered;
              const candidate = isPredeterminationCandidate(p.code);
              return (
                <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800">
                        {p.code} {c ? `· ${c.shortName}` : ""}
                      </p>
                      <p className="truncate text-[10px] text-slate-500">
                        DOS {p.dateOfService}
                        {p.tooth ? ` · #${p.tooth}` : ""}
                        {p.surfaces ? ` · ${p.surfaces}` : ""}
                        {p.quadrant ? ` · ${p.quadrant}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-right text-[10px] leading-tight">
                        <span className="block text-slate-500">fee {fmtDollar(p.feeUsd)}</span>
                        {est ? (
                          <span className="block">
                            <span className="text-emerald-600">plan {fmtDollar(est.result.planPaysUsd)}</span>
                            {" / "}
                            <span className="text-red-600">pt {fmtDollar(est.result.patientOwesUsd)}</span>
                          </span>
                        ) : (
                          <span className="block text-slate-400">—</span>
                        )}
                      </span>
                      <button
                        onClick={() => removePlanItem(p.id)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {(reqs.length > 0 || candidate) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-1">
                      {reqs.length > 0 && (
                        <span
                          className={`flex items-center gap-1 text-[9px] font-medium ${
                            missing > 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          <Paperclip className="h-3 w-3" />
                          {gathered}/{reqs.length} attachments{missing > 0 ? ` · ${missing} missing` : " gathered"}
                        </span>
                      )}
                      {candidate && (
                        <button
                          onClick={() => goTo("predetermination")}
                          className="ml-auto flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[9px] font-semibold text-teal-700 hover:bg-teal-200"
                        >
                          <Receipt className="h-3 w-3" /> Predetermine
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 flex items-center gap-1 text-[9px] text-slate-400">
            <Info className="h-3 w-3 shrink-0" />
            Estimates use the plan's benefit rules (fictional payer). A downgrade is shown as a reduced allowance, never as a denial.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => goTo("briefing")}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Back to briefing
          </button>
          <button
            onClick={accept}
            className="flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
          >
            Accept treatment <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function fmtDollar(n: number): string {
  return `$${Math.round(n * 100) / 100}`;
}
