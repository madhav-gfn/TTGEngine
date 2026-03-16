import { eventBus } from "./EventBus";
import { TimeBonusFormula } from "./types";
import type { FinalScore, GameAction, LevelScore, ScoreState, ScoringConfig } from "./types";

const createInitialState = (): ScoreState => ({
  currentLevel: 1,
  totalScore: 0,
  correctActions: 0,
  wrongActions: 0,
  hintsUsed: 0,
  totalActions: 0,
  currentLevelBase: 0,
  currentLevelMultiplier: 1,
  levelScores: [],
  accuracy: 0,
});

export class ScoreEngine {
  private config: ScoringConfig | null = null;
  private state: ScoreState = createInitialState();
  private wrongPenaltyEnabled = true;

  initialize(config: ScoringConfig): void {
    this.config = config;
    this.state = createInitialState();
    this.wrongPenaltyEnabled = true;
    this.emitUpdate();
  }

  startLevel(levelNumber: number, levelMultiplier = 1, options?: { wrongPenaltyEnabled?: boolean }): void {
    this.state = {
      ...this.state,
      currentLevel: levelNumber,
      correctActions: 0,
      wrongActions: 0,
      hintsUsed: 0,
      totalActions: 0,
      currentLevelBase: 0,
      currentLevelMultiplier: levelMultiplier,
      accuracy: this.state.levelScores.length
        ? this.state.levelScores.reduce((sum, level) => sum + level.accuracy, 0) /
          this.state.levelScores.length
        : 0,
      lastLevelScore: undefined,
    };
    this.wrongPenaltyEnabled = options?.wrongPenaltyEnabled ?? true;
    this.emitUpdate();
  }

  recordAction(action: GameAction): void {
    if (!this.config) {
      return;
    }

    if (action.type === "correct") {
      this.state.correctActions += 1;
      this.state.totalActions += 1;
      this.state.currentLevelBase += action.points ?? this.config.basePoints;
    }

    if (action.type === "wrong") {
      this.state.wrongActions += 1;
      this.state.totalActions += 1;
    }

    if (action.type === "hint") {
      this.state.hintsUsed += 1;
    }

    this.state.accuracy =
      this.state.totalActions === 0
        ? 0
        : this.state.correctActions / this.state.totalActions;

    this.emitUpdate();
  }

  applyHintPenalty(): void {
    this.recordAction({ type: "hint" });
  }

  calculateLevelScore(timeTaken: number, remainingSeconds = 0): LevelScore {
    if (!this.config) {
      throw new Error("ScoreEngine must be initialized before calculating scores.");
    }

    const normalizedTimeTaken = Math.max(0, Math.round(timeTaken));
    const timeBonus = this.calculateTimeBonus(remainingSeconds);
    const hintPenalty = this.state.hintsUsed * this.config.penaltyPerHint;
    const wrongPenalty = this.wrongPenaltyEnabled ? this.state.wrongActions * this.config.penaltyPerWrong : 0;
    const multiplier = this.state.currentLevelMultiplier || 1;
    const levelTotal = Math.max(
      0,
      Math.floor(this.state.currentLevelBase * multiplier + timeBonus - hintPenalty - wrongPenalty),
    );

    const levelScore: LevelScore = {
      levelNumber: this.state.currentLevel,
      baseScore: this.state.currentLevelBase,
      timeBonus,
      hintPenalty,
      wrongPenalty,
      multiplier,
      levelTotal,
      timeTaken: normalizedTimeTaken,
      accuracy: this.state.totalActions === 0 ? 0 : this.state.correctActions / this.state.totalActions,
    };

    this.state.levelScores = [...this.state.levelScores, levelScore];
    this.state.totalScore = this.state.levelScores.reduce((sum, entry) => sum + entry.levelTotal, 0);
    this.state.lastLevelScore = levelScore;
    this.emitUpdate();

    return levelScore;
  }

  calculateFinalScore(totalTimeTaken?: number): FinalScore {
    const timeTaken = Math.max(
      0,
      Math.round(
        totalTimeTaken ?? this.state.levelScores.reduce((sum, level) => sum + level.timeTaken, 0),
      ),
    );
    const accuracy =
      this.state.levelScores.length === 0
        ? 0
        : this.state.levelScores.reduce((sum, level) => sum + level.accuracy, 0) /
          this.state.levelScores.length;

    return {
      levelScores: this.state.levelScores,
      totalScore: this.state.totalScore,
      timeTaken,
      accuracy,
    };
  }

  getState(): ScoreState {
    return { ...this.state, levelScores: [...this.state.levelScores] };
  }

  private calculateTimeBonus(remainingSeconds: number): number {
    if (!this.config) {
      return 0;
    }

    if (this.config.timeBonusFormula === TimeBonusFormula.NONE) {
      return 0;
    }

    if (this.config.timeBonusFormula === TimeBonusFormula.EXPONENTIAL) {
      return Math.floor(
        Math.pow(this.config.timeBonusMultiplier || 1, Math.max(remainingSeconds, 1) / 10),
      );
    }

    return Math.max(0, Math.floor(remainingSeconds * this.config.timeBonusMultiplier));
  }

  private emitUpdate(): void {
    eventBus.emit("score:updated", this.getState());
  }
}

export const scoreEngine = new ScoreEngine();
