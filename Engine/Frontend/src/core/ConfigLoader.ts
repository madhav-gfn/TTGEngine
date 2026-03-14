import { getJson } from "@/lib/api";
import { validateGameConfig } from "@/schemas/validate";
import type { GameConfig, GameSummary, ValidationResult } from "./types";

export class ConfigLoader {
  async load(source: string | URL): Promise<GameConfig> {
    const raw = await getJson<unknown>(source.toString());
    const result = this.validate(raw);
    if (!result.success) {
      throw new Error(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    }

    return result.data;
  }

  validate(raw: unknown): ValidationResult<GameConfig> {
    return validateGameConfig(raw);
  }

  async preload(gameIds: string[]): Promise<Map<string, GameConfig>> {
    const results = await Promise.all(
      gameIds.map(async (gameId) => [gameId, await this.load(`/api/games/${gameId}`)] as const),
    );

    return new Map(results);
  }

  async loadManifest(): Promise<GameSummary[]> {
    return getJson<GameSummary[]>("/api/games");
  }
}

export const configLoader = new ConfigLoader();
