import { describe, expect, it } from "vitest";
import { ScoreEngine } from "./ScoreEngine";
import { TimeBonusFormula } from "./types";

describe("ScoreEngine", () => {
  it("calculates a level score from actions, penalties, and time bonus", () => {
    const engine = new ScoreEngine();
    engine.initialize({
      basePoints: 10,
      bonusMultiplier: 1.5,
      penaltyPerHint: 5,
      penaltyPerWrong: 2,
      timeBonusFormula: TimeBonusFormula.LINEAR,
      timeBonusMultiplier: 2,
    });

    engine.startLevel(1, 2);
    engine.recordAction({ type: "correct", points: 20 });
    engine.recordAction({ type: "correct", points: 10 });
    engine.recordAction({ type: "wrong" });
    engine.recordAction({ type: "hint" });

    const score = engine.calculateLevelScore(30_000, 10);

    expect(score.baseScore).toBe(30);
    expect(score.timeBonus).toBe(20);
    expect(score.hintPenalty).toBe(5);
    expect(score.wrongPenalty).toBe(2);
    expect(score.levelTotal).toBe(73);
  });

  it("skips wrong-answer penalties when a level disables negative marking", () => {
    const engine = new ScoreEngine();
    engine.initialize({
      basePoints: 10,
      bonusMultiplier: 1,
      penaltyPerHint: 0,
      penaltyPerWrong: 20,
      timeBonusFormula: TimeBonusFormula.NONE,
      timeBonusMultiplier: 1,
    });

    engine.startLevel(1, 1, { wrongPenaltyEnabled: false });
    engine.recordAction({ type: "correct", points: 10 });
    engine.recordAction({ type: "wrong" });

    const score = engine.calculateLevelScore(15_000, 0);

    expect(score.wrongPenalty).toBe(0);
    expect(score.levelTotal).toBe(10);
  });
});
