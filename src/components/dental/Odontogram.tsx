/**
 * Odontogram.tsx — Interactive visual tooth chart (permanent + primary)
 *
 * Inspired by: the odontogram in dental practice-management systems (Dentrix,
 * Open Dental, Eaglesoft) where the provider charts treatment by clicking a
 * tooth and then the surfaces involved. This is the visual companion to the
 * claim line's tooth/surface/quadrant fields — a click here populates the
 * coding queue's `draft` state.
 *
 * Reuses `src/data/dental/toothNotation.ts` exclusively for tooth numbering
 * (PERMANENT_TEETH, PRIMARY_TEETH, QUADRANTS, TOOTH_SURFACES, findTooth) — no
 * new numbering scheme is invented. Layout follows the standard clockwise
 * Universal path: upper row 1→16 (patient's right on the viewer's left), lower
 * row 32→17 reversed so the chart reads like looking into the mouth.
 */

import { useEffect, useState } from "react";
import {
  NOTATION_TEACHING_POINTS,
  PERMANENT_TEETH,
  PRIMARY_TEETH,
  QUADRANTS,
  TOOTH_SURFACES,
  findTooth,
  type SurfaceCode,
  type ToothRef,
} from "../../data/dental";

export type OdontogramDentition = "permanent" | "primary";

interface OdontogramProps {
  /** Selected Universal designation (e.g. "30" or "A"). */
  selectedTooth?: string;
  onToothSelect: (universal: string) => void;
  /** Selected surface codes as a concatenated string, e.g. "MOD". */
  selectedSurfaces?: string;
  onSurfaceToggle: (surface: string) => void;
  /** Selected area-of-oral-cavity ("01".."04"). */
  selectedQuadrant?: string;
  onQuadrantSelect: (area: string) => void;
}

/** Quadrant tint for visual grouping on the chart. */
const QUADRANT_TINT: Record<string, string> = {
  "01": "text-blue-700",
  "02": "text-violet-700",
  "03": "text-amber-700",
  "04": "text-emerald-700",
};

export function Odontogram({
  selectedTooth,
  onToothSelect,
  selectedSurfaces,
  onSurfaceToggle,
  selectedQuadrant,
  onQuadrantSelect,
}: OdontogramProps) {
  const [dentition, setDentition] = useState<OdontogramDentition>("permanent");

  // When the coding queue selects a tooth, snap the chart to that tooth's
  // dentition so the selected tooth is always visible.
  useEffect(() => {
    if (selectedTooth) {
      const t = findTooth(selectedTooth);
      if (t) setDentition(t.dentition);
    }
  }, [selectedTooth]);

  const teeth = dentition === "permanent" ? PERMANENT_TEETH : PRIMARY_TEETH;
  const upper = teeth.slice(0, teeth.length / 2);
  const lower = teeth.slice(teeth.length / 2).reverse();

  const selected = selectedTooth ? findTooth(selectedTooth) : undefined;
  const selectedSurfacesSet = (selectedSurfaces ?? "").split("").filter(Boolean);
  const validSurfaces = selected?.validSurfaces ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* ── header: dentition + quadrant ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Dentition</span>
          {(["permanent", "primary"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDentition(d)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                dentition === d ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d === "permanent" ? "Permanent (1–32)" : "Primary (A–T)"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Quadrant</span>
          {QUADRANTS.map((q) => (
            <button
              key={q.areaOfOralCavity}
              type="button"
              onClick={() => onQuadrantSelect(q.areaOfOralCavity)}
              title={q.name}
              className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${
                selectedQuadrant === q.areaOfOralCavity
                  ? "bg-blue-700 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {q.areaOfOralCavity} · {q.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── tooth chart ──────────────────────────────────────────────────── */}
      <div className="mt-2 space-y-1">
        <ToothRow label="Maxillary" teeth={upper} selectedTooth={selectedTooth} selectedQuadrant={selectedQuadrant} onToothSelect={onToothSelect} />
        <ToothRow label="Mandibular" teeth={lower} selectedTooth={selectedTooth} selectedQuadrant={selectedQuadrant} onToothSelect={onToothSelect} />
      </div>

      {/* ── selected tooth detail ────────────────────────────────────────── */}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
        {selected ? (
          <>
            <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              #{selected.universal}
            </span>
            <span className="text-[11px] font-medium text-slate-700">{selected.name}</span>
            <span className="text-[10px] text-slate-400">
              FDI {selected.fdi} · Palmer {selected.palmer} · {selected.type} · {selected.dentition}
            </span>
          </>
        ) : (
          <span className="text-[10px] text-slate-400">Click a tooth to select it, then choose surfaces below.</span>
        )}
      </div>

      {/* ── surface picker ───────────────────────────────────────────────── */}
      {selected && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Surfaces</span>
          {validSurfaces.map((code: SurfaceCode) => {
            const active = selectedSurfacesSet.includes(code);
            const surfaceInfo = TOOTH_SURFACES.find((s) => s.code === code);
            return (
              <button
                key={code}
                type="button"
                onClick={() => onSurfaceToggle(code)}
                title={`${surfaceInfo?.name ?? code} — ${surfaceInfo?.teachingNote ?? ""}`}
                className={`h-7 w-7 rounded-md text-[10px] font-bold ${
                  active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {code}
              </button>
            );
          })}
          {validSurfaces.length === 0 && <span className="text-[10px] text-slate-400">No surfaces charted for this tooth.</span>}
        </div>
      )}

      {/* ── notation teaching points ─────────────────────────────────────── */}
      <details className="mt-2 border-t border-slate-100 pt-1.5">
        <summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-wide text-slate-400 hover:text-blue-600">
          Notation reminders
        </summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[9px] leading-relaxed text-slate-500">
          {NOTATION_TEACHING_POINTS.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function ToothRow({
  label,
  teeth,
  selectedTooth,
  selectedQuadrant,
  onToothSelect,
}: {
  label: string;
  teeth: ToothRef[];
  selectedTooth?: string;
  selectedQuadrant?: string;
  onToothSelect: (universal: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-16 shrink-0 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-0.5">
        {teeth.map((t) => {
          const isSelected = selectedTooth === t.universal;
          const inQuadrant = selectedQuadrant === t.quadrantArea;
          const width = t.type === "molar" ? "w-7" : t.type === "premolar" ? "w-6" : "w-5";
          return (
            <button
              key={t.universal}
              type="button"
              onClick={() => onToothSelect(t.universal)}
              title={`#${t.universal} ${t.name} (FDI ${t.fdi} · Palmer ${t.palmer})`}
              className={`flex h-10 items-center justify-center rounded-md border text-[10px] font-bold transition-colors ${width} ${
                isSelected
                  ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                  : inQuadrant
                    ? `border-slate-300 bg-slate-50 ${QUADRANT_TINT[t.quadrantArea] ?? "text-slate-600"} hover:border-blue-400`
                    : "border-slate-200 bg-white text-slate-400 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {t.universal}
            </button>
          );
        })}
      </div>
    </div>
  );
}
