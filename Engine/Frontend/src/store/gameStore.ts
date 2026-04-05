import { create } from "zustand";
import type {
  AdaptiveBand,
  AdaptiveInsight,
  AdaptiveLevelRuntime,
  BackendStatus,
  ConfigError,
  EngineError,
  FinalScore,
  GameConfig,
  GameState,
  GameSummary,
  LeaderboardEntry,
  LevelConfig,
  LevelScore,
  ScoreState,
  SubmissionResult,
  TimerTick,
} from "@/core/types";
import { EMPTY_SCORE_STATE, EMPTY_TIMER_TICK } from "@/lib/constants";

type GameStoreState = {
  availableGames: GameSummary[];
  activeGameId: string | null;
  activeConfig: GameConfig | null;
  sessionLevels: LevelConfig[];
  currentLevelRuntime: AdaptiveLevelRuntime | null;
  adaptiveInsights: AdaptiveInsight[];
  currentAdaptiveBand: AdaptiveBand;
  lifecycleState: GameState;
  currentLevelIndex: number;
  timerTick: TimerTick;
  scoreState: ScoreState;
  levelSummary: LevelScore | null;
  finalScore: FinalScore | null;
  leaderboard: LeaderboardEntry[];
  submissionResult: SubmissionResult | null;
  validationErrors: ConfigError[];
  error: EngineError | null;
  backendStatus: BackendStatus;
  loopFrame: number;
  setAvailableGames: (games: GameSummary[]) => void;
  setActiveGame: (gameId: string | null, config: GameConfig | null) => void;
  setSessionLevels: (levels: LevelConfig[]) => void;
  setSessionLevelAt: (index: number, level: LevelConfig) => void;
  setCurrentLevelRuntime: (runtime: AdaptiveLevelRuntime | null) => void;
  pushAdaptiveInsight: (insight: AdaptiveInsight) => void;
  setAdaptiveBand: (band: AdaptiveBand) => void;
  setLifecycleState: (state: GameState) => void;
  setCurrentLevelIndex: (index: number) => void;
  setTimerTick: (tick: TimerTick) => void;
  setScoreState: (state: ScoreState) => void;
  setLevelSummary: (score: LevelScore | null) => void;
  setFinalScore: (score: FinalScore | null) => void;
  setLeaderboard: (entries: LeaderboardEntry[]) => void;
  setSubmissionResult: (result: SubmissionResult | null) => void;
  setValidationErrors: (errors: ConfigError[]) => void;
  setError: (error: EngineError | null) => void;
  setBackendStatus: (status: BackendStatus) => void;
  resetSession: () => void;
};

export const useGameStore = create<GameStoreState>((set) => ({
  availableGames: [],
  activeGameId: null,
  activeConfig: null,
  sessionLevels: [],
  currentLevelRuntime: null,
  adaptiveInsights: [],
  currentAdaptiveBand: "standard",
  lifecycleState: "IDLE",
  currentLevelIndex: 0,
  timerTick: EMPTY_TIMER_TICK,
  scoreState: EMPTY_SCORE_STATE,
  levelSummary: null,
  finalScore: null,
  leaderboard: [],
  submissionResult: null,
  validationErrors: [],
  error: null,
  backendStatus: {
    state: "checking",
    message: "Checking backend",
  },
  loopFrame: 0,
  setAvailableGames: (games) => set({ availableGames: games }),
  setActiveGame: (gameId, config) =>
    set({
      activeGameId: gameId,
      activeConfig: config,
      sessionLevels: config?.levels ? [...config.levels] : [],
      currentLevelRuntime: null,
      adaptiveInsights: [],
      currentAdaptiveBand: "standard",
      currentLevelIndex: 0,
      timerTick: EMPTY_TIMER_TICK,
      scoreState: EMPTY_SCORE_STATE,
      levelSummary: null,
      finalScore: null,
      leaderboard: [],
      submissionResult: null,
      validationErrors: [],
      error: null,
      loopFrame: 0,
    }),
  setSessionLevels: (sessionLevels) => set({ sessionLevels }),
  setSessionLevelAt: (index, level) =>
    set((state) => ({
      sessionLevels: state.sessionLevels.map((entry, entryIndex) => (entryIndex === index ? level : entry)),
    })),
  setCurrentLevelRuntime: (currentLevelRuntime) => set({ currentLevelRuntime }),
  pushAdaptiveInsight: (insight) => set((state) => ({ adaptiveInsights: [...state.adaptiveInsights, insight] })),
  setAdaptiveBand: (currentAdaptiveBand) => set({ currentAdaptiveBand }),
  setLifecycleState: (state) => set({ lifecycleState: state }),
  setCurrentLevelIndex: (index) => set({ currentLevelIndex: index }),
  setTimerTick: (tick) => set({ timerTick: tick, loopFrame: tick.frame }),
  setScoreState: (state) => set({ scoreState: state }),
  setLevelSummary: (score) => set({ levelSummary: score }),
  setFinalScore: (score) => set({ finalScore: score }),
  setLeaderboard: (entries) => set({ leaderboard: entries }),
  setSubmissionResult: (result) => set({ submissionResult: result }),
  setValidationErrors: (errors) => set({ validationErrors: errors }),
  setError: (error) => set({ error }),
  setBackendStatus: (backendStatus) => set({ backendStatus }),
  resetSession: () =>
    set((state) => ({
      ...state,
      activeGameId: null,
      activeConfig: null,
      sessionLevels: [],
      currentLevelRuntime: null,
      adaptiveInsights: [],
      currentAdaptiveBand: "standard",
      lifecycleState: "IDLE",
      currentLevelIndex: 0,
      timerTick: EMPTY_TIMER_TICK,
      scoreState: EMPTY_SCORE_STATE,
      levelSummary: null,
      finalScore: null,
      leaderboard: [],
      submissionResult: null,
      validationErrors: [],
      error: null,
      loopFrame: 0,
    })),
}));
