import type { AdaptiveBand, GameConfig, SessionGenerationEntry } from "@/core/types";
import { API_ENDPOINTS } from "./constants";
import { postJson } from "./api";
import { validateGameConfig } from "@/schemas/validate";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function generateGameVariant(
  gameId: string,
  options?: { band?: AdaptiveBand; seed?: string },
): Promise<GameConfig> {
  const response = await postJson<ApiSuccess<unknown>>(
    `${API_ENDPOINTS.games}/${encodeURIComponent(gameId)}/variant`,
    options ?? {},
  );

  const result = validateGameConfig(response.data);
  if (!result.success) {
    throw new Error(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }

  return result.data;
}

interface GeneratedLevelApiData {
  levelIndex: number;
  level: unknown;
  band: AdaptiveBand;
  source: SessionGenerationEntry["source"];
  summary: string;
  generatedAt: string;
  seed: string;
  strategy: string;
}

export async function generateMidSessionLevel(
  gameId: string,
  currentConfig: GameConfig,
  options: {
    levelIndex: number;
    band?: AdaptiveBand;
    seed?: string;
    recentAccuracies?: number[];
    completedLevels?: number;
  },
): Promise<{ level: GameConfig["levels"][number]; generation: SessionGenerationEntry }> {
  const response = await postJson<ApiSuccess<GeneratedLevelApiData>>(
    `${API_ENDPOINTS.games}/${encodeURIComponent(gameId)}/levels/generate`,
    options,
  );

  const nextRawConfig = {
    ...currentConfig,
    levels: currentConfig.levels.map((level, index) =>
      index === response.data.levelIndex ? response.data.level : level
    ),
  };
  const result = validateGameConfig(nextRawConfig);

  if (!result.success) {
    throw new Error(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }

  return {
    level: result.data.levels[response.data.levelIndex],
    generation: {
      levelIndex: response.data.levelIndex,
      levelNumber: result.data.levels[response.data.levelIndex]?.levelNumber ?? response.data.levelIndex + 1,
      band: response.data.band,
      source: response.data.source,
      scope: "mid-session",
      summary: response.data.summary,
      generatedAt: response.data.generatedAt,
      seed: response.data.seed,
      strategy: response.data.strategy,
    },
  };
}
