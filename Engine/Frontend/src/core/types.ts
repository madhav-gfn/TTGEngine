import type {
  CommandAdapter as SharedCommandAdapter,
  Difficulty as SharedDifficulty,
  GameSummary as SharedGameSummary,
  InteractionCommand as SharedInteractionCommand,
  InteractionConfig as SharedInteractionConfig,
  InteractionSession as SharedInteractionSession,
  LeaderboardEntry as SharedLeaderboardEntry,
  LeaderboardPayload as SharedLeaderboardPayload,
  LeaderboardQuery as SharedLeaderboardQuery,
  RuntimeGameConfig as SharedRuntimeGameConfig,
  ScoreSubmission as SharedScoreSubmission,
  ScoreSubmissionResponseData,
  ValidationResult as SharedValidationResult,
} from "@contracts/index";
import {
  GameType as SharedGameType,
  TimeBonusFormula as SharedTimeBonusFormula,
  TimerType as SharedTimerType,
} from "@contracts/index";

export {
  DEFAULT_INTERACTION_CONFIG,
  DEFAULT_UI_CONFIG,
  calculateMaxPossibleScore,
  calculateMinimumTimeMs,
  getBoardGoal,
  getBoardStart,
  getBoardTaskPositions,
  normalizeGameConfig,
  parseGameConfig,
  safeParseGameConfig,
  toGameSummary,
  validateAndNormalizeGameConfig,
} from "@contracts/index";

export type {
  APIConfig,
  AnyGameConfig,
  BindingAction,
  BoardLevelConfig,
  BoardLegendEntry,
  BoardTask,
  CommandOutcome,
  ConfigError,
  DragDropLevelConfig,
  DragItem,
  DropTarget,
  GameConfigV1,
  GameConfigV2,
  GridCell,
  GridLevelConfig,
  InteractionMode,
  LayoutMode,
  LevelConfig,
  MCQLevelConfig,
  MCQOption,
  MCQQuestion,
  Metadata,
  RuntimeGameConfig,
  ScoringConfig,
  ThemeMode,
  TimerConfig,
  UIConfig,
  WordEntry,
  WordLevelConfig,
} from "@contracts/index";

export const GameType = SharedGameType;
export const TimerType = SharedTimerType;
export const TimeBonusFormula = SharedTimeBonusFormula;

export type GameType = SharedGameType;
export type Difficulty = SharedDifficulty;
export type GameConfig = SharedRuntimeGameConfig;
export type GameSummary = SharedGameSummary;
export type ValidationResult<T> = SharedValidationResult<T>;
export type InteractionCommand = SharedInteractionCommand;
export type InteractionConfig = SharedInteractionConfig;
export type InteractionSession = SharedInteractionSession;
export type CommandAdapter<TSession extends SharedInteractionSession = SharedInteractionSession, TContext = unknown> =
  SharedCommandAdapter<TSession, TContext>;

export type GameState =
  | "IDLE"
  | "LOADING"
  | "READY"
  | "PLAYING"
  | "PAUSED"
  | "LEVEL_END"
  | "GAME_OVER"
  | "RESULTS"
  | "ERROR";

export type GameActionType = "correct" | "wrong" | "hint" | "complete";

export interface GameAction {
  type: GameActionType;
  points?: number;
  metadata?: Record<string, unknown>;
}

export interface LevelResult {
  completed: boolean;
  correctActions: number;
  wrongActions: number;
  totalActions: number;
  hintsUsed: number;
  metadata?: Record<string, unknown>;
}

export interface TimerTick {
  elapsed: number;
  remaining: number;
  isWarning: boolean;
  progress: number;
  frame: number;
}

export interface TimerWarning {
  threshold: number;
  remaining: number;
}

export interface LevelScore {
  levelNumber: number;
  baseScore: number;
  timeBonus: number;
  hintPenalty: number;
  wrongPenalty: number;
  multiplier: number;
  levelTotal: number;
  timeTaken: number;
  accuracy: number;
}

export interface FinalScore {
  levelScores: LevelScore[];
  totalScore: number;
  timeTaken: number;
  accuracy: number;
}

export interface ScoreState {
  currentLevel: number;
  totalScore: number;
  correctActions: number;
  wrongActions: number;
  hintsUsed: number;
  totalActions: number;
  currentLevelBase: number;
  currentLevelMultiplier: number;
  levelScores: LevelScore[];
  accuracy: number;
  lastLevelScore?: LevelScore;
}

export type ScoreSubmission = SharedScoreSubmission;
export type LeaderboardQuery = SharedLeaderboardQuery;
export type LeaderboardEntry = SharedLeaderboardEntry;
export type LeaderboardResponse = SharedLeaderboardPayload;

export interface SubmissionResult {
  success: boolean;
  data?: ScoreSubmissionResponseData;
  pendingSync?: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface UserRank {
  rank: number | null;
  totalPlayers: number;
}

export interface EngineError {
  code: string;
  message: string;
  details?: unknown;
}

export interface BackendStatus {
  state: "checking" | "online" | "offline";
  message: string;
}

export interface GameRendererProps {
  config: GameConfig;
  levelIndex: number;
  level: import("@contracts/index").LevelConfig;
  onAction: (action: GameAction) => void;
  onComplete: (result: LevelResult) => void;
  isPaused: boolean;
}

export interface GameFilter {
  category?: string;
  difficulty?: Difficulty;
}

export type EventPayload = {
  "game:load": { gameId: string };
  "game:ready": { config: GameConfig };
  "game:start": { level: number };
  "game:pause": {};
  "game:resume": {};
  "game:action": { action: GameAction; level: number };
  "game:hint": { level: number };
  "timer:tick": TimerTick;
  "timer:warning": TimerWarning;
  "timer:expired": { level: number };
  "score:updated": ScoreState;
  "level:completed": { level: number; result: LevelResult; score: LevelScore };
  "game:over": { finalScore: FinalScore };
  "leaderboard:updated": { gameId: string; leaderboard: LeaderboardEntry[] };
  "error": EngineError;
};

export type EventType = keyof EventPayload;
