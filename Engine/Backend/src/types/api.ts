import type { AdaptiveBand, Difficulty, GameSummary, LevelConfig } from "../lib/gameSchema.js";

export interface ScoreSubmission {
  userId: string;
  gameId: string;
  score: number;
  timeTaken: number;
  level: number;
  metadata: Record<string, unknown>;
}

export interface ScoreSubmissionResponseData {
  submissionId: string;
  rank: number;
  totalPlayers: number;
  personalBest: boolean;
  leaderboardEligible: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  timeTaken: number;
  submittedAt: string;
}

export interface LeaderboardPayload {
  gameId: string;
  totalEntries: number;
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardQuery {
  limit?: number;
  offset?: number;
  difficulty?: Difficulty | "all";
  period?: "daily" | "weekly" | "monthly" | "all";
}

export type GenerationSource = "local-template" | "openai-compatible";

export interface GeneratedLevelPayload {
  levelIndex: number;
  level: LevelConfig;
  band: AdaptiveBand;
  source: GenerationSource;
  summary: string;
  generatedAt: string;
  seed: string;
  strategy: string;
}

export interface SkillAnalyticsSession {
  gameId: string;
  skill: string;
  score: number;
  accuracy: number;
  difficulty: Difficulty;
  submittedAt: string;
  timeTaken: number;
  levelCount: number;
  supportMoments: number;
  challengeMoments: number;
  standardMoments: number;
  generatedLevels: number;
}

export interface SkillAnalyticsSkill {
  skill: string;
  sessionsPlayed: number;
  averageScore: number;
  bestScore: number;
  averageAccuracy: number;
  recentAccuracy: number;
  accuracyDelta: number;
  supportMoments: number;
  challengeMoments: number;
  mastery: "emerging" | "growing" | "strong";
  strongestGameId: string | null;
  lastPlayedAt: string | null;
  recommendedFocus: string;
}

export interface SkillAnalyticsPayload {
  userId: string;
  updatedAt: string;
  totalSessions: number;
  trackedSkills: number;
  strongestSkill: string | null;
  focusSkill: string | null;
  skills: SkillAnalyticsSkill[];
  recentSessions: SkillAnalyticsSession[];
}

export interface HealthPayload {
  status: "ok";
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type GameManifestResponse = GameSummary[];
