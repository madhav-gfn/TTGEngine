import { Router } from "express";
import { loadGameManifest, loadRawGameConfigById } from "../lib/gameConfigs.js";

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
