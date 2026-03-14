export enum GameType {
  GRID = "GRID",
  WORD = "WORD",
  MCQ = "MCQ",
  DRAG_DROP = "DRAG_DROP",
  CUSTOM = "CUSTOM",
}

export type Difficulty = "easy" | "medium" | "hard";
export type ThemeMode = "light" | "dark" | "system";
export type LayoutMode = "centered" | "fullscreen" | "sidebar";
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

export type LevelConfig =
  | GridLevelConfig
  | WordLevelConfig
  | MCQLevelConfig
  | DragDropLevelConfig;

export interface GameConfig {
  gameId: string;
  gameType: GameType;
  title: string;
  description: string;
  version: string;
  difficulty: Difficulty;
  levels: LevelConfig[];
  timerConfig: TimerConfig;
  scoringConfig: ScoringConfig;
  uiConfig?: UIConfig;
  metadata?: Metadata;
  apiConfig?: APIConfig;
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

export interface ScoreSubmission {
  userId: string;
  gameId: string;
  score: number;
  timeTaken: number;
  level: number;
  metadata: Record<string, unknown>;
}

export interface SubmissionResult {
  success: boolean;
  data?: {
    submissionId: string;
    rank: number;
    totalPlayers: number;
    personalBest: boolean;
  };
  pendingSync?: boolean;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface LeaderboardQuery {
  limit?: number;
  offset?: number;
  difficulty?: Difficulty | "all";
  period?: "daily" | "weekly" | "monthly" | "all";
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

export interface UserRank {
  rank: number | null;
  totalPlayers: number;
}

export interface EngineError {
  code: string;
  message: string;
  details?: unknown;
}

export interface GameRendererProps {
  config: GameConfig;
  levelIndex: number;
  level: LevelConfig;
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
