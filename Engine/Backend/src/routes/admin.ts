import { Router } from "express";
import { db } from "../db/connection.js";
import { getGameStatsRows, getOverallStats, getLeaderboard } from "../db/queries.js";
import { createGameConfig, deleteGameConfig, listGameConfigDirectories, loadGameManifest, loadRawGameConfigById, updateGameConfig } from "../lib/gameConfigs.js";
import { draftGameWithAi, expandLevelsWithAi } from "../lib/aiAuthoring.js";
import { parseGameConfig } from "../lib/gameSchema.js";
import { requireAdmin } from "../middleware/requireAdmin.js";

export const adminRouter = Router();

adminRouter.use(requireAdmin);

adminRouter.get("/overview", (_req, res) => {
  const manifest = loadGameManifest();
  const statsRows = getGameStatsRows(db);
  const overall = getOverallStats(db);
  const directories = new Map(listGameConfigDirectories().map((entry) => [entry.gameId, entry.directory] as const));
  const statsMap = new Map(statsRows.map((row) => [row.gameId, row] as const));

  const games = manifest.map((game) => {
    const stats = statsMap.get(game.gameId);
    const leaderboard = getLeaderboard(db, {
      gameId: game.gameId,
      limit: 5,
      offset: 0,
      difficulty: "all",
      period: "all",
    });

    return {
      ...game,
      directory: directories.get(game.gameId) ?? game.gameId,
      submissions: stats?.submissions ?? 0,
      validSubmissions: stats?.validSubmissions ?? 0,
      players: stats?.players ?? 0,
      highScore: stats?.highScore ?? null,
      averageScore: stats?.averageScore ?? null,
      lastSubmissionAt: stats?.lastSubmissionAt ?? null,
      leaderboardPreview: leaderboard.leaderboard,
    };
  });

  res.json({
    success: true,
    data: {
      generatedAt: new Date().toISOString(),
      overall: {
        totalGames: manifest.length,
        submissions: overall.submissions,
        validSubmissions: overall.validSubmissions,
        players: overall.players,
      },
      games,
    },
  });
});

adminRouter.get("/games/:gameId", (req, res) => {
  const gameConfig = loadRawGameConfigById(req.params.gameId);

  if (!gameConfig) {
    res.status(404).json({
      success: false,
      error: {
        code: "GAME_NOT_FOUND",
        message: `No JSON config exists for '${req.params.gameId}'.`,
      },
    });
    return;
  }

  res.json({
    success: true,
    data: gameConfig,
  });
});

adminRouter.post("/games", (req, res) => {
  try {
    const parsed = createGameConfig({
      config: req.body?.config,
      directoryName: typeof req.body?.directoryName === "string" ? req.body.directoryName : undefined,
    });

    res.status(201).json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create game.";
    res.status(400).json({
      success: false,
      error: {
        code: "CREATE_GAME_FAILED",
        message,
      },
    });
  }
});

adminRouter.put("/games/:gameId", (req, res) => {
  try {
    const parsed = updateGameConfig(req.params.gameId, req.body?.config);
    res.json({
      success: true,
      data: parsed,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update game.";
    const status = message.includes("No game exists") ? 404 : 400;
    res.status(status).json({
      success: false,
      error: {
        code: "UPDATE_GAME_FAILED",
        message,
      },
    });
  }
});

adminRouter.delete("/games/:gameId", (req, res) => {
  try {
    const deleted = deleteGameConfig(req.params.gameId);
    res.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete game.";
    const status = message.includes("No game exists") ? 404 : 400;
    res.status(status).json({
      success: false,
      error: {
        code: "DELETE_GAME_FAILED",
        message,
      },
    });
  }
});

adminRouter.post("/ai/game", async (req, res) => {
  try {
    const generated = await draftGameWithAi({
      prompt: typeof req.body?.prompt === "string" ? req.body.prompt : "",
      gameType: req.body?.gameType,
      difficulty: req.body?.difficulty,
      targetSkill: typeof req.body?.targetSkill === "string" ? req.body.targetSkill : "problem solving",
      aiProvider: req.body?.aiProvider,
      customRendererKind: req.body?.customRendererKind,
    });

    res.json({
      success: true,
      data: generated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to draft game with AI.";
    res.status(400).json({
      success: false,
      error: {
        code: "AI_GAME_DRAFT_FAILED",
        message,
      },
    });
  }
});

adminRouter.post("/ai/levels", async (req, res) => {
  try {
    const config = parseGameConfig(req.body?.config);
    const generated = await expandLevelsWithAi({
      config,
      prompt: typeof req.body?.prompt === "string" ? req.body.prompt : "",
      count: Number(req.body?.count) || 1,
      aiProvider: req.body?.aiProvider,
    });

    res.json({
      success: true,
      data: generated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate levels with AI.";
    res.status(400).json({
      success: false,
      error: {
        code: "AI_LEVEL_GENERATION_FAILED",
        message,
      },
    });
  }
});
