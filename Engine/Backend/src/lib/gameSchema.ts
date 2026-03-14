import { z } from "zod";

const DifficultySchema = z.enum(["easy", "medium", "hard"]);
const GameTypeSchema = z.enum(["GRID", "WORD", "MCQ", "DRAG_DROP", "CUSTOM"]);
const TimerSchema = z.object({
  type: z.enum(["countdown", "countup"]),
  duration: z.number().int().min(10).max(3600),
  warningAt: z.array(z.number().int().min(1)).min(1),
});
const ScoringSchema = z.object({
  basePoints: z.number().int().min(1),
  bonusMultiplier: z.number().min(0.1),
  penaltyPerHint: z.number().int().min(0),
  penaltyPerWrong: z.number().int().min(0),
  timeBonusFormula: z.enum(["linear", "exponential", "none"]),
  timeBonusMultiplier: z.number().min(0),
});
const BaseLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
});
const GridLevelSchema = BaseLevelSchema.extend({
  gridSize: z.number().int().min(2).max(16),
  preFilledCells: z.array(z.object({ row: z.number().int(), col: z.number().int(), value: z.number().int() })),
  solution: z.array(z.array(z.number().int())),
  hints: z.array(z.object({ row: z.number().int(), col: z.number().int(), value: z.number().int() })).optional(),
});
const WordLevelSchema = BaseLevelSchema.extend({
  availableLetters: z.array(z.string().length(1)).min(3),
  validWords: z.array(
    z.object({ word: z.string().min(1), points: z.number().int().min(1), difficulty: DifficultySchema }),
  ),
  bonusWords: z
    .array(z.object({ word: z.string().min(1), points: z.number().int().min(1), difficulty: DifficultySchema }))
    .optional(),
  minWordLength: z.number().int().min(2),
  maxWordLength: z.number().int().min(2),
});
const MCQLevelSchema = BaseLevelSchema.extend({
  questions: z.array(
    z.object({
      id: z.string().min(1),
      question: z.string().min(1),
      options: z.array(z.object({ id: z.string().min(1), text: z.string().min(1) })).min(2),
      correctOptionId: z.string().min(1),
      explanation: z.string().optional(),
      category: z.string().optional(),
      difficulty: DifficultySchema,
    }),
  ),
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  negativeMarking: z.boolean(),
});
const DragDropLevelSchema = BaseLevelSchema.extend({
  items: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), category: z.string().optional() })),
  targets: z.array(z.object({ id: z.string().min(1), label: z.string().min(1), acceptsMultiple: z.boolean() })),
  correctMapping: z.record(z.string()),
});

export const GameConfigSchema = z.object({
  gameId: z.string().min(3),
  gameType: GameTypeSchema,
  title: z.string().min(2),
  description: z.string().min(10),
  version: z.string().min(3),
  difficulty: DifficultySchema,
  levels: z.array(z.any()).min(1),
  timerConfig: TimerSchema,
  scoringConfig: ScoringSchema,
  uiConfig: z.any().optional(),
  metadata: z
    .object({
      author: z.string().min(1),
      createdAt: z.string(),
      updatedAt: z.string(),
      tags: z.array(z.string()).default([]),
      targetSkill: z.string().min(1),
      estimatedPlayTime: z.number().int().min(1),
    })
    .optional(),
  apiConfig: z
    .object({
      leaderboardEndpoint: z.string().min(1),
      scoreSubmitEndpoint: z.string().min(1),
    })
    .optional(),
}).superRefine((data, ctx) => {
  const levelSchema = {
    GRID: GridLevelSchema,
    WORD: WordLevelSchema,
    MCQ: MCQLevelSchema,
    DRAG_DROP: DragDropLevelSchema,
    CUSTOM: z.any(),
  }[data.gameType];

  data.levels.forEach((level, index) => {
    const result = levelSchema.safeParse(level);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        ctx.addIssue({
          ...issue,
          path: ["levels", index, ...issue.path],
        });
      });
    }
  });
});

export type GameConfig = z.infer<typeof GameConfigSchema>;

export interface GameSummary {
  gameId: string;
  title: string;
  description: string;
  gameType: GameConfig["gameType"];
  difficulty: GameConfig["difficulty"];
  version: string;
  estimatedPlayTime?: number;
  tags: string[];
}

export function calculateMaxPossibleScore(config: GameConfig): number {
  return config.levels.reduce((sum, level) => {
    const levelMultiplier = level.bonusMultiplier ?? config.scoringConfig.bonusMultiplier ?? 1;
    const duration = level.timeLimit ?? config.timerConfig.duration;
    const timeBonus = config.scoringConfig.timeBonusFormula === "none"
      ? 0
      : duration * config.scoringConfig.timeBonusMultiplier;

    let baseScore = config.scoringConfig.basePoints;

    if ("solution" in level) {
      baseScore =
        level.solution.flat().length * config.scoringConfig.basePoints -
        level.preFilledCells.length * config.scoringConfig.basePoints;
    }

    if ("validWords" in level) {
      baseScore = [...level.validWords, ...(level.bonusWords ?? [])].reduce(
        (points, word) => points + word.points,
        0,
      );
    }

    if ("questions" in level) {
      baseScore = level.questions.length * config.scoringConfig.basePoints;
    }

    if ("items" in level) {
      baseScore = level.items.length * config.scoringConfig.basePoints;
    }

    return sum + Math.floor(baseScore * levelMultiplier + timeBonus);
  }, 0);
}

export function calculateMinimumTimeMs(config: GameConfig): number {
  return config.levels.reduce((sum, level) => {
    if ("solution" in level) {
      return sum + level.gridSize * level.gridSize * 400;
    }

    if ("validWords" in level) {
      return sum + Math.max(4000, level.validWords.length * 1200);
    }

    if ("questions" in level) {
      return sum + Math.max(2500, level.questions.length * 900);
    }

    if ("items" in level) {
      return sum + level.items.length * 900;
    }

    return sum + 2000;
  }, 0);
}
