export interface ScoreSubmission {
  userId: string;
  gameId: string;
  score: number;
  timeTaken: number;
  level: number;
  metadata: Record<string, unknown>;
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
