import { Router } from "express";
import { loadGameManifest, loadRawGameConfigById } from "../lib/gameConfigs.js";
import { generateLevelForConfig, generateVariantForConfig } from "../lib/aiVariants.js";

export const gamesRouter = Router();

gamesRouter.get("/", (_req, res) => {
  res.json(loadGameManifest());
});

gamesRouter.get("/:gameId", (req, res) => {
  const config = loadRawGameConfigById(req.params.gameId);

  if (!config) {
    res.status(404).json({
      success: false,
      error: {
        code: "GAME_NOT_FOUND",
        message: `No JSON config exists for '${req.params.gameId}'.`,
      },
    });
    return;
  }

  res.json(config);
});

gamesRouter.post("/:gameId/variant", async (req, res) => {
  const config = loadRawGameConfigById(req.params.gameId);

  if (!config) {
    res.status(404).json({
      success: false,
      error: {
        code: "GAME_NOT_FOUND",
        message: `No JSON config exists for '${req.params.gameId}'.`,
      },
    });
    return;
  }

  try {
    const variant = await generateVariantForConfig(config, {
      band: req.body?.band,
      seed: typeof req.body?.seed === "string" ? req.body.seed : undefined,
    });

    res.json({
      success: true,
      data: variant,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: "VARIANT_GENERATION_FAILED",
        message: error instanceof Error ? error.message : "Failed to generate game variant.",
      },
    });
  }
});

gamesRouter.post("/:gameId/levels/generate", async (req, res) => {
  const config = loadRawGameConfigById(req.params.gameId);

  if (!config) {
    res.status(404).json({
      success: false,
      error: {
        code: "GAME_NOT_FOUND",
        message: `No JSON config exists for '${req.params.gameId}'.`,
      },
    });
    return;
  }

  if (!Number.isInteger(req.body?.levelIndex) || req.body.levelIndex < 0 || req.body.levelIndex >= config.levels.length) {
    res.status(400).json({
      success: false,
      error: {
        code: "INVALID_LEVEL_INDEX",
        message: "A valid levelIndex is required for generation.",
      },
    });
    return;
  }

  try {
    const generatedLevel = await generateLevelForConfig(config, {
      levelIndex: req.body.levelIndex,
      band: req.body?.band,
      seed: typeof req.body?.seed === "string" ? req.body.seed : undefined,
      recentAccuracies: Array.isArray(req.body?.recentAccuracies)
        ? req.body.recentAccuracies.filter((value: unknown): value is number => typeof value === "number")
        : undefined,
      completedLevels: typeof req.body?.completedLevels === "number" ? req.body.completedLevels : undefined,
    });

    res.json({
      success: true,
      data: generatedLevel,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: "LEVEL_GENERATION_FAILED",
        message: error instanceof Error ? error.message : "Failed to generate session level.",
      },
    });
  }
});
