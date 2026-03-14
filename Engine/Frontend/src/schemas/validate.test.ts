import { describe, expect, it } from "vitest";
import { validateGameConfig } from "./validate";

const validGridConfig = {
  gameId: "test-grid-v1",
  gameType: "GRID",
  title: "Test Grid",
  description: "A valid runtime JSON config for validation tests.",
  version: "1.0.0",
  difficulty: "easy",
  levels: [
    {
      levelNumber: 1,
      gridSize: 4,
      preFilledCells: [{ row: 0, col: 0, value: 1 }],
      solution: [
        [1, 2, 3, 4],
        [3, 4, 1, 2],
        [2, 1, 4, 3],
        [4, 3, 2, 1],
      ],
      hints: [{ row: 0, col: 1, value: 2 }],
    },
  ],
  timerConfig: {
    type: "countdown",
    duration: 60,
    warningAt: [20, 10, 5],
  },
  scoringConfig: {
    basePoints: 10,
    bonusMultiplier: 1,
    penaltyPerHint: 0,
    penaltyPerWrong: 0,
    timeBonusFormula: "linear",
    timeBonusMultiplier: 1,
  },
};

describe("validateGameConfig", () => {
  it("accepts a valid config", () => {
    const result = validateGameConfig(validGridConfig);
    expect(result.success).toBe(true);
  });

  it("rejects malformed configs with actionable paths", () => {
    const result = validateGameConfig({
      ...validGridConfig,
      gameId: "Bad Id",
      levels: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((error) => error.path === "gameId")).toBe(true);
      expect(result.errors.some((error) => error.path === "levels")).toBe(true);
    }
  });
});
