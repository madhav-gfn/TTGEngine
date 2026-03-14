import type { GameConfig, GridLevelConfig, LeaderboardEntry, TimerConfig } from "@/core/types";
import { TimerType } from "@/core/types";
import { STORAGE_KEYS } from "./constants";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if (left.timeTaken !== right.timeTaken) {
      return left.timeTaken - right.timeTaken;
    }

    return new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime();
  });
}

export function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function getOrCreateUserId(): string {
  const existing = localStorage.getItem(STORAGE_KEYS.userId);
  if (existing) {
    return existing;
  }

  const next = `usr_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(STORAGE_KEYS.userId, next);
  return next;
}

export function getLevelTimerConfig(config: GameConfig, levelIndex: number): TimerConfig {
  const level = config.levels[levelIndex];
  return {
    ...config.timerConfig,
    duration: level.timeLimit ?? config.timerConfig.duration,
    type: config.timerConfig.type ?? TimerType.COUNTDOWN,
  };
}

export function getLevelMultiplier(config: GameConfig, levelIndex: number): number {
  return config.levels[levelIndex]?.bonusMultiplier ?? config.scoringConfig.bonusMultiplier ?? 1;
}

export function serializeCellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function buildGridState(level: GridLevelConfig): number[][] {
  const board = Array.from({ length: level.gridSize }, () =>
    Array.from({ length: level.gridSize }, () => 0),
  );

  level.preFilledCells.forEach((cell) => {
    board[cell.row][cell.col] = cell.value;
  });

  return board;
}

export function getSubgridDimensions(gridSize: number): { rows: number; cols: number } {
  const floor = Math.floor(Math.sqrt(gridSize));
  for (let factor = floor; factor >= 2; factor -= 1) {
    if (gridSize % factor === 0) {
      return { rows: factor, cols: gridSize / factor };
    }
  }

  return { rows: 1, cols: gridSize };
}
