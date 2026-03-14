import { ApiError, getJson, postJson } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import type {
  LeaderboardEntry,
  LeaderboardQuery,
  LeaderboardResponse,
  ScoreSubmission,
  SubmissionResult,
  UserRank,
} from "./types";

export class LeaderboardConnector {
  async submitScore(submission: ScoreSubmission): Promise<SubmissionResult> {
    try {
      const response = await postJson<SubmissionResult>("/api/score", submission);
      this.flushQueue().catch(() => undefined);
      return response;
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        const payload = error.data as {
          error?: { code?: string; message?: string; details?: Record<string, unknown> };
        } | undefined;

        return {
          success: false,
          pendingSync: false,
          error: {
            code: payload?.error?.code ?? "SUBMISSION_REJECTED",
            message: payload?.error?.message ?? error.message,
            details: payload?.error?.details,
          },
        };
      }

      const queue = this.getQueue();
      queue.push(submission);
      localStorage.setItem(STORAGE_KEYS.pendingScores, JSON.stringify(queue));
      return {
        success: false,
        pendingSync: true,
        error: {
          code: "PENDING_SYNC",
          message: error instanceof Error ? error.message : "Score queued for retry.",
        },
      };
    }
  }

  async flushQueue(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) {
      return;
    }

    const remaining: ScoreSubmission[] = [];

    for (const submission of queue) {
      try {
        await postJson("/api/score", submission);
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          continue;
        }
        remaining.push(submission);
      }
    }

    localStorage.setItem(STORAGE_KEYS.pendingScores, JSON.stringify(remaining));
  }

  async getLeaderboard(
    gameId: string,
    options: LeaderboardQuery = {},
  ): Promise<LeaderboardEntry[]> {
    const searchParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await getJson<{ success: boolean; data: LeaderboardResponse }>(
      `/api/leaderboard/${gameId}?${searchParams.toString()}`,
    );
    return response.data.leaderboard;
  }

  async getUserRank(gameId: string, userId: string): Promise<UserRank> {
    const leaderboard = await this.getLeaderboard(gameId, { limit: 100, offset: 0, period: "all" });
    const entry = leaderboard.find((row) => row.userId === userId);
    return {
      rank: entry?.rank ?? null,
      totalPlayers: leaderboard.length,
    };
  }

  private getQueue(): ScoreSubmission[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.pendingScores);
      return raw ? (JSON.parse(raw) as ScoreSubmission[]) : [];
    } catch {
      return [];
    }
  }
}

export const leaderboardConnector = new LeaderboardConnector();
