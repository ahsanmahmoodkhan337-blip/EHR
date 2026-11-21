/**
 * Scoring Utility — EHR Simulation Scoring System
 *
 * Tracks per-stage scores and saves to localStorage.
 * Each stage has a max score and specific scoring logic.
 * Scores are stored as a JSON array under `hh_scores_<phone>` — the signed-in
 * student's own key (owner decision 2026-11-20, `specs/scores-per-student.md`).
 * The leaderboard reads that same key, so a student never sees another
 * student's scores on a shared classroom machine.
 *
 * One-time adoption: the old device-wide `hh_scores` array (keyed by a
 * free-text name) is copied into the current student's key the first time they
 * load scores with no phone-keyed value of their own. It is copied, not moved:
 * the old value stays where it is, readable, and the marker `hh_scores_adopted`
 * (suffixed with the phone) makes sure the adoption happens once and never
 * again — including after a reset deletes the student's scores.
 *
 * The phone is used exactly as the student typed it. It is never normalised.
 */

import {
  getScopePhone,
  readLegacyItem,
  readStudentItem,
  writeStudentItem,
} from "../store/studentScope";
import type { RegistrationExpectations } from "../domain/patientCard";

export interface StageScores {
  registration: number;
  eligibility: number;
  scribe: number;
  coder: number;
  priorAuth: number;
  biller: number;
  arVoice: number;
}

export interface ScoreEntry {
  studentName: string;
  totalScore: number;
  stageScores: StageScores;
  stagesCompleted: string[];
  timestamp: string;
}

const SCORES_KEY = "hh_scores";
const STREAK_KEY = "hh_streak";
const CHALLENGES_KEY = "hh_challenges";
/** One-time adoption marker, per phone. Never deleted by a reset. */
const SCORES_ADOPTED_KEY = "hh_scores_adopted";

// ─── Load / Save ────────────────────────────────────────────────────

/**
 * Copy the old device-wide score list into this student's key, once.
 * Returns true only when it actually adopted something.
 *
 * Conditions, all of them required: a student is signed in; their own key does
 * not exist; this phone has never adopted before; and an old unkeyed value
 * exists. The old value is left in place — a second student on the same machine
 * can still adopt it, and nobody's scores are destroyed.
 */
export function adoptLegacyScores(phone: string | null = getScopePhone()): boolean {
  if (!phone) return false;
  if (readStudentItem(SCORES_KEY, phone) !== null) return false;
  if (readStudentItem(SCORES_ADOPTED_KEY, phone) !== null) return false;
  const legacy = readLegacyItem(SCORES_KEY);
  if (legacy === null) return false;
  writeStudentItem(SCORES_KEY, legacy, phone);
  writeStudentItem(SCORES_ADOPTED_KEY, new Date().toISOString(), phone);
  return true;
}

/** This student's scores. Signed out reads nothing at all. */
export function loadScores(phone: string | null = getScopePhone()): ScoreEntry[] {
  if (!phone) return [];
  adoptLegacyScores(phone);
  try {
    const raw = readStudentItem(SCORES_KEY, phone);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ScoreEntry[]) : [];
  } catch {
    return [];
  }
}

/** Write this student's scores. Signed out writes nothing. */
export function saveScores(scores: ScoreEntry[], phone: string | null = getScopePhone()): void {
  if (!phone) return;
  writeStudentItem(SCORES_KEY, JSON.stringify(scores), phone);
}

// ─── Streak and daily challenges (same rule: the student's key) ─────

/** Consecutive error-free actions for this student. Signed out is 0. */
export function loadStreak(phone: string | null = getScopePhone()): number {
  const raw = readStudentItem(STREAK_KEY, phone);
  const value = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(value) ? value : 0;
}

export function saveStreak(streak: number, phone: string | null = getScopePhone()): void {
  writeStudentItem(STREAK_KEY, String(streak), phone);
}

/** Today's completed challenges for this student, `{}` when none or stale. */
export function loadChallengeState(phone: string | null = getScopePhone()): Record<string, boolean> {
  try {
    const raw = readStudentItem(CHALLENGES_KEY, phone);
    if (!raw) return {};
    const data = JSON.parse(raw) as { date?: string; completed?: Record<string, boolean> };
    if (data.date !== new Date().toISOString().split("T")[0]) return {};
    return data.completed ?? {};
  } catch {
    return {};
  }
}

export function saveChallengeState(
  completed: Record<string, boolean>,
  phone: string | null = getScopePhone(),
): void {
  writeStudentItem(
    CHALLENGES_KEY,
    JSON.stringify({ date: new Date().toISOString().split("T")[0], completed }),
    phone,
  );
}

// ─── Get or Create Entry ────────────────────────────────────────────

export function getOrCreateScoreEntry(studentName: string): ScoreEntry {
  const scores = loadScores();
  let entry = scores.find((s) => s.studentName === studentName);
  if (!entry) {
    entry = {
      studentName,
      totalScore: 0,
      stageScores: {
        registration: 0,
        eligibility: 0,
        scribe: 0,
        coder: 0,
        priorAuth: 0,
        biller: 0,
        arVoice: 0,
      },
      stagesCompleted: [],
      timestamp: new Date().toISOString(),
    };
    scores.push(entry);
    saveScores(scores);
  }
  return entry;
}

// ─── Update Stage Score ─────────────────────────────────────────────

export function updateStageScore(
  studentName: string,
  stage: keyof StageScores,
  score: number
): ScoreEntry {
  const scores = loadScores();
  let entry = scores.find((s) => s.studentName === studentName);
  if (!entry) {
    entry = {
      studentName,
      totalScore: 0,
      stageScores: {
        registration: 0,
        eligibility: 0,
        scribe: 0,
        coder: 0,
        priorAuth: 0,
        biller: 0,
        arVoice: 0,
      },
      stagesCompleted: [],
      timestamp: new Date().toISOString(),
    };
    scores.push(entry);
  }

  entry.stageScores[stage] = score;
  entry.totalScore = Object.values(entry.stageScores).reduce((a, b) => a + b, 0);

  if (!entry.stagesCompleted.includes(stage)) {
    entry.stagesCompleted.push(stage);
  }

  entry.timestamp = new Date().toISOString();
  saveScores(scores);
  return entry;
}

// ─── Scoring Logic Helpers ──────────────────────────────────────────

/**
 * Registration, scored against the selected patient's own card.
 *
 * The expected values come from `domain/patientCard.ts` — the patient's own
 * demographics and coverage record — never from a hardcoded set. Until
 * 2026-11-21 this compared every patient against XYZ987654321 / GRP-4477 /
 * NWIND01 and penalised the literal "jonathon", so a correct transcription of
 * any other patient scored nothing.
 *
 * A field the chart has no value for is not scored against a phantom: the student
 * is credited for filling it in, as before. A field the chart does hold must
 * match it. Copying the insurance card's deliberate misspelling of the member
 * name still costs the mismatch penalty — the government ID, and so the chart,
 * carries the correct spelling.
 */
export function scoreRegistration(
  entry: {
    firstName: string;
    lastName: string;
    dob: string;
    subscriberId: string;
    groupNumber: string;
    payerId: string;
  },
  expected: RegistrationExpectations,
): number {
  let score = 0;

  const same = (typed: string, onChart: string) =>
    typed.trim().toLowerCase() === onChart.trim().toLowerCase();

  // Identity — the government ID's spelling wins.
  if (expected.firstName ? same(entry.firstName, expected.firstName) : entry.firstName.trim()) score += 2;
  if (expected.lastName ? same(entry.lastName, expected.lastName) : entry.lastName.trim()) score += 2;
  if (entry.dob.trim() && /^\d{2}\/\d{2}\/\d{4}$/.test(entry.dob.trim())) {
    if (expected.dateOfBirth ? entry.dob.trim() === expected.dateOfBirth : true) score += 2;
  }

  // Coverage — the card is the only document that carries it.
  if (expected.memberId ? same(entry.subscriberId, expected.memberId) : entry.subscriberId.trim()) score += 2;
  if (expected.groupNumber ? same(entry.groupNumber, expected.groupNumber) : entry.groupNumber.trim()) score += 1;
  if (expected.payerId ? same(entry.payerId, expected.payerId) : entry.payerId.trim()) score += 1;

  // The trap: the member name was copied from the card instead of the ID.
  const typedName = `${entry.firstName} ${entry.lastName}`.trim().toLowerCase();
  if (expected.cardMemberName && typedName === expected.cardMemberName.trim().toLowerCase()) {
    score -= 5;
  }

  return Math.max(0, Math.min(10, score));
}

export function scoreCoder(
  selectedICDs: string[],
  selectedCPTs: string[],
  modifier25Applied: boolean
): number {
  let score = 0;

  // Points for selecting codes
  if (selectedICDs.length >= 1) score += 8;
  if (selectedICDs.length >= 2) score += 2;
  if (selectedCPTs.length >= 1) score += 8;
  if (selectedCPTs.length >= 2) score += 2;

  // Modifier 25 accuracy bonus
  if (modifier25Applied) score += 5;

  return Math.max(0, Math.min(25, score));
}

export function scoreBiller(
  claimSubmitted: boolean,
  denialHandled: boolean,
  appealGenerated: boolean
): number {
  let score = 0;

  if (claimSubmitted) score += 5;
  if (denialHandled) score += 5;
  if (appealGenerated) score += 5;

  return Math.max(0, Math.min(15, score));
}

export function scoreARVoice( pipelineCompleted: boolean): number {
  return pipelineCompleted ? 5 : 0;
}

export function scorePriorAuth(formCompleted: boolean): number {
  return formCompleted ? 10 : 0;
}

export function scoreScribe(soapComplete: boolean): number {
  return soapComplete ? 25 : 0;
}

export function scoreEligibility(formCompleted: boolean): number {
  return formCompleted ? 10 : 0;
}

// ─── Leaderboard Data ───────────────────────────────────────────────

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  stagesCompleted: number;
  timestamp: string;
}

export function getLeaderboard(): LeaderboardRow[] {
  const scores = loadScores();
  const sorted = scores
    .filter((s) => s.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20)
    .map((entry, index) => ({
      rank: index + 1,
      name: entry.studentName,
      score: entry.totalScore,
      stagesCompleted: entry.stagesCompleted.length,
      timestamp: entry.timestamp,
    }));

  return sorted;
}

export function getStudentName(): string {
  return localStorage.getItem("hh_student_name") || "Student";
}
// ─── Speech transcript scoring (AR Voice accent practice) ────────────

export interface SpeechScoreResult {
  /** 0-100 word-overlap accuracy of the spoken transcript vs the expected script. */
  accuracy: number;
  /** Expected words the speaker did not say (deduped, expected order). */
  missed: string[];
  /** Words the speaker said that are not in the expected script (deduped, spoken order). */
  extra: string[];
}

/**
 * Score a spoken transcript against an expected script using simple,
 * frequency-aware word overlap. Bracket placeholders ([Name], [ClaimID], ...)
 * are stripped first so students aren't penalised for substituting realistic
 * values. Punctuation and case are normalised; everything else is a
 * deliberate, teachable word-overlap comparison (not a phonetic one).
 */
export function scoreSpeechTranscript(
  transcript: string,
  expected: string
): SpeechScoreResult {
  const expectedWords = tokenizeSpeech(expected);
  const spokenWords = tokenizeSpeech(transcript);

  if (expectedWords.length === 0) {
    return {
      accuracy: spokenWords.length === 0 ? 100 : 0,
      missed: [],
      extra: dedupe(spokenWords),
    };
  }

  const spokenAvailable = countWords(spokenWords);

  let matched = 0;
  const missed: string[] = [];
  for (const word of expectedWords) {
    const remaining = spokenAvailable.get(word) ?? 0;
    if (remaining > 0) {
      matched += 1;
      spokenAvailable.set(word, remaining - 1);
    } else {
      missed.push(word);
    }
  }

  const extra: string[] = [];
  for (const [word, count] of spokenAvailable) {
    for (let i = 0; i < count; i++) extra.push(word);
  }

  const accuracy = Math.round((matched / expectedWords.length) * 100);
  return {
    accuracy: Math.max(0, Math.min(100, accuracy)),
    missed: dedupe(missed),
    extra: dedupe(extra),
  };
}

function tokenizeSpeech(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^a-z0-9$]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function countWords(words: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of words) map.set(w, (map.get(w) ?? 0) + 1);
  return map;
}

function dedupe(words: string[]): string[] {
  return Array.from(new Set(words));
}
