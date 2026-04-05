import { describe, expect, it } from "vitest";
import { AdaptiveEngine } from "./AdaptiveEngine";
import { GameType, TimeBonusFormula, TimerType } from "./types";

describe("AdaptiveEngine", () => {
  const baseConfig = {
    schemaVersion: 2 as const,
    gameId: "adaptive-grid",
    gameType: GameType.GRID,
    title: "Adaptive Grid",
    description: "Adaptive test config for runtime tuning.",
    version: "1.0.0",
    difficulty: "medium" as const,
    timerConfig: {
      type: TimerType.COUNTDOWN,
      duration: 60,
      warningAt: [15, 5],
    },
    scoringConfig: {
      basePoints: 25,
      bonusMultiplier: 1,
      penaltyPerHint: 0,
      penaltyPerWrong: 10,
      timeBonusFormula: TimeBonusFormula.NONE,
      timeBonusMultiplier: 1,
    },
    adaptiveConfig: {
      enabled: true,
      supportThreshold: 0.5,
      challengeThreshold: 0.9,
      timerAdjustmentSeconds: 10,
      multiplierAdjustment: 0.25,
      maxTimerAdjustmentSeconds: 20,
      minimumMultiplier: 0.75,
      maximumMultiplier: 2,
      adaptContent: true,
      adaptTimer: true,
      adaptScoring: true,
      adaptPenalties: true,
    },
    levels: [
      {
        levelNumber: 1,
        gridSize: 4,
        preFilledCells: [
          { row: 0, col: 0, value: 1 },
          { row: 1, col: 1, value: 2 },
        ],
        solution: [
          [1, 2, 3, 4],
          [3, 2, 4, 1],
          [2, 1, 4, 3],
          [4, 3, 1, 2],
        ],
        hints: [{ row: 0, col: 1, value: 2 }],
      },
    ],
    uiConfig: {
      theme: "system" as const,
      primaryColor: "#0f766e",
      secondaryColor: "#f59e0b",
      iconSet: "lucide",
      layout: "centered" as const,
      showTimer: true,
      showScore: true,
      showProgress: true,
      smartboard: {
        enabled: false,
        allowFullscreen: true,
        autoScaleBoard: true,
        emphasizeControls: false,
      },
    },
    metadata: {
      author: "Test",
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
      tags: ["test"],
      targetSkill: "Logic",
      estimatedPlayTime: 5,
    },
    apiConfig: {
      leaderboardEndpoint: "/api/leaderboard/adaptive-grid",
      scoreSubmitEndpoint: "/api/score",
    },
    interactionMode: "command" as const,
    interactionConfig: {
      inputMode: "hybrid" as const,
      autoFocus: true,
    },
  };

  it("applies support tuning after a weak level result", () => {
    const engine = new AdaptiveEngine();
    engine.initialize(baseConfig);

    const initial = engine.prepareLevel(baseConfig, 0);
    expect(initial.runtime.band).toBe("standard");

    engine.recordLevelOutcome(
      1,
      {
        completed: true,
        correctActions: 2,
        wrongActions: 3,
        totalActions: 5,
        hintsUsed: 1,
      },
      {
        levelNumber: 1,
        baseScore: 50,
        timeBonus: 0,
        hintPenalty: 0,
        wrongPenalty: 30,
        multiplier: 1,
        levelTotal: 20,
        timeTaken: 40,
        accuracy: 0.4,
      },
    );

    const supportRun = engine.prepareLevel(baseConfig, 0);
    expect(supportRun.runtime.band).toBe("support");
    expect(supportRun.runtime.timerDuration).toBe(70);
    expect(supportRun.runtime.wrongPenaltyEnabled).toBe(false);
    expect("preFilledCells" in supportRun.level && supportRun.level.preFilledCells.length).toBeGreaterThan(2);
  });

  it("applies challenge tuning after a strong level result", () => {
    const engine = new AdaptiveEngine();
    engine.initialize(baseConfig);

    engine.recordLevelOutcome(
      1,
      {
        completed: true,
        correctActions: 5,
        wrongActions: 0,
        totalActions: 5,
        hintsUsed: 0,
      },
      {
        levelNumber: 1,
        baseScore: 125,
        timeBonus: 0,
        hintPenalty: 0,
        wrongPenalty: 0,
        multiplier: 1,
        levelTotal: 125,
        timeTaken: 18,
        accuracy: 1,
      },
    );

    const challengeRun = engine.prepareLevel(baseConfig, 0);
    expect(challengeRun.runtime.band).toBe("challenge");
    expect(challengeRun.runtime.timerDuration).toBe(50);
    expect(challengeRun.runtime.multiplier).toBe(1.25);
    expect("preFilledCells" in challengeRun.level && challengeRun.level.preFilledCells.length).toBe(1);
  });
});
