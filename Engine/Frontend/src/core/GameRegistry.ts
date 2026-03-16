import type { ComponentType } from "react";
import { configLoader } from "./ConfigLoader";
import type { GameConfig, GameFilter, GameSummary, GameType, GameRendererProps } from "./types";
import { GameType as GameTypeEnum } from "./types";
import { GridRenderer } from "@/renderers/GridRenderer";
import { WordRenderer } from "@/renderers/WordRenderer";
import { MCQRenderer } from "@/renderers/MCQRenderer";
import { DragDropRenderer } from "@/renderers/DragDropRenderer";
import { BoardRenderer } from "@/renderers/BoardRenderer";

export type RendererComponent = ComponentType<GameRendererProps>;

const defaultRendererMap: Record<GameType, RendererComponent> = {
  [GameTypeEnum.GRID]: GridRenderer,
  [GameTypeEnum.WORD]: WordRenderer,
  [GameTypeEnum.MCQ]: MCQRenderer,
  [GameTypeEnum.DRAG_DROP]: DragDropRenderer,
  [GameTypeEnum.BOARD]: BoardRenderer,
  [GameTypeEnum.CUSTOM]: DragDropRenderer,
};

export class GameRegistry {
  private games = new Map<string, GameConfig>();
  private manifest: GameSummary[] = [];
  private rendererMap = new Map<GameType, RendererComponent>(
    Object.entries(defaultRendererMap) as [GameType, RendererComponent][],
  );

  async discover(): Promise<GameSummary[]> {
    this.manifest = await configLoader.loadManifest();
    return this.manifest;
  }

  register(config: GameConfig): void {
    this.games.set(config.gameId, config);
    if (!this.manifest.some((game) => game.gameId === config.gameId)) {
      this.manifest.push({
        gameId: config.gameId,
        title: config.title,
        description: config.description,
        gameType: config.gameType,
        difficulty: config.difficulty,
        version: config.version,
        estimatedPlayTime: config.metadata?.estimatedPlayTime,
        tags: config.metadata?.tags ?? [],
      });
    }
  }

  async getGame(gameId: string): Promise<GameConfig | null> {
    const cached = this.games.get(gameId);
    if (cached) {
      return cached;
    }

    const config = await configLoader.load(`/api/games/${gameId}`);
    this.register(config);
    return config;
  }

  listGames(filter?: GameFilter): GameSummary[] {
    return this.manifest.filter((game) => {
      const difficultyMatch = filter?.difficulty ? game.difficulty === filter.difficulty : true;
      return difficultyMatch;
    });
  }

  hasGame(gameId: string): boolean {
    return this.manifest.some((game) => game.gameId === gameId) || this.games.has(gameId);
  }

  registerRenderer(gameType: GameType, renderer: RendererComponent): void {
    this.rendererMap.set(gameType, renderer);
  }

  getRendererForType(gameType: GameType): RendererComponent {
    return this.rendererMap.get(gameType) ?? defaultRendererMap[GameTypeEnum.CUSTOM];
  }
}

export const gameRegistry = new GameRegistry();
