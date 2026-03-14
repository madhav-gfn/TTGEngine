import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GameConfigSchema, type GameConfig, type GameSummary } from "./gameSchema.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_ROOT = path.resolve(dirname, "../../../../Games");

function getGameDirectories(): string[] {
  if (!fs.existsSync(GAMES_ROOT)) {
    return [];
  }

  return fs
    .readdirSync(GAMES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export function loadAllGameConfigs(): GameConfig[] {
  return getGameDirectories()
    .map((directory) => {
      const configPath = path.join(GAMES_ROOT, directory, "config.json");
      const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return GameConfigSchema.parse(raw);
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function loadGameConfigById(gameId: string): GameConfig | null {
  const match = loadAllGameConfigs().find((config) => config.gameId === gameId);
  return match ?? null;
}

export function loadGameManifest(): GameSummary[] {
  return loadAllGameConfigs().map((config) => ({
    gameId: config.gameId,
    title: config.title,
    description: config.description,
    gameType: config.gameType,
    difficulty: config.difficulty,
    version: config.version,
    estimatedPlayTime: config.metadata?.estimatedPlayTime,
    tags: config.metadata?.tags ?? [],
  }));
}
