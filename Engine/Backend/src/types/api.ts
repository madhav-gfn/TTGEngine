import type { Difficulty, GameSummary } from "../lib/gameSchema.js";

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
