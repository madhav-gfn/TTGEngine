import fs from "node:fs";
import path from "node:path";
import {
  normalizeGameConfig,
  parseGameConfig,
  toGameSummary,
  type AnyGameConfig,
  type GameConfig,
  type GameSummary,
} from "./gameSchema.js";
import { runtimeConfig } from "./runtimeConfig.js";

const GAMES_ROOT = runtimeConfig.gamesRoot;
const warnedDirectories = new Set<string>();

function warnOnce(directory: string, message: string, error?: unknown): void {
  if (warnedDirectories.has(directory)) {
    return;
  }

  warnedDirectories.add(directory);
  console.warn(`[game-config] ${message}`);
  if (error) {
    console.warn(error);
  }
}

function getGameDirectories(): string[] {
  if (!fs.existsSync(GAMES_ROOT)) {
    return [];
  }

  return fs
    .readdirSync(GAMES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function loadConfigFromDirectory(directory: string): AnyGameConfig | null {
  const configPath = path.join(GAMES_ROOT, directory, "config.json");
  if (!fs.existsSync(configPath)) {
    warnOnce(directory, `Skipping '${directory}' because config.json is missing.`);
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return parseGameConfig(raw);
  } catch (error) {
    warnOnce(directory, `Skipping '${directory}' because its config could not be parsed.`, error);
    return null;
  }
}

export function loadAllGameConfigsRaw(): AnyGameConfig[] {
  return getGameDirectories()
    .map((directory) => loadConfigFromDirectory(directory))
    .filter((config): config is AnyGameConfig => config !== null)
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function loadAllGameConfigs(): GameConfig[] {
  return loadAllGameConfigsRaw().map((config) => normalizeGameConfig(config));
}

export function loadGameConfigById(gameId: string): GameConfig | null {
  for (const directory of getGameDirectories()) {
    const config = loadConfigFromDirectory(directory);
    if (!config || config.gameId !== gameId) {
      continue;
    }

    return normalizeGameConfig(config);
  }

  return null;
}

export function loadRawGameConfigById(gameId: string): AnyGameConfig | null {
  for (const directory of getGameDirectories()) {
    const config = loadConfigFromDirectory(directory);
    if (config?.gameId === gameId) {
      return config;
    }
  }

  return null;
}

export function loadGameManifest(): GameSummary[] {
  return loadAllGameConfigs().map((config) => toGameSummary(config));
}
