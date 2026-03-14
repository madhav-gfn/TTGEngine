import type { RequestHandler } from "express";

const submissionWindowMs = 30_000;
const recentSubmissions = new Map<string, number>();

export const scoreRateLimit: RequestHandler = (req, res, next) => {
  const userId = typeof req.body?.userId === "string" ? req.body.userId : "anonymous";
  const gameId = typeof req.body?.gameId === "string" ? req.body.gameId : "unknown";
  const key = `${userId}:${gameId}`;
  const now = Date.now();
  const previous = recentSubmissions.get(key) ?? 0;

  if (now - previous < submissionWindowMs) {
    res.status(429).json({
      success: false,
      error: {
        code: "RATE_LIMITED",
        message: "Only one submission per user per game is allowed every 30 seconds.",
      },
    });
    return;
  }

  recentSubmissions.set(key, now);
  next();
};
