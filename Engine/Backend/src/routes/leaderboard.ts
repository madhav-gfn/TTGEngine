import { Router } from "express";
import { db } from "../db/connection.js";
import { getLeaderboard } from "../db/queries.js";
import { loadGameConfigById } from "../lib/gameConfigs.js";

export const leaderboardRouter = Router();

leaderboardRouter.get("/:gameId", (req, res) => {
  const config = loadGameConfigById(req.params.gameId);
  if (!config) {
    res.status(404).json({
      success: false,
      error: {
        code: "GAME_NOT_FOUND",
        message: `No leaderboard exists for '${req.params.gameId}'.`,
      },
    });
    return;
  }

  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
  const offset = Math.max(0, Number(req.query.offset ?? 0));
  const difficulty = typeof req.query.difficulty === "string" ? req.query.difficulty : "all";
  const period = typeof req.query.period === "string" ? req.query.period : "all";

  const payload = getLeaderboard(db, {
    gameId: req.params.gameId,
    limit,
    offset,
    difficulty,
    period,
  });

  res.json({
    success: true,
    data: {
      gameId: req.params.gameId,
      totalEntries: payload.totalEntries,
      leaderboard: payload.leaderboard,
    },
  });
});
