import { getJson } from "@/lib/api";
import { validateGameConfig } from "@/schemas/validate";
import type { GameConfig, GameSummary, ValidationResult } from "./types";

const localGameModules = import.meta.glob("../../../../Games/*/config.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

export class ConfigLoader {
  private localConfigsCache: Map<string, GameConfig> | null = null;

  async load(source: string | URL): Promise<GameConfig> {
    try {
      const raw = await getJson<unknown>(source.toString());
      return this.parseOrThrow(raw);
    } catch (error) {
      const fallback = this.tryLoadLocalBySource(source.toString());
      if (fallback) {
        return fallback;
      }

      throw error;
    }
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
    try {
      const manifest = await getJson<GameSummary[]>("/api/games");
      if (manifest.length > 0) {
        return manifest;
      }
    } catch {
      return this.loadLocalManifest();
    }

    return this.loadLocalManifest();
  }

  private parseOrThrow(raw: unknown): GameConfig {
    const result = this.validate(raw);
    if (!result.success) {
      throw new Error(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    }

    return result.data;
  }

  private loadLocalConfigs(): Map<string, GameConfig> {
    if (this.localConfigsCache) {
      return this.localConfigsCache;
    }

    const entries = Object.values(localGameModules)
      .map((raw) => this.parseOrThrow(raw))
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((config) => [config.gameId, config] as const);

    this.localConfigsCache = new Map(entries);
    return this.localConfigsCache;
  }

  private loadLocalManifest(): GameSummary[] {
    return [...this.loadLocalConfigs().values()].map((config) => ({
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

  private tryLoadLocalBySource(source: string): GameConfig | null {
    const gameIdMatch = source.match(/\/api\/games\/([^/?#]+)/);
    if (!gameIdMatch) {
      return null;
    }

    return this.loadLocalConfigs().get(gameIdMatch[1]) ?? null;
  }
}

export const configLoader = new ConfigLoader();
