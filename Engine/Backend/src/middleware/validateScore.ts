import type { RequestHandler } from "express";
import { z } from "zod";
import { calculateMaxPossibleScore, calculateMinimumTimeMs } from "../lib/gameSchema.js";
import { loadGameConfigById } from "../lib/gameConfigs.js";

const ScoreSubmissionSchema = z.object({
  userId: z.string().min(3),
  gameId: z.string().min(3),
  score: z.number().int().min(0),
  timeTaken: z.number().int().min(0),
  level: z.number().int().min(1),
  metadata: z.record(z.unknown()).default({}),
});

export const validateScoreSubmission: RequestHandler = (req, res, next) => {
  const parsed = ScoreSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Score submission payload is invalid.",
        details: {
          issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
      },
    });
    return;
  }

  const gameConfig = loadGameConfigById(parsed.data.gameId);
  if (!gameConfig) {
    res.status(404).json({
      success: false,
      error: {
        code: "GAME_NOT_FOUND",
        message: `Game '${parsed.data.gameId}' is not registered.`,
      },
    });
    return;
  }

  const maxPossible = calculateMaxPossibleScore(gameConfig);
  if (parsed.data.score > maxPossible) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_SCORE",
        message: "Score exceeds theoretical maximum for this game configuration.",
        details: {
          submittedScore: parsed.data.score,
          maxPossible,
        },
      },
    });
    return;
  }

  res.locals.scoreSubmission = parsed.data;
  res.locals.gameConfig = gameConfig;
  res.locals.isValid = parsed.data.timeTaken >= calculateMinimumTimeMs(gameConfig);
  next();
};
