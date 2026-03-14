import { describe, expect, it } from "vitest";
import { gameStateMachine } from "./GameStateMachine";

describe("GameStateMachine", () => {
  it("allows documented transitions", () => {
    expect(gameStateMachine.canTransition("IDLE", "LOADING")).toBe(true);
    expect(gameStateMachine.canTransition("READY", "PLAYING")).toBe(true);
  });

  it("rejects impossible transitions", () => {
    expect(gameStateMachine.canTransition("PAUSED", "GAME_OVER")).toBe(false);
    expect(() => gameStateMachine.transition("PAUSED", "GAME_OVER")).toThrow();
  });
});
