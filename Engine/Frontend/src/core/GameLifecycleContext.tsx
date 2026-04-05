/**
 * GameLifecycleContext — provides actions from useGameLifecycle
 * to all child pages without prop drilling.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { GameAction, LevelResult } from "@/core/types";

export interface GameLifecycleActions {
  selectGame: (gameId: string) => Promise<void>;
  startCurrentLevel: () => void;
  pauseGame: () => void;
  submitAction: (action: GameAction) => void;
  completeLevel: (result?: Partial<LevelResult>) => void;
  nextLevel: () => void;
  replayGame: () => void;
  backToGames: () => void;
  dismissError: () => void;
}

export const GameLifecycleContext = createContext<GameLifecycleActions | null>(null);

export function useGameActions(): GameLifecycleActions {
  const ctx = useContext(GameLifecycleContext);
  if (!ctx) throw new Error("useGameActions must be used inside GameLifecycleProvider");
  return ctx;
}
