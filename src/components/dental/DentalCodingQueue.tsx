/**
 * DentalCodingQueue.tsx — Dental Coder workspace (CDT mode)
 *
 * Inspired by: dental billing suites (Dentrix, Open Dental) where the coder
 * picks CDT codes and the claim line must carry tooth/surface/quadrant/arch/
 * area data per code. Works against the dental data layer barrel only
 * (`~/data/dental`) — no imports from medical stage components.
 *
 * Teaching guardrails (integration spec appendix):
 *  - fees are labeled ILLUSTRATIVE — never presented as a fee schedule;
 *  - payers are visibly fictional;
 *  - a downgrade is never rendered as a denial (see DentalBillingLedger, step 7);
 *  - "appeal" is never offered where `appealable === false` (see DentalAR).
 */

import { useMemo, useState, type ReactNode } from "react";
import { Plus, Search, AlertTriangle, Info, X, FileText } from "lucide-react";
import {
  ALL_TEETH,
  CDT_CATEGORY_ORDER,
  cdtByCategory,
  findCDT,
  findDenial,
  findTooth,
  ORAL_CAVITY_AREAS,
  searchCDT,
  validateSurfaceCount,
  validateSurfaces,
  type CDTCode,
  type CDTRequirement,
} from "../../data/dental";
import { useDentalTrack, type DentalClaimLine } from "./DentalTrackStore";
import { Odontogram } from "./Odontogram";
import { PerioChart } from "./PerioChart";

const style = {
  card: "rounded-xl border border-slate-200 bg-white shadow-sm",
  label: "text-[10px] font-semibold uppercase tracking-wider text-slate-500",
  input:
    "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500",
};

export function DentalCodingQueue() {
  const { state, activeCase, addLine, removeLine, submitClaim, triggerTrap, traps, goTo } = useDentalTrack();

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>(CDT_CATEGORY_ORDER[0] ?? "Diagnostic");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"coding" | "perio">("coding");

  // ── line draft ──────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<Partial<DentalClaimLine> & { code?: string }>({
    dateOfService: "2027-02-11",
    feeUsd: 0,
  });

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchCDT(query).slice(0, 50); // capped — 99 codes would render on first keystroke
  }, [query]);

  const currentCode: CDTCode | undefined = draft.code ? findCDT(draft.code) : undefined;

  const chooseCode = (code: CDTCode) => {
    setDraft((d) => ({
      ...d,
      code: code.code,
      tooth: undefined,
      surfaces: undefined,
      quadrant: undefined,
      priorPlacementDate: undefined,
    }));
    setExpandedCode((e) => (e === code.code ? null : code.code));
  };

  // ── odontogram wiring: chart clicks populate the same draft state ────────
  const selectTooth = (tooth: string) => {
    const t = findTooth(tooth);
    setDraft((d) => ({ ...d, tooth, surfaces: undefined, quadrant: t?.quadrantArea ?? d.quadrant }));
  };

  const toggleSurface = (surface: string) => {
    setDraft((d) => {
      const current = (d.surfaces ?? "").split("");
      const next = current.includes(surface) ? current.filter((x) => x !== surface) : [...current, surface];
      return { ...d, surfaces: next.join("") };
    });
  };

  const selectQuadrant = (area: string) => {
    setDraft((d) => ({ ...d, quadrant: area }));
  };

  const requires = currentCode?.requires ?? [];
  const needs = (r: CDTRequirement) => requires.includes(r);

  const missingField = (): string | null => {
    if (needs("tooth") && !draft.tooth) return "tooth";
    if (needs("surface") && !draft.surfaces) return "surfaces";
    if (needs("quadrant") && !draft.quadrant) return "quadrant";
    if (needs("arch") && !draft.quadrant) return "arch";
    if (needs("oral-cavity-area") && !draft.quadrant) return "oral cavity area";
    if (needs("date-of-prior-placement") && !draft.priorPlacementDate) return "date of prior placement";
    return null;
  };

  const surfaceCheck = useMemo(() => {
    if (!currentCode || !draft.tooth || !draft.surfaces) return null;
    return validateSurfaces(draft.tooth, draft.surfaces);
  }, [currentCode, draft.tooth, draft.surfaces]);

  const surfaceCountCheck = useMemo(() => {
    if (!currentCode || !draft.surfaces) return null;
    return validateSurfaceCount(currentCode.code, draft.surfaces);
  }, [currentCode, draft.surfaces]);

  const dentitionCheck = useMemo(() => {
    if (!currentCode || !draft.tooth) return null;
    const t = findTooth(draft.tooth);
    if (!t) return null;
    const primaryCode = ["D2930", "D2940", "D1510", "D1520"].includes(currentCode.code);
    if (t.dentition === "primary" && !primaryCode)
      return `${t.name} is a primary tooth, but ${currentCode.code} is a permanent-dentition code — a payer would reject the line (DEN-TOOTH-ELIGIBILITY).`;
    if (t.dentition === "permanent" && primaryCode)
      return `${t.name} is a permanent tooth, but ${currentCode.code} is a primary-dentition code — a payer would reject the line (DEN-TOOTH-ELIGIBILITY).`;
    return null;
  }, [currentCode, draft.tooth]);

  const riskDenials = useMemo(() => {
    if (!currentCode) return [];
    const out: NonNullable<ReturnType<typeof findDenial>>[] = [];
    for (const id of currentCode.commonDenials ?? []) {
      const d = findDenial(id);
      if (d && !out.some((x) => x.id === d.id)) out.push(d);
    }
    return out;
  }, [currentCode]);

  const codingTrapHints = useMemo(() => {
    if (!currentCode) return [];
    return traps.filter(
      (t) => t.stage === "coding" && t.producesDenialId && (currentCode.commonDenials ?? []).includes(t.producesDenialId),
    );
  }, [currentCode, traps]);

  const addLineToClaim = () => {
    if (!currentCode) return;
    const missing = missingField();
    if (missing) {
      setError(`Missing required field: ${missing}. A payer would reject this line as missing information (DEN-DOC-MISSING).`);
      return;
    }
    if (surfaceCheck && !surfaceCheck.valid) {
      setError(surfaceCheck.reason ?? "Surfaces are invalid for the selected tooth.");
      return;
    }
    if (surfaceCountCheck && !surfaceCountCheck.valid) {
      setError(surfaceCountCheck.reason ?? "Surface count does not match the code.");
      return;
    }
    if (dentitionCheck) {
      setError(dentitionCheck);
      return;
    }
    // Feel-the-denial: a coding-stage trap whose denial this code commonly
    // triggers is let through — the claim stage will surface the denial.
    codingTrapHints.forEach((t) => triggerTrap(t.id));

    const line: DentalClaimLine = {
      id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: currentCode.code,
      tooth: draft.tooth,
      surfaces: draft.surfaces,
      quadrant: draft.quadrant,
      priorPlacementDate: draft.priorPlacementDate,
      dateOfService: draft.dateOfService ?? "2027-02-11",
      feeUsd: draft.feeUsd || currentCode.illustrativeFeeUsd,
      predeterminationOnFile: draft.predeterminationOnFile ?? false,
      attachments: draft.attachments ?? [],
      note: draft.note,
    };
    addLine(line);
    setDraft({ dateOfService: "2027-02-11", feeUsd: 0 });
    setError(null);
  };

  const submit = () => {
    if (state.lines.length === 0) {
      setError("Add at least one CDT line before submitting the claim.");
      return;
    }
    submitClaim();
    goTo("claim");
  };

  const warningsForCurrentCode = () => {
    if (!currentCode || draft.code !== currentCode.code) return [];
    const out: string[] = [];
    if (currentCode.predeterminationCommonlyRequested && !draft.predeterminationOnFile)
      out.push(
        "Predetermination is commonly requested for this service and none is on file — the plan decision notice may not be honoured. You may submit anyway and feel the consequence downstream.",
      );
    if ((currentCode.commonAttachments?.length ?? 0) > 0 && !(draft.attachments?.length))
      out.push(`Payers commonly require attachments for this line: ${currentCode.commonAttachments!.join(", ")}.`);
    if (currentCode.alternateBenefitRisk)
      out.push("Alternate-benefit risk: this plan may pay this service at a lower allowance. That is a reduction, not a denial.");
    return out;
  };
  const warnings = warningsForCurrentCode();

  return (
    <div className="flex h-full gap-3 overflow-hidden p-3">
      {/* ── Left: CDT repository ─────────────────────────────────────────── */}
      <div className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-1 flex-col overflow-hidden">
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
                      activeCategory === cat ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
              <p className="px-1 pb-1 text-[10px] text-slate-400">CDT teaching subset — type to search; fees are illustrative.</p>
            )}
            {query.trim() && results.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-slate-400">No CDT codes match “{query}”.</p>
            )}
            {(query.trim() ? results : cdtByCategory(activeCategory as Parameters<typeof cdtByCategory>[0])).map((code) => (
              <CodeRow
                key={code.code}
                code={code}
                expanded={expandedCode === code.code}
                selected={draft.code === code.code}
                onSelect={() => chooseCode(code)}
                onToggle={() => setExpandedCode((e) => (e === code.code ? null : code.code))}
              />
            ))}
          </div>
          <div className="border-t border-slate-100 p-2 text-center text-[9px] text-amber-600">
            Fees are ILLUSTRATIVE teaching figures — not a fee schedule. Payer names are fictional.
          </div>
        </div>
      </div>

      {/* ── Right: line builder / perio chart ─────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden pr-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-800">Dental Coding Workspace</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMode("coding")}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                mode === "coding" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Claim coding
            </button>
            <button
              onClick={() => setMode("perio")}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                mode === "perio" ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Perio chart
            </button>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              {state.lines.length} line{state.lines.length === 1 ? "" : "s"} on claim
            </span>
          </div>
        </div>

        {mode === "perio" ? (
          <div className="min-h-0 flex-1">
            <PerioChart />
          </div>
        ) : (
          <div className="flex flex-col gap-3 overflow-y-auto pr-1">

        {!currentCode && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
            <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            <p className="text-xs text-slate-500">
              Select a CDT code on the left to build a claim line. Each line carries its own tooth / surface / area data and
              its own date of service — a single claim can legitimately span two benefit years.
            </p>
            {activeCase && <p className="mt-2 text-[10px] text-slate-400">Case: {activeCase.title}</p>}
          </div>
        )}

        {currentCode && (
          <div className={style.card + " p-3"}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-base font-bold text-slate-900">{currentCode.code}</span>
                <span className="ml-2 text-xs font-medium text-slate-600">{currentCode.shortName}</span>
                <span className="ml-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">
                  {currentCode.category} · {currentCode.typicalBenefitClass}
                </span>
              </div>
              <span className="shrink-0 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                {fmtDollar(currentCode.illustrativeFeeUsd)} illustrative
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">{currentCode.teachingDescription}</p>

            {warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {warnings.map((w, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] text-amber-800"
                  >
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {(needs("tooth") || needs("surface") || needs("quadrant") || needs("arch") || needs("oral-cavity-area")) && (
              <div className="mt-3">
                <Odontogram
                  selectedTooth={draft.tooth}
                  onToothSelect={selectTooth}
                  selectedSurfaces={draft.surfaces}
                  onSurfaceToggle={toggleSurface}
                  selectedQuadrant={draft.quadrant}
                  onQuadrantSelect={selectQuadrant}
                />
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Field label="Date of service">
                <input
                  type="date"
                  value={draft.dateOfService ?? ""}
                  onChange={(e) => setDraft({ ...draft, dateOfService: e.target.value })}
                  className={style.input}
                />
              </Field>
              <Field label="Fee (USD, illustrative)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.feeUsd === 0 ? "" : draft.feeUsd}
                  placeholder={String(currentCode.illustrativeFeeUsd)}
                  onChange={(e) => setDraft({ ...draft, feeUsd: e.target.valueAsNumber || 0 })}
                  className={style.input}
                />
              </Field>
              {needs("date-of-prior-placement") && (
                <Field label="Date of prior placement">
                  <input
                    type="date"
                    value={draft.priorPlacementDate ?? ""}
                    onChange={(e) => setDraft({ ...draft, priorPlacementDate: e.target.value })}
                    className={style.input}
                  />
                </Field>
              )}
              {needs("tooth") && (
                <Field label="Tooth (Universal)">
                  <select
                    value={draft.tooth ?? ""}
                    onChange={(e) => setDraft({ ...draft, tooth: e.target.value || undefined, surfaces: undefined })}
                    className={style.input}
                  >
                    <option value="">— select tooth —</option>
                    {ALL_TEETH.map((t) => (
                      <option key={t.universal} value={t.universal}>
                        #{t.universal} {t.name}
                        {t.dentition === "primary" ? " (primary)" : ""}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {needs("surface") && draft.tooth && (
                <Field label="Surfaces">
                  <SurfacePicker toothUniversal={draft.tooth} value={draft.surfaces ?? ""} onChange={(v) => setDraft({ ...draft, surfaces: v })} />
                </Field>
              )}
              {(needs("quadrant") || needs("arch") || needs("oral-cavity-area")) && (
                <Field label={needs("quadrant") ? "Quadrant" : needs("arch") ? "Arch" : "Oral cavity area"}>
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
                </Field>
              )}
              {needs("none") && (
                <div className="col-span-2 flex items-center rounded-lg bg-slate-50 px-2 py-1 text-[10px] text-slate-500 sm:col-span-1">
                  No tooth / area data required for this line.
                </div>
              )}
              <Field label="Predetermination on file?">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={draft.predeterminationOnFile ?? false}
                    onChange={(e) => setDraft({ ...draft, predeterminationOnFile: e.target.checked })}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-[10px] text-slate-600">Yes, have the notice</span>
                </label>
              </Field>
            </div>

            {surfaceCheck && !surfaceCheck.valid && (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">{surfaceCheck.reason}</p>
            )}
            {surfaceCountCheck && !surfaceCountCheck.valid && (
              <p className="mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
                {surfaceCountCheck.reason}
              </p>
            )}
            {dentitionCheck && (
              <p className="mt-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">{dentitionCheck}</p>
            )}

            {riskDenials.length > 0 && (
              <div className="mt-2 rounded-lg border border-sky-100 bg-sky-50 p-2">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-sky-700">
                  <Info className="h-3 w-3" /> What usually goes wrong with this code
                </p>
                <div className="flex flex-wrap gap-1">
                  {riskDenials.map((d) => (
                    <span key={d.id} className="rounded-full bg-white px-1.5 py-0.5 text-[9px] text-sky-700 ring-1 ring-sky-100">
                      {d.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={addLineToClaim}
                className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
              >
                <Plus className="h-3.5 w-3.5" /> Add line to claim
              </button>
              <span className="text-[10px] text-slate-400">
                Hard errors block the line; warnings let it through so you can feel the payer's response.
              </span>
            </div>
            {error && (
              <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* claim lines */}
        <div className={style.card + " p-3"}>
          <div className="mb-2 flex items-center justify-between">
            <p className={style.label}>Claim lines</p>
            <button onClick={submit} className="rounded-lg bg-blue-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-600">
              Submit Claim to Billing →
            </button>
          </div>
          {state.lines.length === 0 && (
            <p className="py-4 text-center text-[11px] text-slate-400">
              No lines yet. This claim is ADA J430D-style — payer, member and service lines come next.
            </p>
          )}
          <div className="space-y-1.5">
            {state.lines.map((line) => {
              const c = line.code ? findCDT(line.code) : undefined;
              return (
                <div
                  key={line.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">
                      {line.code} {c ? `· ${c.shortName}` : ""}
                    </p>
                    <p className="truncate text-[10px] text-slate-500">
                      DOS {line.dateOfService}
                      {line.tooth ? ` · Tooth #${line.tooth}` : ""}
                      {line.surfaces ? ` · ${line.surfaces}` : ""}
                      {line.quadrant ? ` · Area ${line.quadrant}` : ""}
                      {line.priorPlacementDate ? ` · Prior ${line.priorPlacementDate}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-slate-700">{fmtDollar(line.feeUsd)}</span>
                    <button
                      onClick={() => removeLine(line.id)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove line"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── small presentational helpers ───────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function SurfacePicker({
  toothUniversal,
  value,
  onChange,
}: {
  toothUniversal: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const tooth = findTooth(toothUniversal);
  const valid = tooth?.validSurfaces ?? [];
  const selected = value ? value.split("") : [];
  const toggle = (s: string) => {
    const next = selected.includes(s) ? selected.filter((x) => x !== s) : [...selected, s];
    onChange(next.join(""));
  };
  return (
    <div className="flex flex-wrap gap-1 pt-1">
      {valid.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => toggle(s)}
          className={`h-6 w-6 rounded-md text-[10px] font-bold ${
            selected.includes(s) ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
          title={SURFACE_NAMES[s] ?? s}
        >
          {s}
        </button>
      ))}
      {!valid.length && <span className="text-[10px] text-slate-400">No tooth selected</span>}
    </div>
  );
}

const SURFACE_NAMES: Record<string, string> = {
  M: "Mesial",
  O: "Occlusal",
  D: "Distal",
  B: "Buccal",
  L: "Lingual",
  F: "Facial",
  I: "Incisal",
};

function CodeRow({
  code,
  expanded,
  onSelect,
  onToggle,
  selected,
}: {
  code: CDTCode;
  expanded: boolean;
  onSelect: () => void;
  onToggle: () => void;
  selected: boolean;
}) {
  return (
    <div
      className={`mb-1 rounded-lg border p-2 transition-colors ${
        selected ? "border-sky-300 bg-sky-50" : "border-slate-100 bg-white hover:border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <code className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{code.code}</code>
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{code.shortName}</span>
        <span className="shrink-0 text-[9px] text-amber-600">${code.illustrativeFeeUsd}</span>
        <button onClick={onSelect} className="shrink-0 rounded bg-sky-600 px-2 py-0.5 text-[10px] font-medium text-white hover:bg-sky-500">
          {selected ? "Editing" : "Use"}
        </button>
      </div>
      <button onClick={onToggle} className="mt-0.5 text-left text-[9px] text-slate-400 hover:text-sky-600">
        {expanded ? "hide details ▲" : "details ▼"}
      </button>
      {expanded && (
        <p className="mt-1 border-t border-slate-100 pt-1 text-[10px] leading-relaxed text-slate-500">{code.teachingDescription}</p>
      )}
    </div>
  );
}

function fmtDollar(n: number): string {
  return `$${Math.round(n * 100) / 100}`;
}