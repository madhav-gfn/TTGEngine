import { ApiError, getJson, postJson } from "@/lib/api";
import { API_ENDPOINTS, STORAGE_KEYS, resolveApiEndpoint } from "@/lib/constants";
import type {
  GameConfig,
  LeaderboardEntry,
  LeaderboardQuery,
  LeaderboardResponse,
  ScoreSubmission,
  SubmissionResult,
  UserRank,
} from "./types";

function buildLeaderboardEndpoint(gameId: string, config?: Pick<GameConfig, "apiConfig">): string {
  return config?.apiConfig?.leaderboardEndpoint
    ? resolveApiEndpoint(config.apiConfig.leaderboardEndpoint)
    : `${API_ENDPOINTS.leaderboard}/${gameId}`;
}

function buildScoreEndpoint(config?: Pick<GameConfig, "apiConfig">): string {
  return config?.apiConfig?.scoreSubmitEndpoint
    ? resolveApiEndpoint(config.apiConfig.scoreSubmitEndpoint)
    : API_ENDPOINTS.score;
}

interface PendingSubmission {
  submission: ScoreSubmission;
  scoreEndpoint: string;
}

export class LeaderboardConnector {
  async submitScore(
    submission: ScoreSubmission,
    config?: Pick<GameConfig, "apiConfig">,
  ): Promise<SubmissionResult> {
    try {
      const response = await postJson<{
        success: boolean;
        data: SubmissionResult["data"];
      }>(buildScoreEndpoint(config), submission);
      this.flushQueue(config).catch(() => undefined);
      return {
        success: true,
        pendingSync: false,
        data: response.data,
      };
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
      queue.push({
        submission,
        scoreEndpoint: buildScoreEndpoint(config),
      });
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

  async flushQueue(config?: Pick<GameConfig, "apiConfig">): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) {
      return;
    }

    const remaining: PendingSubmission[] = [];

    for (const queued of queue) {
      try {
        await postJson(config ? buildScoreEndpoint(config) : queued.scoreEndpoint, queued.submission);
      } catch (error) {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          continue;
        }
        remaining.push(queued);
      }
    }

    localStorage.setItem(STORAGE_KEYS.pendingScores, JSON.stringify(remaining));
  }

  async getLeaderboard(
    gameId: string,
    options: LeaderboardQuery = {},
    config?: Pick<GameConfig, "apiConfig">,
  ): Promise<LeaderboardEntry[]> {
    const searchParams = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });

    const response = await getJson<{ success: boolean; data: LeaderboardResponse }>(
      `${buildLeaderboardEndpoint(gameId, config)}?${searchParams.toString()}`,
    );
    return response.data.leaderboard;
  }

  async getUserRank(
    gameId: string,
    userId: string,
    config?: Pick<GameConfig, "apiConfig">,
  ): Promise<UserRank> {
    const leaderboard = await this.getLeaderboard(gameId, { limit: 100, offset: 0, period: "all" }, config);
    const entry = leaderboard.find((row) => row.userId === userId);
    return {
      rank: entry?.rank ?? null,
      totalPlayers: leaderboard.length,
    };
  }

  async getHealth(): Promise<"ok"> {
    const response = await getJson<{ success: boolean; data: { status: "ok" } }>(API_ENDPOINTS.health);
    return response.data.status;
  }

  private getQueue(): PendingSubmission[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.pendingScores);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as Array<PendingSubmission | ScoreSubmission>;
      return parsed.map((entry) =>
        "submission" in entry
          ? entry
          : {
            submission: entry,
            scoreEndpoint: API_ENDPOINTS.score,
          }
      );
    } catch {
      return [];
    }
  }
}

export const leaderboardConnector = new LeaderboardConnector();
