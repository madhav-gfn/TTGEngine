import type { GameState } from "./types";

export const VALID_TRANSITIONS: Record<GameState, GameState[]> = {
  IDLE: ["LOADING"],
  LOADING: ["READY", "ERROR"],
  READY: ["PLAYING"],
  PLAYING: ["PAUSED", "LEVEL_END"],
  PAUSED: ["PLAYING"],
  LEVEL_END: ["PLAYING", "GAME_OVER"],
  GAME_OVER: ["RESULTS"],
  RESULTS: ["IDLE", "READY"],
  ERROR: ["IDLE"],
};

export class GameStateMachine {
  canTransition(from: GameState, to: GameState): boolean {
    return VALID_TRANSITIONS[from].includes(to);
  }

  transition(from: GameState, to: GameState): GameState {
    if (!this.canTransition(from, to)) {
      throw new Error(`Invalid game state transition: ${from} -> ${to}`);
    }

    return to;
  }
}

export const gameStateMachine = new GameStateMachine();
