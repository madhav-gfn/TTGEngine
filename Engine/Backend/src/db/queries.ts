import { randomUUID } from "node:crypto";
import type { LeaderboardEntry } from "../types/api.js";

type DatabaseStatement = {
  run: (params?: Record<string, unknown>) => unknown;
  get: (...params: unknown[]) => unknown;
  all: (...params: unknown[]) => unknown[];
};

type DatabaseHandle = {
  prepare: (sql: string) => DatabaseStatement;
};

interface ScoreInsert {
  userId: string;
  gameId: string;
  score: number;
  timeTaken: number;
  level: number;
  difficulty: string;
  metadata: Record<string, unknown>;
  isValid: boolean;
}

interface LeaderboardQueryInput {
  gameId: string;
  limit: number;
  offset: number;
  difficulty?: string;
  period?: string;
}

export interface GameStatsRow {
  gameId: string;
  submissions: number;
  validSubmissions: number;
  players: number;
  highScore: number | null;
  averageScore: number | null;
  lastSubmissionAt: string | null;
}

export interface OverallStats {
  submissions: number;
  validSubmissions: number;
  players: number;
}

function buildWhereClause(input: LeaderboardQueryInput): { clause: string; params: Record<string, unknown> } {
  const clauses = ["game_id = @gameId", "is_valid = 1"];
  const params: Record<string, unknown> = {
    gameId: input.gameId,
    limit: input.limit,
    offset: input.offset,
  };

  if (input.difficulty && input.difficulty !== "all") {
    clauses.push("difficulty = @difficulty");
    params.difficulty = input.difficulty;
  }

  if (input.period === "daily") {
    clauses.push("submitted_at >= datetime('now', '-1 day')");
  }
  if (input.period === "weekly") {
    clauses.push("submitted_at >= datetime('now', '-7 day')");
  }
  if (input.period === "monthly") {
    clauses.push("submitted_at >= datetime('now', '-30 day')");
  }

  return {
    clause: clauses.join(" AND "),
    params,
  };
}

export function insertScore(db: DatabaseHandle, input: ScoreInsert) {
  const submissionId = `sub_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const submittedAt = new Date().toISOString();
  const previousBest = db
    .prepare("SELECT MAX(score) as best FROM scores WHERE user_id = ? AND game_id = ?")
    .get(input.userId, input.gameId) as { best: number | null };

  db.prepare(
    `INSERT INTO scores (
      submission_id,
      user_id,
      game_id,
      score,
      time_taken,
      level,
      difficulty,
      metadata,
      submitted_at,
      is_valid
    ) VALUES (
      @submissionId,
      @userId,
      @gameId,
      @score,
      @timeTaken,
      @level,
      @difficulty,
      @metadata,
      @submittedAt,
      @isValid
    )`,
  ).run({
    submissionId,
    userId: input.userId,
    gameId: input.gameId,
    score: input.score,
    timeTaken: input.timeTaken,
    level: input.level,
    difficulty: input.difficulty,
    metadata: JSON.stringify(input.metadata),
    submittedAt,
    isValid: input.isValid ? 1 : 0,
  });

  return {
    submissionId,
    submittedAt,
    personalBest: previousBest.best === null || input.score > previousBest.best,
  };
}

export function getSubmissionRank(db: DatabaseHandle, gameId: string, submissionId: string): number | null {
  const row = db
    .prepare(
      `SELECT rank FROM (
        SELECT submission_id, RANK() OVER (
          ORDER BY score DESC, time_taken ASC, submitted_at ASC
        ) as rank
        FROM scores
        WHERE game_id = ? AND is_valid = 1
      ) ranked
      WHERE submission_id = ?`,
    )
    .get(gameId, submissionId) as { rank: number } | undefined;

  return row?.rank ?? null;
}

export function getTotalPlayers(db: DatabaseHandle, gameId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM scores WHERE game_id = ? AND is_valid = 1")
    .get(gameId) as { count: number };
  return row.count;
}

export function getLeaderboard(
  db: DatabaseHandle,
  input: LeaderboardQueryInput,
): {
  totalEntries: number;
  leaderboard: LeaderboardEntry[];
} {
  const { clause, params } = buildWhereClause(input);
  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM scores WHERE ${clause}`)
    .get(params) as { count: number };

  const rows = db
    .prepare(
      `SELECT * FROM (
        SELECT
          RANK() OVER (
            ORDER BY score DESC, time_taken ASC, submitted_at ASC
          ) as rank,
          user_id,
          score,
          time_taken,
          submitted_at,
          metadata
        FROM scores
        WHERE ${clause}
      ) ranked
      LIMIT @limit OFFSET @offset`,
    )
    .all(params) as Array<{
      rank: number;
      user_id: string;
      score: number;
      time_taken: number;
      submitted_at: string;
      metadata: string | null;
    }>;

  return {
    totalEntries: totalRow.count,
    leaderboard: rows.map((row) => {
      let displayName = `Player ${row.user_id.slice(-4)}`;
      try {
        const metadata = row.metadata ? (JSON.parse(row.metadata) as { displayName?: string }) : undefined;
        if (metadata?.displayName) {
          displayName = metadata.displayName;
        }
      } catch {
        displayName = `Player ${row.user_id.slice(-4)}`;
      }

      return {
        rank: row.rank,
        userId: row.user_id,
        displayName,
        score: row.score,
        timeTaken: row.time_taken,
        submittedAt: row.submitted_at,
      };
    }),
  };
}

export function getGameStatsRows(db: DatabaseHandle): GameStatsRow[] {
  const rows = db
    .prepare(
      `SELECT
        game_id,
        COUNT(*) as submissions,
        SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_submissions,
        COUNT(DISTINCT user_id) as players,
        MAX(score) as high_score,
        AVG(score) as average_score,
        MAX(submitted_at) as last_submission_at
      FROM scores
      GROUP BY game_id`,
    )
    .all() as Array<{
      game_id: string;
      submissions: number;
      valid_submissions: number;
      players: number;
      high_score: number | null;
      average_score: number | null;
      last_submission_at: string | null;
    }>;

  return rows.map((row) => ({
    gameId: row.game_id,
    submissions: row.submissions,
    validSubmissions: row.valid_submissions,
    players: row.players,
    highScore: row.high_score,
    averageScore: row.average_score,
    lastSubmissionAt: row.last_submission_at,
  }));
}

export function getOverallStats(db: DatabaseHandle): OverallStats {
  const row = db
    .prepare(
      `SELECT
        COUNT(*) as submissions,
        SUM(CASE WHEN is_valid = 1 THEN 1 ELSE 0 END) as valid_submissions,
        COUNT(DISTINCT user_id) as players
      FROM scores`,
    )
    .get() as {
      submissions: number;
      valid_submissions: number | null;
      players: number;
    };

  return {
    submissions: row.submissions,
    validSubmissions: row.valid_submissions ?? 0,
    players: row.players,
  };
}
