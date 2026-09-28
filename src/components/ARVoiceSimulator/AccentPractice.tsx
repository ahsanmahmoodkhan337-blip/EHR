/**
 * AccentPractice — spoken accent-practice widget (AR Voice Specialist, Stage 5)
 *
 * Inspiration: Epic Resolute AR workbench "talk-track" rehearsal plus a
 * browser-native speech-recognition loop. This is the Level-1 upgrade that
 * turns the previously TTS-only "Accent Practice" panels into a real
 * speak-and-be-scored exercise: the student is transcribed via the Web Speech
 * API (`SpeechRecognition` / `webkitSpeechRecognition`) and scored against the
 * expected script.
 *
 * Speech synthesis (`window.speechSynthesis`) is intentionally NOT handled
 * here — the parent keeps the existing "Hear sample / Play Audio" buttons as
 * the reference audio. This component is speech-to-text only, and reuses the
 * same recognition pattern as `src/components/scribe/useDictation.ts`
 * (continuous + interimResults, `en-US`, transcript accumulation), extended to
 * surface a live interim transcript for the read-along exercise.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Mic, Square } from "lucide-react";
import { scoreSpeechTranscript, type SpeechScoreResult } from "../../utils/scoring";

// ─── Minimal structural typing for the (non-standard) Web Speech API ──
// Mirrors the types in src/components/scribe/useDictation.ts.

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface UseSpeechRecognitionResult {
  supported: boolean;
  listening: boolean;
  /** Recognised final segments accumulated so far. */
  final: string;
  /** The in-flight (non-final) partial transcript. */
  interim: string;
  error: string | null;
  start: () => void;
  stop: () => void;
}

function useSpeechRecognition(onFinal?: (text: string) => void): UseSpeechRecognitionResult {
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const supported =
    typeof window !== "undefined" &&
    Boolean(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition,
    );

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    const w = window as unknown as Record<string, unknown>;
    const SR = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
      | (new () => RecognitionLike)
      | undefined;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    finalRef.current = "";
    setFinalText("");
    setInterim("");

    recognition.onresult = (event) => {
      let liveInterim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalRef.current += transcript;
        } else {
          liveInterim += transcript;
        }
      }
      setFinalText(finalRef.current);
      setInterim(liveInterim);
    };

    recognition.onerror = (event) => {
      setError(event?.error ?? "Speech recognition failed");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      setFinalText(text);
      if (text) onFinalRef.current?.(text);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Could not start speech recognition");
      setListening(false);
    }
  }, [supported]);

  // Stop on unmount so the browser mic is always released.
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  return { supported, listening, final: finalText, interim, error, start, stop };
}

interface AccentPracticeProps {
  /** The expected script the student is asked to read aloud. */
  expectedText: string;
}

export function AccentPractice({ expectedText }: AccentPracticeProps) {
  const [score, setScore] = useState<SpeechScoreResult | null>(null);
  const { supported, listening, final, interim, error, start, stop } = useSpeechRecognition((text) => {
    setScore(scoreSpeechTranscript(text, expectedText));
  });

  // A new script / bucket / claim invalidates any previous score.
  useEffect(() => {
    setScore(null);
  }, [expectedText]);

  // Unsupported browser (Firefox, non-secure context) — fall back gracefully
  // to the existing TTS read-along rather than showing a dead mic button.
  if (!supported) {
    return (
      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
        <p className="text-[10px] font-medium text-amber-700">
          <AlertTriangle className="mr-1 inline h-3 w-3" />
          Speech recognition unavailable in this browser
        </p>
        <p className="mt-1 text-[9px] leading-relaxed text-amber-600">
          Open this in <strong>Chrome</strong> or <strong>Edge</strong> to be transcribed and scored on your
          speaking. For now, use the “Hear sample” playback above to read along.
        </p>
      </div>
    );
  }

  const hasTranscript = Boolean(final || interim);

  return (
    <div className="mt-2 rounded-lg border border-green-300 bg-white/80 p-2.5">
      <div className="flex items-center gap-2">
        <button
          onClick={listening ? stop : start}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
            listening
              ? "bg-red-600 text-white hover:bg-red-500"
              : "bg-green-600 text-white hover:bg-green-500"
          }`}
        >
          {listening ? (
            <>
              <Square className="h-3 w-3" /> Stop & Score
            </>
          ) : (
            <>
              <Mic className="h-3 w-3" /> Start Speaking
            </>
          )}
        </button>
        {listening && (
          <span className="text-[9px] font-medium text-green-600 animate-pulse">● Listening — speak now</span>
        )}
      </div>

      {/* Live transcript */}
      {(listening || hasTranscript) && (
        <div className="mt-2 rounded bg-slate-50 p-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Live transcript</p>
          <p className="mt-0.5 min-h-[1.25rem] text-[10px] leading-relaxed text-slate-700">
            {hasTranscript ? (
              <>
                {final}
                {interim && <span className="text-slate-400"> {interim}</span>}
              </>
            ) : (
              <span className="italic text-slate-400">Speak now — your words will appear here…</span>
            )}
          </p>
        </div>
      )}

      {error && <p className="mt-1 text-[9px] text-red-600">{error}</p>}

      {/* Score result */}
      {score && (
        <div className="mt-2 rounded bg-emerald-50 p-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="text-[10px] font-semibold text-emerald-700">Accuracy: {score.accuracy}%</span>
          </div>
          {score.missed.length > 0 && (
            <p className="mt-1 text-[9px] leading-relaxed text-amber-700">
              <strong>Missed words:</strong> {score.missed.slice(0, 14).join(", ")}
              {score.missed.length > 14 ? ` +${score.missed.length - 14} more` : ""}
            </p>
          )}
          {score.extra.length > 0 && (
            <p className="mt-0.5 text-[9px] leading-relaxed text-red-600">
              <strong>Off-script words:</strong> {score.extra.slice(0, 14).join(", ")}
              {score.extra.length > 14 ? ` +${score.extra.length - 14} more` : ""}
            </p>
          )}
          {score.missed.length === 0 && score.extra.length === 0 && (
            <p className="mt-1 text-[9px] font-medium text-emerald-600">
              🎉 Word-for-word — excellent delivery.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
