/**
 * PerioChart.tsx — Per-tooth periodontal charting grid
 *
 * Inspired by: the periodontal chart in practice-management systems (Dentrix,
 * Eaglesoft, Open Dental) — the provider records six probing depths plus
 * mobility, furcation, bleeding and recession per tooth. This feeds the
 * clinical documentation that supports scaling-and-root-planing (D4341/D4342)
 * and periodontal-maintenance coding.
 *
 * Readings persist through the existing per-phone dental store
 * (`DentalTrackStore.tsx`, `state.perio`) and reset when a new case begins.
 */

import { useMemo, useState } from "react";
import { PERMANENT_TEETH, PRIMARY_TEETH, type ToothRef } from "../../data/dental";
import { useDentalTrack, type PerioSite, type PerioToothEntry } from "./DentalTrackStore";

const SITES: { key: PerioSite; label: string; title: string }[] = [
  { key: "mb", label: "MB", title: "Mesiobuccal" },
  { key: "b", label: "B", title: "Buccal / facial" },
  { key: "db", label: "DB", title: "Distobuccal" },
  { key: "ml", label: "ML", title: "Mesiolingual" },
  { key: "l", label: "L", title: "Lingual / palatal" },
  { key: "dl", label: "DL", title: "Distolingual" },
];

const EMPTY_ENTRY: PerioToothEntry = {
  probing: {},
  mobility: null,
  furcation: null,
  bleeding: false,
  recession: null,
};

const cell = "w-9 rounded border border-slate-200 px-0.5 py-1 text-center text-[10px] text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export function PerioChart() {
  const { state, setPerioTooth, activeCase } = useDentalTrack();
  const [dentition, setDentition] = useState<"permanent" | "primary">("permanent");

  const teeth = useMemo(() => (dentition === "permanent" ? PERMANENT_TEETH : PRIMARY_TEETH), [dentition]);

  const entryFor = (t: ToothRef): PerioToothEntry => state.perio[t.universal] ?? EMPTY_ENTRY;

  const setProbing = (t: ToothRef, site: PerioSite, value: number | null) => {
    const e = entryFor(t);
    setPerioTooth(t.universal, { probing: { ...e.probing, [site]: value } });
  };

  const numValue = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── header ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Periodontal Chart</h3>
          <p className="text-[10px] text-slate-400">
            {activeCase ? `Case: ${activeCase.title} · ` : ""}
            Probing depths (mm) per site, plus mobility, furcation, bleeding and recession. Readings are saved per phone.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(["permanent", "primary"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDentition(d)}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                dentition === d ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d === "permanent" ? "Permanent" : "Primary"}
            </button>
          ))}
        </div>
      </div>

      {/* ── grid ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className="sticky left-0 z-20 bg-slate-50 px-2 py-1.5 text-left font-semibold text-slate-500">
                Tooth
              </th>
              {SITES.map((s) => (
                <th key={s.key} title={s.title} className="px-1 py-1.5 text-center font-semibold text-slate-500">
                  {s.label}
                </th>
              ))}
              <th title="Mobility 0–3" className="px-1 py-1.5 text-center font-semibold text-slate-500">
                Mob
              </th>
              <th title="Furcation 0–3 (multi-rooted teeth only)" className="px-1 py-1.5 text-center font-semibold text-slate-500">
                Furc
              </th>
              <th title="Bleeding on probing" className="px-1 py-1.5 text-center font-semibold text-slate-500">
                BOP
              </th>
              <th title="Gingival recession (mm)" className="px-1 py-1.5 text-center font-semibold text-slate-500">
                Recess
              </th>
            </tr>
          </thead>
          <tbody>
            {teeth.map((t) => {
              const e = entryFor(t);
              const furcationCapable = t.typicalRoots > 1;
              return (
                <tr key={t.universal} className="border-t border-slate-100 odd:bg-white even:bg-slate-50/50">
                  <td
                    className="sticky left-0 z-10 whitespace-nowrap bg-inherit px-2 py-0.5 font-bold text-slate-700"
                    title={`${t.name} (FDI ${t.fdi})`}
                  >
                    #{t.universal}
                  </td>
                  {SITES.map((s) => (
                    <td key={s.key} className="px-0.5 py-0.5 text-center">
                      <input
                        type="number"
                        min={0}
                        max={20}
                        step={1}
                        value={numValue(e.probing[s.key])}
                        placeholder="—"
                        onChange={(ev) =>
                          setProbing(t, s.key, Number.isNaN(ev.target.valueAsNumber) ? null : ev.target.valueAsNumber)
                        }
                        className={cell}
                        aria-label={`${t.universal} ${s.title} probing depth`}
                      />
                    </td>
                  ))}
                  <td className="px-0.5 py-0.5 text-center">
                    <select
                      value={numValue(e.mobility)}
                      onChange={(ev) =>
                        setPerioTooth(t.universal, { mobility: ev.target.value === "" ? null : Number(ev.target.value) })
                      }
                      className={cell}
                      aria-label={`${t.universal} mobility`}
                    >
                      <option value="">—</option>
                      <option value="0">0</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </td>
                  <td className="px-0.5 py-0.5 text-center">
                    {furcationCapable ? (
                      <select
                        value={numValue(e.furcation)}
                        onChange={(ev) =>
                          setPerioTooth(t.universal, { furcation: ev.target.value === "" ? null : Number(ev.target.value) })
                        }
                        className={cell}
                        aria-label={`${t.universal} furcation`}
                      >
                        <option value="">—</option>
                        <option value="0">0</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    ) : (
                      <span className="text-slate-300">·</span>
                    )}
                  </td>
                  <td className="px-0.5 py-0.5 text-center">
                    <input
                      type="checkbox"
                      checked={e.bleeding}
                      onChange={(ev) => setPerioTooth(t.universal, { bleeding: ev.target.checked })}
                      className="h-3.5 w-3.5 accent-blue-600"
                      aria-label={`${t.universal} bleeding on probing`}
                    />
                  </td>
                  <td className="px-0.5 py-0.5 text-center">
                    <input
                      type="number"
                      min={-5}
                      max={15}
                      step={1}
                      value={numValue(e.recession)}
                      placeholder="—"
                      onChange={(ev) =>
                        setPerioTooth(t.universal, {
                          recession: Number.isNaN(ev.target.valueAsNumber) ? null : ev.target.valueAsNumber,
                        })
                      }
                      className={cell}
                      aria-label={`${t.universal} recession (mm)`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── footer legend ────────────────────────────────────────────────── */}
      <div className="border-t border-slate-200 p-2 text-[9px] leading-relaxed text-slate-400">
        <span className="font-semibold text-slate-500">Legend:</span> MB mesiobuccal · B buccal/facial · DB distobuccal · ML
        mesiolingual · L lingual · DL distolingual · Mob mobility (0–3) · Furc furcation (0–3, multi-rooted teeth) · BOP bleeding
        on probing · Recess recession (mm). A 4 mm+ pocket with BOP is the classic documentation that supports scaling &amp; root
        planing.
      </div>
    </div>
  );
}
