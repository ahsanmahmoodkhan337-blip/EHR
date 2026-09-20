/**
 * useDictation — browser-native speech-to-text hook
 *
 * Inspiration: the AR Voice stage's spoken-interface pattern (accent practice),
 * adapted for clinical dictation. Uses the browser Web Speech API
 * (`SpeechRecognition` / `webkitSpeechRecognition`) so a scribe can dictate into
 * a note field. It degrades gracefully: when the API is unavailable (Firefox,
 * or a non-secure context), `supported` is false and the caller hides the mic.
 *
 * NOTE: The AR Voice stage currently uses speech *synthesis* (text-to-speech),
 * not speech *recognition* (speech-to-text), so this is a self-contained STT
 * hook rather than a fork of that stage's code. It reports the full final
 * transcript once via `onResult` when recognition ends.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseDictationResult {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

// Minimal structural typing for the (non-standard) Web Speech recognition object.
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

export function useDictation(onResult?: (text: string) => void): UseDictationResult {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

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
    recognition.interimResults = false;
    transcriptRef.current = "";

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          transcriptRef.current += result[0].transcript;
        }
      }
    };
    recognition.onerror = (event) => {
      setError(event?.error ?? "Dictation failed");
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      const text = transcriptRef.current.trim();
      if (text) onResultRef.current?.(text);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setError(null);
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Could not start dictation");
      setListening(false);
    }
  }, [supported]);

  // Stop on unmount.
  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  return { supported, listening, error, start, stop };
}
