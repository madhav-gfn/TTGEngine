import { z } from "zod";

export const GameTypeSchema = z.enum(["GRID", "WORD", "MCQ", "DRAG_DROP", "BOARD", "PLATFORMER", "MATH", "CUSTOM"]);
export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export const TimerTypeSchema = z.enum(["countdown", "countup"]);
export const TimeBonusFormulaSchema = z.enum(["linear", "exponential", "none"]);

export const TimerConfigSchema = z.object({
  type: TimerTypeSchema,
  duration: z.number().int().min(10).max(3600),
  warningAt: z.array(z.number().int().min(1).max(3600)).min(1).default([30, 10, 5]),
});

export const ScoringConfigSchema = z.object({
  basePoints: z.number().int().min(1).max(10000),
  bonusMultiplier: z.number().min(0.1).max(100).default(1),
  penaltyPerHint: z.number().int().min(0).max(1000).default(0),
  penaltyPerWrong: z.number().int().min(0).max(1000).default(0),
  timeBonusFormula: TimeBonusFormulaSchema.default("none"),
  timeBonusMultiplier: z.number().min(0).max(100).default(1),
});

export const UIConfigSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]).default("system"),
    primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    iconSet: z.string().default("lucide"),
    layout: z.enum(["centered", "fullscreen", "sidebar"]).default("centered"),
    showTimer: z.boolean().default(true),
    showScore: z.boolean().default(true),
    showProgress: z.boolean().default(true),
  })
  .optional();

export const MetadataSchema = z
  .object({
    author: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    tags: z.array(z.string()).min(1),
    targetSkill: z.string().min(1),
    estimatedPlayTime: z.number().int().min(1).max(120),
  })
  .optional();

export const APIConfigSchema = z
  .object({
    leaderboardEndpoint: z.string().min(1),
    scoreSubmitEndpoint: z.string().min(1),
  })
  .optional();

export const GridCellSchema = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  value: z.number().int().min(1).max(16),
});

export const GridLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  gridSize: z.number().int().min(2).max(16),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
  preFilledCells: z.array(GridCellSchema).min(1),
  solution: z.array(z.array(z.number().int())),
  hints: z.array(GridCellSchema).optional(),
});

export const WordEntrySchema = z.object({
  word: z.string().min(1).transform((value) => value.toUpperCase()),
  points: z.number().int().min(1).max(1000),
  difficulty: DifficultySchema,
});

export const WordLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
  availableLetters: z.array(z.string().length(1)).min(3),
  validWords: z.array(WordEntrySchema).min(1),
  bonusWords: z.array(WordEntrySchema).optional(),
  minWordLength: z.number().int().min(2).max(20),
  maxWordLength: z.number().int().min(2).max(20),
});

export const MCQOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const MCQQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(MCQOptionSchema).min(2).max(6),
  correctOptionId: z.string().min(1),
  explanation: z.string().optional(),
  category: z.string().optional(),
  difficulty: DifficultySchema,
});

export const MCQLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
  questions: z.array(MCQQuestionSchema).min(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  negativeMarking: z.boolean().default(false),
});

export const DragItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.string().optional(),
});

export const DropTargetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  acceptsMultiple: z.boolean(),
});

export const DragDropLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
  items: z.array(DragItemSchema).min(1),
  targets: z.array(DropTargetSchema).min(1),
  correctMapping: z.record(z.string()),
});

export const GameConfigSchema = z
  .object({
    gameId: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
    gameType: GameTypeSchema,
    title: z.string().min(2).max(100),
    description: z.string().min(10).max(500),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    difficulty: DifficultySchema,
    levels: z.array(z.any()).min(1),
    timerConfig: TimerConfigSchema,
    scoringConfig: ScoringConfigSchema,
    uiConfig: UIConfigSchema,
    metadata: MetadataSchema,
    apiConfig: APIConfigSchema,
  })
  .superRefine((data, ctx) => {
    const levelSchema = {
      GRID: GridLevelSchema,
      WORD: WordLevelSchema,
      MCQ: MCQLevelSchema,
      DRAG_DROP: DragDropLevelSchema,
      BOARD: z.any(),
      PLATFORMER: z.any(),
      MATH: z.any(),
      CUSTOM: z.any(),
    }[data.gameType];

    data.levels.forEach((level, levelIndex) => {
      const result = levelSchema.safeParse(level);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ["levels", levelIndex, ...issue.path],
          });
        });
      }
    });

    if (data.gameType === "GRID") {
      data.levels.forEach((level: any, levelIndex) => {
        level.preFilledCells?.forEach((cell: any, cellIndex: number) => {
          if (cell.row >= level.gridSize || cell.col >= level.gridSize) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Cell (${cell.row},${cell.col}) is outside ${level.gridSize}x${level.gridSize} grid`,
              path: ["levels", levelIndex, "preFilledCells", cellIndex],
            });
          }
        });
      });
    }

    if (data.gameType === "MCQ") {
      data.levels.forEach((level: any, levelIndex) => {
        level.questions?.forEach((question: any, questionIndex: number) => {
          const optionIds = question.options?.map((option: any) => option.id) ?? [];
          if (!optionIds.includes(question.correctOptionId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `correctOptionId '${question.correctOptionId}' does not match any option id`,
              path: ["levels", levelIndex, "questions", questionIndex, "correctOptionId"],
            });
          }
        });
      });
    }
  });
