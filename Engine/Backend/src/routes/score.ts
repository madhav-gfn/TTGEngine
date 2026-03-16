import { Router } from "express";
import { db } from "../db/connection.js";
import { getSubmissionRank, getTotalPlayers, insertScore } from "../db/queries.js";
import { scoreRateLimit } from "../middleware/rateLimit.js";
import { validateScoreSubmission } from "../middleware/validateScore.js";

export const scoreRouter = Router();

scoreRouter.post("/", scoreRateLimit, validateScoreSubmission, (req, res) => {
  const submission = res.locals.scoreSubmission as {
    userId: string;
    gameId: string;
    score: number;
    timeTaken: number;
    level: number;
    metadata: Record<string, unknown>;
  };
  const config = res.locals.gameConfig as { difficulty: string };
  const isValid = Boolean(res.locals.isValid);

  const inserted = insertScore(db, {
    ...submission,
    difficulty: config.difficulty,
    isValid,
  });

  const totalPlayers = getTotalPlayers(db, submission.gameId);
  const rank = isValid ? getSubmissionRank(db, submission.gameId, inserted.submissionId) : null;

  res.status(201).json({
    success: true,
    data: {
      submissionId: inserted.submissionId,
      rank: rank ?? 0,
      totalPlayers,
      personalBest: inserted.personalBest,
      leaderboardEligible: isValid,
    },
  });
});
