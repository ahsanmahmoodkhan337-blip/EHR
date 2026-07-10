/**
 * HIPAA Compliance Quiz — 10 Multiple Choice Questions
 *
 * Tests knowledge of HIPAA Privacy Rule, Security Rule,
 * Breach Notification, Patient Rights, and Minimum Necessary.
 * 90%+ passes and awards "HIPAA Certified" badge.
 *
 * Inspiration: AAPC HIPAA certification exam
 */

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  CheckCircle2,
  XCircle,
  Award,
  RotateCcw,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  Sparkles,
} from "lucide-react";

// ─── Questions ────────────────────────────────────────────────────

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
}

const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: "Under HIPAA, what is the 'Minimum Necessary' standard?",
    options: [
      "Share only the minimum amount of PHI needed for the task",
      "Share all PHI to ensure complete care",
      "Never share PHI under any circumstances",
      "Share minimum of 3 identifiers",
    ],
    correctIndex: 0,
    explanation: "The Minimum Necessary standard requires covered entities to limit uses and disclosures of PHI to the minimum needed to accomplish the intended purpose.",
    topic: "Privacy Rule",
  },
  {
    id: 2,
    question: "What is the maximum fine for a HIPAA violation (Tier 4)?",
    options: [
      "$10,000 per violation",
      "$50,000 per violation",
      "$100,000 per violation",
      "$1.5 million per violation category per year",
    ],
    correctIndex: 3,
    explanation: "Tier 4 violations (willful neglect, not corrected) can result in fines up to $1.5 million per violation category per calendar year.",
    topic: "Enforcement",
  },
  {
    id: 3,
    question: "Which of the following is NOT considered PHI?",
    options: [
      "Patient's name and diagnosis",
      "Patient's medical record number",
      "De-identified data with no identifiers",
      "Patient's insurance ID number",
    ],
    correctIndex: 2,
    explanation: "De-identified data that has all 18 HIPAA identifiers removed is no longer considered PHI and is not subject to HIPAA restrictions.",
    topic: "Privacy Rule",
  },
  {
    id: 4,
    question: "How long must covered entities retain HIPAA documentation?",
    options: [
      "3 years",
      "6 years",
      "10 years",
      "Indefinitely",
    ],
    correctIndex: 1,
    explanation: "HIPAA requires covered entities to retain documentation for 6 years from the date of creation or last effective date, whichever is later.",
    topic: "Administrative",
  },
  {
    id: 5,
    question: "What is a breach under HIPAA?",
    options: [
      "Any unauthorized access to PHI",
      "Only intentional data theft",
      "An impermissible use or disclosure of PHI that compromises its security or privacy",
      "Only when data is sold to third parties",
    ],
    correctIndex: 2,
    explanation: "A breach is any impermissible use or disclosure of PHI that compromises the security or privacy of the information, with some exceptions for low-risk scenarios.",
    topic: "Breach Notification",
  },
  {
    id: 6,
    question: "What must a covered entity provide to a patient who requests access to their PHI?",
    options: [
      "A summary of their PHI within 60 days",
      "The full medical record within 30 days",
      "Access to their PHI in the requested format within 30 days (with one 30-day extension)",
      "Only the billing information",
    ],
    correctIndex: 2,
    explanation: "Patients have the right to access their PHI in the format they request (paper or electronic) within 30 days, with a possible one-time 30-day extension.",
    topic: "Patient Rights",
  },
  {
    id: 7,
    question: "Which of the following is a HIPAA Security Rule addressable implementation specification?",
    options: [
      "Encryption of all ePHI",
      "Automatic logoff",
      "Unique user identification",
      "Emergency access procedures",
    ],
    correctIndex: 0,
    explanation: "Encryption is an 'addressable' specification under the Security Rule, meaning covered entities must assess whether it's reasonable and appropriate to implement.",
    topic: "Security Rule",
  },
  {
    id: 8,
    question: "When must a breach of unsecured PHI be reported to affected individuals?",
    options: [
      "Within 30 days",
      "Within 60 days",
      "Without unreasonable delay and no later than 60 days",
      "Within 90 days",
    ],
    correctIndex: 2,
    explanation: "Covered entities must notify affected individuals without unreasonable delay and no later than 60 days after discovery of the breach.",
    topic: "Breach Notification",
  },
  {
    id: 9,
    question: "What is the 'HIPAA Privacy Rule' primarily concerned with?",
    options: [
      "Physical security of buildings",
      "Protecting the privacy of individually identifiable health information",
      "Technical security of electronic systems",
      "Billing and coding compliance",
    ],
    correctIndex: 1,
    explanation: "The Privacy Rule establishes national standards for protecting individuals' medical records and other personal health information.",
    topic: "Privacy Rule",
  },
  {
    id: 10,
    question: "Can a patient request an amendment to their medical record under HIPAA?",
    options: [
      "No, patients cannot amend records",
      "Yes, and the provider must amend it regardless of accuracy",
      "Yes, but the provider can deny if they believe the record is accurate and complete",
      "Only for billing information",
    ],
    correctIndex: 2,
    explanation: "Patients have the right to request amendments. Providers can deny if they believe the record is accurate and complete, but must inform the patient and allow a statement of disagreement.",
    topic: "Patient Rights",
  },
];

// ─── Route ────────────────────────────────────────────────────────

export const Route = createFileRoute("/quiz")({
  component: QuizPage,
});

// ─── Component ────────────────────────────────────────────────────

function QuizPage() {
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<{ questionId: number; correct: boolean }[]>([]);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);

  const question = QUESTIONS[currentQ];
  const score = results.filter(r => r.correct).length;
  const passed = score >= 9; // 90%+

  const handleAnswer = (idx: number) => {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
  };

  const handleNext = () => {
    if (selectedAnswer === null) return;
    const correct = selectedAnswer === question.correctIndex;
    setResults([...results, { questionId: question.id, correct }]);

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentQ(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setResults([]);
    setFinished(false);
    setStarted(false);
  };

  // Start screen
  if (!started) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-lg text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
            <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">HIPAA Compliance Quiz</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Test your knowledge of HIPAA Privacy Rule, Security Rule, Breach Notification, and Patient Rights.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400">
            <BookOpen className="h-3 w-3" />
            <span>{QUESTIONS.length} questions</span>
            <span>·</span>
            <Award className="h-3 w-3" />
            <span>90%+ to pass</span>
          </div>
          <button
            onClick={() => setStarted(true)}
            className="mt-6 w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-colors"
          >
            Start Quiz
          </button>
          <Link to="/" className="mt-3 block text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Back to app</Link>
        </div>
      </div>
    );
  }

  // Results screen
  if (finished) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950 p-4">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-lg text-center">
          {passed ? (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <Award className="h-8 w-8 text-amber-500" />
            </div>
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          )}
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200">
            {passed ? "HIPAA Certified!" : "Keep Studying"}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            You scored <span className="font-bold text-slate-700 dark:text-slate-300">{score}/{QUESTIONS.length}</span> ({Math.round((score / QUESTIONS.length) * 100)}%)
          </p>
          {passed && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-xs font-bold text-amber-700 dark:text-amber-300">HIPAA Certified Badge Earned!</span>
            </div>
          )}
          {/* Score breakdown */}
          <div className="mt-6 space-y-2 text-left">
            {QUESTIONS.map((q, i) => {
              const res = results[i];
              return (
                <div key={q.id} className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                  res?.correct ? "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800" : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
                }`}>
                  {res?.correct ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">{q.question}</p>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{q.explanation}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <button
            onClick={handleRestart}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Retake Quiz
          </button>
          <Link to="/" className="mt-3 block text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">Back to app</Link>
        </div>
      </div>
    );
  }

  // Quiz question screen
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-indigo-950 p-4">
      <div className="w-full max-w-2xl">
        {/* Progress bar */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${((currentQ + 1) / QUESTIONS.length) * 100}%` }} />
          </div>
          <span className="text-[10px] font-medium text-slate-400">{currentQ + 1}/{QUESTIONS.length}</span>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-lg">
          {/* Topic tag */}
          <span className="inline-block rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 mb-3">
            {question.topic}
          </span>

          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">
            {question.question}
          </h2>

          <div className="space-y-2">
            {question.options.map((opt, idx) => {
              let bg = "border-slate-200 dark:border-slate-600 hover:border-indigo-300 dark:hover:border-indigo-500";
              if (answered) {
                if (idx === question.correctIndex) {
                  bg = "border-green-400 bg-green-50 dark:bg-green-900/20 dark:border-green-600";
                } else if (idx === selectedAnswer && idx !== question.correctIndex) {
                  bg = "border-red-400 bg-red-50 dark:bg-red-900/20 dark:border-red-600";
                }
              } else if (selectedAnswer === idx) {
                bg = "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20";
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={answered}
                  className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left text-xs font-medium transition-all ${bg} ${
                    answered ? "cursor-default" : "cursor-pointer"
                  } text-slate-700 dark:text-slate-300`}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    answered && idx === question.correctIndex
                      ? "bg-green-500 text-white"
                      : answered && idx === selectedAnswer && idx !== question.correctIndex
                        ? "bg-red-500 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {answered && idx === question.correctIndex && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
                  {answered && idx === selectedAnswer && idx !== question.correctIndex && <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {answered && (
            <div className="mt-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50 dark:bg-indigo-900/10 p-3 animate-slide-in">
              <p className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Explanation
              </p>
              <p className="mt-1 text-[10px] text-indigo-600 dark:text-indigo-400">{question.explanation}</p>
            </div>
          )}

          {/* Next button */}
          {answered && (
            <button
              onClick={handleNext}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors animate-slide-in"
            >
              {currentQ < QUESTIONS.length - 1 ? "Next Question" : "See Results"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}