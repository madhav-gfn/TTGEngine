import type {
  AdaptiveBand as SharedAdaptiveBand,
  CommandAdapter as SharedCommandAdapter,
  Difficulty as SharedDifficulty,
  GameSummary as SharedGameSummary,
  InteractionCommand as SharedInteractionCommand,
  InteractionConfig as SharedInteractionConfig,
  InteractionSession as SharedInteractionSession,
  LevelConfig as SharedLevelConfig,
  RuntimeGameConfig as SharedRuntimeGameConfig,
  ValidationResult as SharedValidationResult,
} from "./gameSchema";
import {
  DEFAULT_INTERACTION_CONFIG,
  DEFAULT_UI_CONFIG,
  GameType as SharedGameType,
  TimeBonusFormula as SharedTimeBonusFormula,
  TimerType as SharedTimerType,
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
} from "./gameSchema";

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
} from "./gameSchema";

export type {
  APIConfig,
  AIConfig,
  AnyGameConfig,
  AdaptiveBand,
  AdaptiveConfig,
  BindingAction,
  BoardEnemy,
  BoardLevelConfig,
  BoardLegendEntry,
  BoardTask,
  CommandOutcome,
  ConfigError,
  CustomLevelConfig,
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
  SmartboardConfig,
  ThemeMode,
  TimerConfig,
  UIConfig,
  WordEntry,
  WordLevelConfig,
} from "./gameSchema";

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

export interface AdaptiveLevelRuntime {
  levelIndex: number;
  levelNumber: number;
  band: SharedAdaptiveBand;
  timerDuration: number;
  timerSecondsDelta: number;
  multiplier: number;
  multiplierDelta: number;
  wrongPenaltyEnabled: boolean;
  summary: string;
}

export interface AdaptiveInsight {
  levelNumber: number;
  bandApplied: SharedAdaptiveBand;
  recommendedNextBand: SharedAdaptiveBand;
  accuracy: number;
  completed: boolean;
  timerSecondsDelta: number;
  multiplierDelta: number;
  summary: string;
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

export interface ScoreSubmission {
  userId: string;
  gameId: string;
  score: number;
  timeTaken: number;
  level: number;
  metadata: Record<string, unknown>;
}

export interface ScoreSubmissionResponseData {
  submissionId: string;
  rank: number;
  totalPlayers: number;
  personalBest: boolean;
  leaderboardEligible: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  timeTaken: number;
  submittedAt: string;
}

export interface LeaderboardResponse {
  gameId: string;
  totalEntries: number;
  leaderboard: LeaderboardEntry[];
}

export interface LeaderboardQuery {
  limit?: number;
  offset?: number;
  difficulty?: Difficulty | "all";
  period?: "daily" | "weekly" | "monthly" | "all";
}

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
  level: SharedLevelConfig;
  runtime?: AdaptiveLevelRuntime | null;
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
