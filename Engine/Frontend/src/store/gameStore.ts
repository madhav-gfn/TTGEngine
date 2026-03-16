import { create } from "zustand";
import type {
  BackendStatus,
  ConfigError,
  EngineError,
  FinalScore,
  GameConfig,
  GameState,
  GameSummary,
  LeaderboardEntry,
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
