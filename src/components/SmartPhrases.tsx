/**
 * SmartPhrases / Dot-Code Expansion Engine
 *
 * Dot-code autocomplete system for SOAP note textareas.
 * Typing "." triggers an autocomplete dropdown with expandable
 * templates (e.g., .ros, .vitals, .htn, .physical, .dm, .preop).
 *
 * Exports `useSmartPhrases` hook and `SmartPhrasesDropdown` component.
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ─── Dot-Code Templates ────────────────────────────────────────────

interface DotCode {
  code: string;
  label: string;
  template: (vitals?: { bp: string; hr: string; temp: string; rr: string; o2: string }) => string;
}

export const DOT_CODES: Record<string, DotCode> = {
  ros: {
    code: ".ros",
    label: "Full Review of Systems (14-system)",
    template: () =>
      "Constitutional: no fever. Eyes: no changes. ENT: no sore throat. Cardiovascular: no chest pain. Respiratory: no cough. GI: no abdominal pain. GU: no dysuria. Musculoskeletal: no joint pain. Skin: no rash. Neurological: no headache. Psychiatric: no anxiety. Endocrine: no polydipsia. Hematologic: no bruising. Allergic: no hives.",
  },
  vitals: {
    code: ".vitals",
    label: "Latest Vitals",
    template: (vitals) =>
      `BP ${vitals?.bp || "120/80"}, HR ${vitals?.hr || "72"}, Temp ${vitals?.temp || "98.6"}°F, RR ${vitals?.rr || "16"}, SpO2 ${vitals?.o2 || "98"}%`,
  },
  htn: {
    code: ".htn",
    label: "Hypertension Follow-Up",
    template: () =>
      "Patient here for follow-up of essential hypertension. BP controlled on current regimen. No medication side effects reported. Continuing current therapy. Lifestyle modifications discussed including low-sodium diet and regular exercise.",
  },
  physical: {
    code: ".physical",
    label: "Physical Exam Normal",
    template: () =>
      "General: well-appearing. HEENT: normocephalic. Neck: supple. Lungs: clear. Heart: RRR. Abdomen: soft. Extremities: no edema. Neuro: alert.",
  },
  dm: {
    code: ".dm",
    label: "Diabetes Follow-Up",
    template: () =>
      "Patient here for diabetes follow-up. Blood glucose log reviewed. A1C discussed. Medication adherence good. Foot exam normal. Eye exam up to date. Continuing current diabetes management plan. Dietary counseling provided.",
  },
  preop: {
    code: ".preop",
    label: "Pre-Op Clearance",
    template: () =>
      "Patient evaluated for pre-operative clearance. No acute cardiac or pulmonary symptoms. Vital signs stable. EKG reviewed — no acute ischemic changes. Labs within normal limits. Patient is medically optimized for planned procedure. Perioperative risk discussed.",
  },
  uri: {
    code: ".uri",
    label: "URI - Normal",
    template: () =>
      "Patient presents with URI symptoms. No fever. Lungs clear to auscultation. Ears, nose, throat exam normal. Advised rest, hydration, OTC symptomatic management. Return if symptoms worsen or persist beyond 7 days.",
  },
  normalpe: {
    code: ".normalpe",
    label: "Normal Physical Exam",
    template: () =>
      "Vital Signs: Within normal limits. Physical Exam: No acute distress. Alert and oriented x3. No focal neurological deficits. Gait steady.",
  },
};

// ─── Hook ───────────────────────────────────────────────────────────

interface SmartPhrasesState {
  showDropdown: boolean;
  query: string;
  cursorPos: { top: number; left: number } | null;
}

export function useSmartPhrases(vitals?: { bp: string; hr: string; temp: string; rr: string; o2: string }) {
  const [state, setState] = useState<SmartPhrasesState>({
    showDropdown: false,
    query: "",
    cursorPos: null,
  });

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const expandDotCode = useCallback(
    (text: string): string => {
      return text.replace(/\.(\w+)/g, (match, code) => {
        const dotCode = DOT_CODES[code.toLowerCase()];
        if (dotCode) {
          return dotCode.template(vitals);
        }
        return match;
      });
    },
    [vitals]
  );

  const getSuggestions = useCallback((prefix: string): string[] => {
    if (!prefix.startsWith(".")) return [];
    const query = prefix.slice(1).toLowerCase();
    return Object.values(DOT_CODES)
      .filter((d) => d.code.toLowerCase().includes(query))
      .map((d) => d.code);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab" && state.showDropdown) {
        e.preventDefault();
        const ta = e.currentTarget;
        const { selectionStart } = ta;
        const beforeCursor = ta.value.slice(0, selectionStart);
        const dotMatch = beforeCursor.match(/\.\w*$/);
        if (dotMatch) {
          const prefix = dotMatch[0];
          const suggestions = getSuggestions(prefix);
          if (suggestions.length > 0) {
            const code = suggestions[0];
            const dotCode = DOT_CODES[code.slice(1)];
            if (dotCode) {
              const expanded = dotCode.template(vitals);
              const newText =
                ta.value.slice(0, dotMatch.index!) +
                expanded +
                ta.value.slice(selectionStart);
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLTextAreaElement.prototype,
                "value"
              )?.set;
              nativeInputValueSetter?.call(ta, newText);
              ta.dispatchEvent(new Event("input", { bubbles: true }));
              setState({ showDropdown: false, query: "", cursorPos: null });
              return;
            }
          }
        }
      }
    },
    [state.showDropdown, vitals, getSuggestions]
  );

  const handleInput = useCallback(
    (e: React.FormEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget;
      const { selectionStart } = ta;
      const beforeCursor = ta.value.slice(0, selectionStart);
      const dotMatch = beforeCursor.match(/\.\w*$/);

      if (dotMatch) {
        const rect = ta.getBoundingClientRect();
        // Estimate cursor position
        setState({
          showDropdown: true,
          query: dotMatch[0],
          cursorPos: {
            top: rect.top + 30,
            left: rect.left + 10,
          },
        });
      } else {
        setState({ showDropdown: false, query: "", cursorPos: null });
      }
    },
    []
  );

  const selectSuggestion = useCallback(
    (code: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const { selectionStart } = ta;
      const beforeCursor = ta.value.slice(0, selectionStart);
      const dotMatch = beforeCursor.match(/\.\w*$/);
      if (dotMatch) {
        const dotCode = DOT_CODES[code.slice(1)];
        if (dotCode) {
          const expanded = dotCode.template(vitals);
          const newText =
            ta.value.slice(0, dotMatch.index!) +
            expanded +
            ta.value.slice(selectionStart);
          setState({ showDropdown: false, query: "", cursorPos: null });
          return newText; // caller must set this as value
        }
      }
      return null;
    },
    [vitals]
  );

  const closeDropdown = useCallback(() => {
    setState({ showDropdown: false, query: "", cursorPos: null });
  }, []);

  return {
    state,
    textareaRef,
    expandDotCode,
    getSuggestions,
    handleKeyDown,
    handleInput,
    selectSuggestion,
    closeDropdown,
  };
}

// ─── Dropdown Component ─────────────────────────────────────────────

interface SmartPhrasesDropdownProps {
  query: string;
  position: { top: number; left: number } | null;
  onSelect: (code: string) => string | null;
  onClose: () => void;
}

export function SmartPhrasesDropdown({
  query,
  position,
  onSelect,
  onClose,
}: SmartPhrasesDropdownProps) {
  const suggestions =
    query && query.startsWith(".")
      ? Object.values(DOT_CODES).filter((d) =>
          d.code.toLowerCase().includes(query.slice(1).toLowerCase())
        )
      : [];

  useEffect(() => {
    const handleClick = () => onClose();
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [onClose]);

  if (!position || suggestions.length === 0) return null;

  return (
    <div
      className="fixed z-50 min-w-[220px] rounded-xl border border-slate-200 bg-white shadow-xl max-h-48 overflow-y-auto"
      style={{ top: position.top, left: position.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 border-b border-slate-100">
        <p className="text-[10px] font-semibold text-slate-500">SmartPhrases</p>
      </div>
      {suggestions.map((d) => (
        <button
          key={d.code}
          onClick={() => {
            const result = onSelect(d.code);
            if (result) onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-indigo-50 transition-colors"
        >
          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-indigo-600">
            {d.code}
          </span>
          <span className="text-xs text-slate-600 truncate">{d.label}</span>
        </button>
      ))}
      <div className="border-t border-slate-100 px-3 py-1.5">
        <p className="text-[9px] text-slate-400">
          Press <kbd className="rounded bg-slate-100 px-1">Tab</kbd> to expand
        </p>
      </div>
    </div>
  );
}
