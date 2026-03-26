import { z } from "zod";

export enum GameType {
  GRID = "GRID",
  WORD = "WORD",
  MCQ = "MCQ",
  DRAG_DROP = "DRAG_DROP",
  BOARD = "BOARD",
  CUSTOM = "CUSTOM",
}

export type Difficulty = "easy" | "medium" | "hard";
export type ThemeMode = "light" | "dark" | "system";
export type LayoutMode = "centered" | "fullscreen" | "sidebar";
export type InteractionMode = "legacy" | "command";
export type InputMode = "keyboard" | "pointer" | "hybrid";
export type Direction = "up" | "down" | "left" | "right";
export type BindingAction =
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "focusNext"
  | "focusPrevious"
  | "select"
  | "submit"
  | "pickup"
  | "drop"
  | "hint"
  | "pause"
  | "backspace";

export enum TimerType {
  COUNTDOWN = "countdown",
  COUNTUP = "countup",
}

export enum TimeBonusFormula {
  LINEAR = "linear",
  EXPONENTIAL = "exponential",
  NONE = "none",
}

export interface TimerConfig {
  type: TimerType;
  duration: number;
  warningAt: number[];
}

export interface ScoringConfig {
  basePoints: number;
  bonusMultiplier: number;
  penaltyPerHint: number;
  penaltyPerWrong: number;
  timeBonusFormula: TimeBonusFormula;
  timeBonusMultiplier: number;
}

export interface UIConfig {
  theme: ThemeMode;
  primaryColor: string;
  secondaryColor?: string;
  iconSet: string;
  layout: LayoutMode;
  showTimer: boolean;
  showScore: boolean;
  showProgress: boolean;
}

export interface Metadata {
  author: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  targetSkill: string;
  estimatedPlayTime: number;
}

export interface APIConfig {
  leaderboardEndpoint: string;
  scoreSubmitEndpoint: string;
}

export interface BaseLevelConfig {
  levelNumber: number;
  timeLimit?: number;
  bonusMultiplier?: number;
}

export interface GridCell {
  row: number;
  col: number;
  value: number;
}

export interface GridLevelConfig extends BaseLevelConfig {
  gridSize: number;
  preFilledCells: GridCell[];
  solution: number[][];
  hints?: GridCell[];
}

export interface WordEntry {
  word: string;
  points: number;
  difficulty: Difficulty;
}

export interface WordLevelConfig extends BaseLevelConfig {
  availableLetters: string[];
  validWords: WordEntry[];
  bonusWords?: WordEntry[];
  minWordLength: number;
  maxWordLength: number;
}

export interface MCQOption {
  id: string;
  text: string;
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: MCQOption[];
  correctOptionId: string;
  explanation?: string;
  category?: string;
  difficulty: Difficulty;
}

export interface MCQLevelConfig extends BaseLevelConfig {
  questions: MCQQuestion[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  negativeMarking: boolean;
}

export interface DragItem {
  id: string;
  label: string;
  category?: string;
}

export interface DropTarget {
  id: string;
  label: string;
  acceptsMultiple: boolean;
}

export interface DragDropLevelConfig extends BaseLevelConfig {
  items: DragItem[];
  targets: DropTarget[];
  correctMapping: Record<string, string>;
}

export interface BoardTask {
  id: string;
  row: number;
  col: number;
  label: string;
}

export interface BoardLegendEntry {
  label: string;
  walkable: boolean;
  variant?: "empty" | "wall" | "start" | "goal" | "task";
}

export interface BoardLevelConfig extends BaseLevelConfig {
  board: string[];
  tasks?: BoardTask[];
  legend?: Record<string, BoardLegendEntry>;
}

export type LevelConfig =
  | GridLevelConfig
  | WordLevelConfig
  | MCQLevelConfig
  | DragDropLevelConfig
  | BoardLevelConfig;

export interface InteractionConfig {
  inputMode: InputMode;
  autoFocus: boolean;
  keybindings?: Partial<Record<BindingAction, string[]>>;
  pointer?: {
    dragEnabled?: boolean;
    touchEnabled?: boolean;
  };
  accessibility?: {
    keyboardDragDrop?: boolean;
    announceCommands?: boolean;
  };
}

export type InteractionCommand =
  | { type: "move"; direction: Direction }
  | { type: "focus"; direction: Direction | "next" | "previous" }
  | { type: "select" }
  | { type: "pickup" }
  | { type: "drop" }
  | { type: "type"; value: string }
  | { type: "backspace" }
  | { type: "submit" }
  | { type: "hint" }
  | { type: "pause" };

export interface InteractionSession {
  focusIndex?: number;
  focusZone?: string;
  heldItemId?: string | null;
  lastCommand?: InteractionCommand["type"];
}

export interface CommandOutcome<TSession extends InteractionSession = InteractionSession> {
  session: TSession;
  handled: boolean;
  announcement?: string;
  action?: {
    type: "correct" | "wrong" | "hint";
    points?: number;
    metadata?: Record<string, unknown>;
  };
  completion?: {
    completed: boolean;
    metadata?: Record<string, unknown>;
  };
}

export interface CommandAdapter<TSession extends InteractionSession = InteractionSession, TContext = unknown> {
  createSession: (context: TContext) => TSession;
  handleCommand: (
    session: TSession,
    command: InteractionCommand,
    context: TContext,
  ) => CommandOutcome<TSession>;
}

export interface GameConfigBase<TGameType extends GameType, TLevel extends LevelConfig> {
  gameId: string;
  gameType: TGameType;
  title: string;
  description: string;
  version: string;
  difficulty: Difficulty;
  levels: TLevel[];
  timerConfig: TimerConfig;
  scoringConfig: ScoringConfig;
  uiConfig?: UIConfig;
  metadata?: Metadata;
  apiConfig?: APIConfig;
}

export type GameConfigV1 =
  | GameConfigBase<GameType.GRID, GridLevelConfig>
  | GameConfigBase<GameType.WORD, WordLevelConfig>
  | GameConfigBase<GameType.MCQ, MCQLevelConfig>
  | GameConfigBase<GameType.DRAG_DROP, DragDropLevelConfig>
  | GameConfigBase<GameType.CUSTOM, LevelConfig>;

export type GameConfigV2 =
  | (GameConfigBase<GameType.BOARD, BoardLevelConfig> & { schemaVersion: 2; interactionConfig?: InteractionConfig })
  | (GameConfigBase<GameType.GRID, GridLevelConfig> & { schemaVersion: 2; interactionConfig?: InteractionConfig })
  | (GameConfigBase<GameType.WORD, WordLevelConfig> & { schemaVersion: 2; interactionConfig?: InteractionConfig })
  | (GameConfigBase<GameType.MCQ, MCQLevelConfig> & { schemaVersion: 2; interactionConfig?: InteractionConfig })
  | (GameConfigBase<GameType.DRAG_DROP, DragDropLevelConfig> & { schemaVersion: 2; interactionConfig?: InteractionConfig })
  | (GameConfigBase<GameType.CUSTOM, LevelConfig> & { schemaVersion: 2; interactionConfig?: InteractionConfig });

export type AnyGameConfig = GameConfigV1 | GameConfigV2;

export interface RuntimeGameConfig extends GameConfigBase<GameType, LevelConfig> {
  schemaVersion: 1 | 2;
  interactionMode: InteractionMode;
  uiConfig: UIConfig;
  interactionConfig: InteractionConfig;
}

export type GameConfig = RuntimeGameConfig;

export interface GameSummary {
  gameId: string;
  title: string;
  description: string;
  gameType: GameType;
  difficulty: Difficulty;
  version: string;
  estimatedPlayTime?: number;
  tags: string[];
}

export interface ConfigError {
  path: string;
  code: string;
  message: string;
  received?: unknown;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ConfigError[] };

export const DEFAULT_UI_CONFIG: UIConfig = {
  theme: "system",
  primaryColor: "#0f766e",
  secondaryColor: "#f59e0b",
  iconSet: "lucide",
  layout: "centered",
  showTimer: true,
  showScore: true,
  showProgress: true,
};

export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  inputMode: "hybrid",
  autoFocus: true,
  keybindings: {},
  pointer: {
    dragEnabled: true,
    touchEnabled: true,
  },
  accessibility: {
    keyboardDragDrop: true,
    announceCommands: true,
  },
};

const DifficultySchema = z.enum(["easy", "medium", "hard"]);
const V1GameTypeSchema = z.enum(["GRID", "WORD", "MCQ", "DRAG_DROP", "CUSTOM"]);
const V2GameTypeSchema = z.enum(["GRID", "WORD", "MCQ", "DRAG_DROP", "BOARD", "CUSTOM"]);
const TimerTypeSchema = z.enum(["countdown", "countup"]);
const TimeBonusFormulaSchema = z.enum(["linear", "exponential", "none"]);

const TimerConfigSchema = z.object({
  type: TimerTypeSchema,
  duration: z.number().int().min(10).max(3600),
  warningAt: z.array(z.number().int().min(1).max(3600)).min(1).default([30, 10, 5]),
});

const ScoringConfigSchema = z.object({
  basePoints: z.number().int().min(1).max(10000),
  bonusMultiplier: z.number().min(0.1).max(100).default(1),
  penaltyPerHint: z.number().int().min(0).max(1000).default(0),
  penaltyPerWrong: z.number().int().min(0).max(1000).default(0),
  timeBonusFormula: TimeBonusFormulaSchema.default("none"),
  timeBonusMultiplier: z.number().min(0).max(100).default(1),
});

const UIConfigSchema = z
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

const MetadataSchema = z
  .object({
    author: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    tags: z.array(z.string()).min(1),
    targetSkill: z.string().min(1),
    estimatedPlayTime: z.number().int().min(1).max(120),
  })
  .optional();

const APIConfigSchema = z
  .object({
    leaderboardEndpoint: z.string().min(1),
    scoreSubmitEndpoint: z.string().min(1),
  })
  .optional();

const InteractionConfigSchema = z
  .object({
    inputMode: z.enum(["keyboard", "pointer", "hybrid"]).default("hybrid"),
    autoFocus: z.boolean().default(true),
    keybindings: z.record(z.array(z.string().min(1)).min(1)).optional(),
    pointer: z
      .object({
        dragEnabled: z.boolean().default(true),
        touchEnabled: z.boolean().default(true),
      })
      .optional(),
    accessibility: z
      .object({
        keyboardDragDrop: z.boolean().default(true),
        announceCommands: z.boolean().default(true),
      })
      .optional(),
  })
  .optional();

const BaseLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
});

const GridCellSchema = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  value: z.number().int().min(1).max(16),
});

const GridLevelSchema = BaseLevelSchema.extend({
  gridSize: z.number().int().min(2).max(16),
  preFilledCells: z.array(GridCellSchema).min(1),
  solution: z.array(z.array(z.number().int())),
  hints: z.array(GridCellSchema).optional(),
});

const WordEntrySchema = z.object({
  word: z.string().min(1).transform((value) => value.toUpperCase()),
  points: z.number().int().min(1).max(1000),
  difficulty: DifficultySchema,
});

const WordLevelSchema = BaseLevelSchema.extend({
  availableLetters: z.array(z.string().length(1)).min(3),
  validWords: z.array(WordEntrySchema).min(1),
  bonusWords: z.array(WordEntrySchema).optional(),
  minWordLength: z.number().int().min(2).max(20),
  maxWordLength: z.number().int().min(2).max(20),
});

const MCQOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

const MCQQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(MCQOptionSchema).min(2).max(6),
  correctOptionId: z.string().min(1),
  explanation: z.string().optional(),
  category: z.string().optional(),
  difficulty: DifficultySchema,
});

const MCQLevelSchema = BaseLevelSchema.extend({
  questions: z.array(MCQQuestionSchema).min(1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  negativeMarking: z.boolean().default(false),
});

const DragItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.string().optional(),
});

const DropTargetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  acceptsMultiple: z.boolean(),
});

const DragDropLevelSchema = BaseLevelSchema.extend({
  items: z.array(DragItemSchema).min(1),
  targets: z.array(DropTargetSchema).min(1),
  correctMapping: z.record(z.string()),
});

const BoardTaskSchema = z.object({
  id: z.string().min(1),
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  label: z.string().min(1),
});

const BoardLegendEntrySchema = z.object({
  label: z.string().min(1),
  walkable: z.boolean().default(true),
  variant: z.enum(["empty", "wall", "start", "goal", "task"]).optional(),
});

const BoardLevelSchema = BaseLevelSchema.extend({
  board: z.array(z.string().min(1)).min(1),
  tasks: z.array(BoardTaskSchema).optional(),
  legend: z.record(BoardLegendEntrySchema).optional(),
}).superRefine((level, ctx) => {
  const width = level.board[0]?.length ?? 0;
  if (width === 0) {
    return;
  }

  let startCount = 0;
  let goalCount = 0;

  level.board.forEach((row, rowIndex) => {
    if (row.length !== width) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "All board rows must have the same width.",
        path: ["board", rowIndex],
      });
    }

    row.split("").forEach((tile, colIndex) => {
      if (!["#", ".", "S", "G", "T"].includes(tile)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported board tile '${tile}'. Use #, ., S, G, or T.`,
          path: ["board", rowIndex, colIndex],
        });
      }
      if (tile === "S") {
        startCount += 1;
      }
      if (tile === "G") {
        goalCount += 1;
      }
    });
  });

  if (startCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Board levels must contain exactly one start tile (S).",
      path: ["board"],
    });
  }

  if (goalCount !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Board levels must contain exactly one goal tile (G).",
      path: ["board"],
    });
  }

  level.tasks?.forEach((task, taskIndex) => {
    if (task.row >= level.board.length || task.col >= width) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Task coordinates must stay inside the board dimensions.",
        path: ["tasks", taskIndex],
      });
    }
  });
});

const BaseGameSchema = z.object({
  gameId: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
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
});

function validateLevels(data: { gameType: string; levels: unknown[] }, ctx: z.RefinementCtx): void {
  const levelSchemaMap = {
    GRID: GridLevelSchema,
    WORD: WordLevelSchema,
    MCQ: MCQLevelSchema,
    DRAG_DROP: DragDropLevelSchema,
    BOARD: BoardLevelSchema,
    CUSTOM: z.any(),
  } as const;

  const levelSchema = levelSchemaMap[data.gameType as keyof typeof levelSchemaMap];

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
}

export const GameConfigV1Schema = BaseGameSchema.extend({
  gameType: V1GameTypeSchema,
}).superRefine((data, ctx) => validateLevels(data, ctx));

export const GameConfigV2Schema = BaseGameSchema.extend({
  schemaVersion: z.literal(2),
  gameType: V2GameTypeSchema,
  interactionConfig: InteractionConfigSchema,
}).superRefine((data, ctx) => validateLevels(data, ctx));

export function safeParseGameConfig(raw: unknown) {
  if (raw && typeof raw === "object" && "schemaVersion" in raw && (raw as { schemaVersion?: unknown }).schemaVersion === 2) {
    return GameConfigV2Schema.safeParse(raw);
  }

  return GameConfigV1Schema.safeParse(raw);
}

export function parseGameConfig(raw: unknown): AnyGameConfig {
  const result = safeParseGameConfig(raw);
  if (!result.success) {
    throw result.error;
  }

  return result.data as AnyGameConfig;
}

export function normalizeGameConfig(config: AnyGameConfig): RuntimeGameConfig {
  const schemaVersion = "schemaVersion" in config ? 2 : 1;
  return {
    ...config,
    schemaVersion,
    interactionMode: schemaVersion === 2 ? "command" : "legacy",
    uiConfig: {
      ...DEFAULT_UI_CONFIG,
      ...(config.uiConfig ?? {}),
    },
    interactionConfig: {
      ...DEFAULT_INTERACTION_CONFIG,
      ...(("interactionConfig" in config ? config.interactionConfig : undefined) ?? {}),
      pointer: {
        ...DEFAULT_INTERACTION_CONFIG.pointer,
        ...(("interactionConfig" in config ? config.interactionConfig?.pointer : undefined) ?? {}),
      },
      accessibility: {
        ...DEFAULT_INTERACTION_CONFIG.accessibility,
        ...(("interactionConfig" in config ? config.interactionConfig?.accessibility : undefined) ?? {}),
      },
    },
  } as RuntimeGameConfig;
}

export function validateAndNormalizeGameConfig(raw: unknown): ValidationResult<RuntimeGameConfig> {
  const result = safeParseGameConfig(raw);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
        received: "received" in issue ? (issue as { received?: unknown }).received : undefined,
      })),
    };
  }

  return {
    success: true,
    data: normalizeGameConfig(result.data as AnyGameConfig),
  };
}

export function toGameSummary(config: RuntimeGameConfig): GameSummary {
  return {
    gameId: config.gameId,
    title: config.title,
    description: config.description,
    gameType: config.gameType,
    difficulty: config.difficulty,
    version: config.version,
    estimatedPlayTime: config.metadata?.estimatedPlayTime,
    tags: config.metadata?.tags ?? [],
  };
}

export function calculateMaxPossibleScore(config: RuntimeGameConfig): number {
  return config.levels.reduce((sum, level) => {
    const levelMultiplier = level.bonusMultiplier ?? config.scoringConfig.bonusMultiplier ?? 1;
    const duration = level.timeLimit ?? config.timerConfig.duration;
    const timeBonus =
      config.scoringConfig.timeBonusFormula === "none"
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

    if ("board" in level) {
      const boardTaskCount =
        level.tasks?.length ?? level.board.join("").split("").filter((tile) => tile === "T").length;
      baseScore = Math.max(1, boardTaskCount) * config.scoringConfig.basePoints;
    }

    return sum + Math.floor(baseScore * levelMultiplier + timeBonus);
  }, 0);
}

export function calculateMinimumTimeMs(config: RuntimeGameConfig): number {
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

    if ("board" in level) {
      const walkableCells = level.board.join("").split("").filter((tile) => tile !== "#").length;
      const taskCount = level.tasks?.length ?? level.board.join("").split("").filter((tile) => tile === "T").length;
      return sum + Math.max(3500, walkableCells * 120 + taskCount * 900);
    }

    return sum + 2000;
  }, 0);
}

export function getBoardTaskPositions(level: BoardLevelConfig): BoardTask[] {
  if (level.tasks && level.tasks.length > 0) {
    return level.tasks;
  }

  const tasks: BoardTask[] = [];

  level.board.forEach((row, rowIndex) => {
    row.split("").forEach((tile, colIndex) => {
      if (tile === "T") {
        tasks.push({
          id: `task-${rowIndex}-${colIndex}`,
          row: rowIndex,
          col: colIndex,
          label: `Task ${tasks.length + 1}`,
        });
      }
    });
  });

  return tasks;
}

export function getBoardStart(level: BoardLevelConfig): { row: number; col: number } {
  for (let row = 0; row < level.board.length; row += 1) {
    const col = level.board[row].indexOf("S");
    if (col >= 0) {
      return { row, col };
    }
  }

  return { row: 0, col: 0 };
}

export function getBoardGoal(level: BoardLevelConfig): { row: number; col: number } {
  for (let row = 0; row < level.board.length; row += 1) {
    const col = level.board[row].indexOf("G");
    if (col >= 0) {
      return { row, col };
    }
  }

  return { row: level.board.length - 1, col: level.board[0]?.length ? level.board[0].length - 1 : 0 };
}
