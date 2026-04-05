import { clamp, getLevelMultiplier, getLevelTimerConfig, isWrongPenaltyEnabledForLevel } from "@/lib/utils";
import type {
  AdaptiveBand,
  AdaptiveConfig,
  AdaptiveInsight,
  AdaptiveLevelRuntime,
  BoardEnemy,
  BoardLevelConfig,
  CustomLevelConfig,
  GameConfig,
  GridCell,
  GridLevelConfig,
  LevelConfig,
  LevelResult,
  LevelScore,
  MCQLevelConfig,
  WordLevelConfig,
} from "./types";

const DEFAULT_ADAPTIVE_CONFIG: AdaptiveConfig = {
  enabled: false,
  supportThreshold: 0.5,
  challengeThreshold: 0.85,
  timerAdjustmentSeconds: 10,
  multiplierAdjustment: 0.15,
  maxTimerAdjustmentSeconds: 30,
  minimumMultiplier: 0.75,
  maximumMultiplier: 2,
  adaptContent: true,
  adaptTimer: true,
  adaptScoring: true,
  adaptPenalties: true,
};

const DIFFICULTY_ORDER = {
  easy: 0,
  medium: 1,
  hard: 2,
} as const;

function resolveAdaptiveConfig(config: GameConfig): AdaptiveConfig {
  return {
    ...DEFAULT_ADAPTIVE_CONFIG,
    ...(config.adaptiveConfig ?? {}),
  };
}

function dedupeCells(cells: GridCell[]): GridCell[] {
  const seen = new Set<string>();
  return cells.filter((cell) => {
    const key = `${cell.row}:${cell.col}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function bandLabel(band: AdaptiveBand): string {
  if (band === "support") {
    return "Support mode";
  }
  if (band === "challenge") {
    return "Challenge mode";
  }
  return "Balanced mode";
}

function sortWordsForBand(level: WordLevelConfig, band: AdaptiveBand) {
  const sorted = [...level.validWords].sort((left, right) => {
    const delta = DIFFICULTY_ORDER[left.difficulty] - DIFFICULTY_ORDER[right.difficulty];
    return band === "challenge" ? -delta : delta;
  });

  if (band === "support" && level.bonusWords?.length) {
    return [...sorted, ...level.bonusWords];
  }

  return sorted;
}

function adaptGridLevel(level: GridLevelConfig, band: AdaptiveBand): GridLevelConfig {
  const allCells: GridCell[] = [];
  level.solution.forEach((row, rowIndex) => {
    row.forEach((value, colIndex) => {
      allCells.push({ row: rowIndex, col: colIndex, value });
    });
  });

  const currentKeys = new Set(level.preFilledCells.map((cell) => `${cell.row}:${cell.col}`));
  const missingCells = allCells.filter((cell) => !currentKeys.has(`${cell.row}:${cell.col}`));

  if (band === "support") {
    const extraCells = missingCells.slice(0, Math.min(2, missingCells.length));
    const hints = dedupeCells([...(level.hints ?? []), ...extraCells]).slice(0, 4);
    return {
      ...level,
      preFilledCells: dedupeCells([...level.preFilledCells, ...extraCells]),
      hints,
    };
  }

  if (band === "challenge" && level.preFilledCells.length > 1) {
    const nextCount = Math.max(1, level.preFilledCells.length - Math.max(1, Math.floor(level.preFilledCells.length * 0.2)));
    return {
      ...level,
      preFilledCells: level.preFilledCells.slice(0, nextCount),
      hints: (level.hints ?? []).slice(0, Math.max(0, (level.hints ?? []).length - 1)),
    };
  }

  return level;
}

function adaptMCQLevel(level: MCQLevelConfig, band: AdaptiveBand): MCQLevelConfig {
  const questions = [...level.questions].sort((left, right) => {
    const delta = DIFFICULTY_ORDER[left.difficulty] - DIFFICULTY_ORDER[right.difficulty];
    return band === "challenge" ? -delta : delta;
  });

  return {
    ...level,
    questions,
    shuffleOptions: band === "support" ? false : level.shuffleOptions || band === "challenge",
  };
}

function adaptWordLevel(level: WordLevelConfig, band: AdaptiveBand): WordLevelConfig {
  const validWords = sortWordsForBand(level, band);
  return {
    ...level,
    validWords,
    minWordLength: band === "support" ? Math.max(2, level.minWordLength - 1) : level.minWordLength,
    maxWordLength: band === "challenge" ? Math.max(level.minWordLength, level.maxWordLength - 1) : level.maxWordLength,
    bonusWords: band === "challenge" ? [] : level.bonusWords,
  };
}

function adaptBoardEnemies(enemies: BoardEnemy[] | undefined, band: AdaptiveBand): BoardEnemy[] | undefined {
  if (!enemies?.length) {
    return enemies;
  }

  if (band === "support") {
    const reduced = enemies.length > 1 ? enemies.slice(0, enemies.length - 1) : enemies;
    return reduced.map((enemy) => ({
      ...enemy,
      speed: Math.min(10, (enemy.speed ?? 1) + 1),
    }));
  }

  if (band === "challenge") {
    return enemies.map((enemy) => ({
      ...enemy,
      speed: Math.max(1, (enemy.speed ?? 1) - 1),
    }));
  }

  return enemies.map((enemy) => ({ ...enemy }));
}

function adaptBoardLevel(level: BoardLevelConfig, band: AdaptiveBand): BoardLevelConfig {
  return {
    ...level,
    enemies: adaptBoardEnemies(level.enemies, band),
    enemyCollisionPenalty:
      band === "support"
        ? Math.max(0, (level.enemyCollisionPenalty ?? 0) - 10)
        : band === "challenge"
          ? (level.enemyCollisionPenalty ?? 0) + 10
          : level.enemyCollisionPenalty,
  };
}

function adaptDragDropLevel(level: import("./types").DragDropLevelConfig, band: AdaptiveBand): import("./types").DragDropLevelConfig {
  const usedTargetIds = new Set(Object.values(level.correctMapping));

  if (band === "support") {
    const targetIdsToKeep = new Set<string>();
    const items = level.items.slice(0, Math.max(2, level.items.length - 1));
    items.forEach((item) => {
      const targetId = level.correctMapping[item.id];
      if (targetId) {
        targetIdsToKeep.add(targetId);
      }
    });

    return {
      ...level,
      items,
      targets: level.targets.filter((target) => targetIdsToKeep.has(target.id) || usedTargetIds.has(target.id)),
      correctMapping: items.reduce<Record<string, string>>((mapping, item) => {
        mapping[item.id] = level.correctMapping[item.id];
        return mapping;
      }, {}),
    };
  }

  if (band === "challenge") {
    const decoyTargetId = `decoy-${level.levelNumber}`;
    return {
      ...level,
      targets: [
        ...level.targets,
        {
          id: decoyTargetId,
          label: `${level.targets[0]?.label ?? "Extra"} decoy`,
          acceptsMultiple: false,
        },
      ],
    };
  }

  return {
    ...level,
    items: [...level.items],
    targets: [...level.targets],
    correctMapping: { ...level.correctMapping },
  };
}

function adaptCustomLevel(level: CustomLevelConfig, band: AdaptiveBand): CustomLevelConfig {
  if (band === "support") {
    return {
      ...level,
      instruction: `${level.instruction} Focus on one checkpoint at a time.`,
      checkpoints: level.checkpoints?.length ? level.checkpoints : [level.objective, "Confirm your final answer"],
    };
  }

  if (band === "challenge") {
    return {
      ...level,
      objective: `${level.objective} Complete it with no misses.`,
      instruction: `${level.instruction} Challenge rule: finish all checkpoints cleanly.`,
      checkpoints: level.checkpoints?.length
        ? [...level.checkpoints, "Validate the result under pressure"]
        : [level.objective, "Validate the result under pressure"],
    };
  }

  return {
    ...level,
    checkpoints: level.checkpoints?.length ? [...level.checkpoints] : [level.objective],
  };
}

function adaptLevel(level: LevelConfig, band: AdaptiveBand): LevelConfig {
  if ("solution" in level) {
    return adaptGridLevel(level, band);
  }

  if ("questions" in level) {
    return adaptMCQLevel(level, band);
  }

  if ("validWords" in level) {
    return adaptWordLevel(level, band);
  }

  if ("board" in level) {
    return adaptBoardLevel(level, band);
  }

  if ("items" in level) {
    return adaptDragDropLevel(level, band);
  }

  if ("objective" in level) {
    return adaptCustomLevel(level, band);
  }

  return level;
}

function getBandFromPerformance(
  adaptiveConfig: AdaptiveConfig,
  result: LevelResult,
  score: LevelScore,
): AdaptiveBand {
  if (!result.completed) {
    return "support";
  }

  if (score.accuracy < adaptiveConfig.supportThreshold) {
    return "support";
  }

  if (score.accuracy >= adaptiveConfig.challengeThreshold) {
    return "challenge";
  }

  return "standard";
}

function summarizeRuntime(
  band: AdaptiveBand,
  timerSecondsDelta: number,
  multiplierDelta: number,
  wrongPenaltyEnabled: boolean,
): string {
  const parts = [bandLabel(band)];

  if (timerSecondsDelta > 0) {
    parts.push(`+${timerSecondsDelta}s timer`);
  } else if (timerSecondsDelta < 0) {
    parts.push(`${timerSecondsDelta}s timer`);
  }

  if (multiplierDelta > 0) {
    parts.push(`+${multiplierDelta.toFixed(2)}x scoring`);
  } else if (multiplierDelta < 0) {
    parts.push(`${multiplierDelta.toFixed(2)}x scoring`);
  }

  if (!wrongPenaltyEnabled) {
    parts.push("negative marking softened");
  }

  return parts.join(" • ");
}

export class AdaptiveEngine {
  private config: AdaptiveConfig = DEFAULT_ADAPTIVE_CONFIG;
  private currentBand: AdaptiveBand = "standard";
  private insights: AdaptiveInsight[] = [];

  initialize(gameConfig: GameConfig): void {
    this.config = resolveAdaptiveConfig(gameConfig);
    this.currentBand = "standard";
    this.insights = [];
  }

  prepareLevel(gameConfig: GameConfig, levelIndex: number): { level: LevelConfig; runtime: AdaptiveLevelRuntime } {
    const baseLevel = gameConfig.levels[levelIndex];
    const baseTimer = getLevelTimerConfig(gameConfig, levelIndex);
    const baseMultiplier = getLevelMultiplier(gameConfig, levelIndex);
    const baseWrongPenaltyEnabled = isWrongPenaltyEnabledForLevel(gameConfig, levelIndex);

    const band = this.config.enabled ? this.currentBand : "standard";
    const timerSecondsDelta = this.config.enabled && this.config.adaptTimer
      ? band === "support"
        ? this.config.timerAdjustmentSeconds
        : band === "challenge"
          ? -this.config.timerAdjustmentSeconds
          : 0
      : 0;
    const boundedTimerDelta = clamp(
      timerSecondsDelta,
      -this.config.maxTimerAdjustmentSeconds,
      this.config.maxTimerAdjustmentSeconds,
    );
    const multiplierDelta = this.config.enabled && this.config.adaptScoring
      ? band === "support"
        ? -this.config.multiplierAdjustment
        : band === "challenge"
          ? this.config.multiplierAdjustment
          : 0
      : 0;
    const multiplier = clamp(
      baseMultiplier + multiplierDelta,
      this.config.minimumMultiplier,
      this.config.maximumMultiplier,
    );
    const wrongPenaltyEnabled =
      this.config.enabled && this.config.adaptPenalties && band === "support"
        ? false
        : baseWrongPenaltyEnabled;

    const adaptedLevel =
      this.config.enabled && this.config.adaptContent
        ? adaptLevel(baseLevel, band)
        : { ...baseLevel };

    const runtime: AdaptiveLevelRuntime = {
      levelIndex,
      levelNumber: baseLevel.levelNumber,
      band,
      timerDuration: Math.max(10, baseTimer.duration + boundedTimerDelta),
      timerSecondsDelta: boundedTimerDelta,
      multiplier,
      multiplierDelta,
      wrongPenaltyEnabled,
      summary: summarizeRuntime(band, boundedTimerDelta, multiplierDelta, wrongPenaltyEnabled),
    };

    return {
      level: adaptedLevel,
      runtime,
    };
  }

  recordLevelOutcome(levelNumber: number, result: LevelResult, score: LevelScore): AdaptiveInsight {
    const recommendedNextBand = this.config.enabled
      ? getBandFromPerformance(this.config, result, score)
      : "standard";

    const insight: AdaptiveInsight = {
      levelNumber,
      bandApplied: this.currentBand,
      recommendedNextBand,
      accuracy: score.accuracy,
      completed: result.completed,
      timerSecondsDelta: this.currentBand === "support"
        ? this.config.timerAdjustmentSeconds
        : this.currentBand === "challenge"
          ? -this.config.timerAdjustmentSeconds
          : 0,
      multiplierDelta: this.currentBand === "support"
        ? -this.config.multiplierAdjustment
        : this.currentBand === "challenge"
          ? this.config.multiplierAdjustment
          : 0,
      summary: `${bandLabel(this.currentBand)} finished at ${Math.round(score.accuracy * 100)}% accuracy. Next level: ${bandLabel(recommendedNextBand).toLowerCase()}.`,
    };

    this.insights = [...this.insights, insight];
    this.currentBand = recommendedNextBand;
    return insight;
  }

  getCurrentBand(): AdaptiveBand {
    return this.currentBand;
  }

  getInsights(): AdaptiveInsight[] {
    return [...this.insights];
  }
}

export const adaptiveEngine = new AdaptiveEngine();
