/**
 * Scoring Utility — EHR Simulation Scoring System
 *
 * Tracks per-stage scores and saves to localStorage.
 * Each stage has a max score and specific scoring logic.
 * Scores are stored in localStorage key "hh_scores" as JSON array.
 * Leaderboard reads from the same data.
 */

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

const STORAGE_KEY = "hh_scores";

// ─── Load / Save ────────────────────────────────────────────────────

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveScores(scores: ScoreEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
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

export function scoreRegistration(
  firstName: string,
  lastName: string,
  dob: string,
  subscriberId: string,
  groupNumber: string,
  payerId: string
): number {
  let score = 0;

  // Check if fields are filled
  if (firstName.trim()) score += 2;
  if (lastName.trim()) score += 2;
  if (dob.trim() && /^\d{2}\/\d{2}\/\d{4}$/.test(dob.trim())) score += 2;
  if (subscriberId.trim() === "XYZ987654321") score += 2;
  if (groupNumber.trim() === "GRP-4477") score += 1;
  if (payerId.trim() === "ANTHEM01") score += 1;

  // Penalty: name mismatch trap — if student blindly copied "Jonathon" from insurance card
  if (firstName.toLowerCase() === "jonathon") {
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