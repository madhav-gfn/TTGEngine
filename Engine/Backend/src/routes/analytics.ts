import { Router } from "express";
import { db } from "../db/connection.js";
import { getUserScoreHistory } from "../db/queries.js";
import { buildSkillAnalytics } from "../lib/skillAnalytics.js";

export const analyticsRouter = Router();

analyticsRouter.get("/skills/:userId", (req, res) => {
  const userId = req.params.userId?.trim();
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 30) || 30));
  const gameId = typeof req.query.gameId === "string" && req.query.gameId.trim()
    ? req.query.gameId.trim()
    : undefined;

  if (!userId) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_USER_ID",
        message: "A valid user id is required.",
      },
    });
    return;
  }

  const rows = getUserScoreHistory(db, {
    userId,
    limit,
    gameId,
  });

  res.json({
    success: true,
    data: buildSkillAnalytics(userId, rows),
  });
});
