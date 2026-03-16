import type { ScoreState, TimerTick, UIConfig } from "@/core/types";

export const API_ENDPOINTS = {
  health: "/api/health",
  games: "/api/games",
  score: "/api/score",
  leaderboard: "/api/leaderboard",
} as const;

export const STORAGE_KEYS = {
  userId: "taptap-engine:user-id",
  pendingScores: "taptap-engine:pending-scores",
} as const;

export const EMPTY_TIMER_TICK: TimerTick = {
  elapsed: 0,
  remaining: 0,
  isWarning: false,
  progress: 0,
  frame: 0,
};

export const EMPTY_SCORE_STATE: ScoreState = {
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
};

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

export const APP_THEME = {
  mode: "light",
  primaryColor: "#0f766e",
  secondaryColor: "#f59e0b",
} as const;
