import { useEffect, useRef } from "react";
import { eventBus } from "@/core/EventBus";
import { gameRegistry } from "@/core/GameRegistry";
import { gameStateMachine } from "@/core/GameStateMachine";
import { leaderboardConnector } from "@/core/LeaderboardConnector";
import { scoreEngine } from "@/core/ScoreEngine";
import { timerEngine } from "@/core/TimerEngine";
import type { EngineError, GameAction, GameConfig, GameState, LevelResult } from "@/core/types";
import { EMPTY_TIMER_TICK } from "@/lib/constants";
import { getLevelMultiplier, getLevelTimerConfig, getOrCreateUserId } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";
import { useLeaderboardStore } from "@/store/leaderboardStore";
import { useUIStore } from "@/store/uiStore";

function toEngineError(error: unknown, code = "ENGINE_ERROR"): EngineError {
  if (error instanceof Error) {
    return {
      code,
      message: error.message,
    };
  }

  return {
    code,
    message: "An unexpected engine error occurred.",
    details: error,
  };
}

export function useGameLifecycle() {
  const pushToast = useUIStore((state) => state.pushToast);
  const completeLevelRef = useRef<(partial?: Partial<LevelResult>) => void>(() => undefined);
  const completionLockRef = useRef(false);
  const finalizingRef = useRef(false);

  function resetLifecycleLocks(): void {
    completionLockRef.current = false;
    finalizingRef.current = false;
  }

  useEffect(() => {
    const gameStore = useGameStore.getState();

    void gameRegistry
      .discover()
      .then((games) => gameStore.setAvailableGames(games))
      .catch((error) => {
        const engineError = toEngineError(error, "DISCOVERY_FAILED");
        gameStore.setError(engineError);
        gameStore.setLifecycleState("ERROR");
      });

    void leaderboardConnector.flushQueue().catch(() => undefined);

    const unsubscribers = [
      timerEngine.onTick((tick) => {
        useGameStore.getState().setTimerTick(tick);
      }),
      timerEngine.onWarning((warning) => {
        pushToast(`Timer warning: ${Math.ceil(warning.remaining / 1000)}s remaining`, "info");
      }),
      timerEngine.onExpire(() => {
        completeLevelRef.current({
          completed: false,
          metadata: { reason: "timer_expired" },
        });
      }),
      eventBus.on("score:updated", (state) => {
        useGameStore.getState().setScoreState(state);
      }),
      eventBus.on("game:action", ({ action }) => {
        scoreEngine.recordAction(action);
      }),
      eventBus.on("error", (error) => {
        const store = useGameStore.getState();
        store.setError(error);
        store.setLifecycleState("ERROR");
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      timerEngine.reset();
      resetLifecycleLocks();
    };
  }, [pushToast]);

  function transitionTo(next: GameState): void {
    const store = useGameStore.getState();
    const current = store.lifecycleState;

    if (current === next) {
      return;
    }

    try {
      store.setLifecycleState(gameStateMachine.transition(current, next));
    } catch (error) {
      const engineError = toEngineError(error, "INVALID_TRANSITION");
      store.setError(engineError);
      store.setLifecycleState("ERROR");
    }
  }

  async function refreshLeaderboard(gameId?: string): Promise<void> {
    const store = useGameStore.getState();
    const activeGameId = gameId ?? store.activeGameId;
    if (!activeGameId) {
      return;
    }

    const entries = await leaderboardConnector.getLeaderboard(activeGameId, {
      limit: 20,
      offset: 0,
      period: "all",
    });

    useLeaderboardStore.getState().setLeaderboard(activeGameId, entries);
    store.setLeaderboard(entries);
    eventBus.emit("leaderboard:updated", { gameId: activeGameId, leaderboard: entries });
  }

  async function selectGame(gameId: string): Promise<void> {
    const store = useGameStore.getState();

    if (store.lifecycleState !== "IDLE" && store.lifecycleState !== "ERROR") {
      store.resetSession();
    }

    resetLifecycleLocks();

    try {
      transitionTo("LOADING");
      const config = await gameRegistry.getGame(gameId);

      if (!config) {
        throw new Error(`Game '${gameId}' could not be found.`);
      }

      store.setActiveGame(gameId, config);
      scoreEngine.initialize(config.scoringConfig);
      scoreEngine.startLevel(1, getLevelMultiplier(config, 0));
      store.setScoreState(scoreEngine.getState());
      store.setTimerTick(EMPTY_TIMER_TICK);
      eventBus.emit("game:ready", { config });
      transitionTo("READY");
    } catch (error) {
      const engineError = toEngineError(error, "LOAD_FAILED");
      store.setError(engineError);
      store.setLifecycleState("ERROR");
      pushToast(engineError.message, "error");
    }
  }

  function startCurrentLevel(): void {
    const store = useGameStore.getState();
    const config = store.activeConfig;

    if (!config) {
      return;
    }

    if (store.lifecycleState === "PAUSED") {
      timerEngine.resume();
      eventBus.emit("game:resume", {});
      transitionTo("PLAYING");
      return;
    }

    if (store.lifecycleState !== "READY" && store.lifecycleState !== "LEVEL_END") {
      return;
    }

    completionLockRef.current = false;
    finalizingRef.current = false;

    const levelNumber = store.currentLevelIndex + 1;
    scoreEngine.startLevel(levelNumber, getLevelMultiplier(config, store.currentLevelIndex));
    store.setScoreState(scoreEngine.getState());
    timerEngine.start(getLevelTimerConfig(config, store.currentLevelIndex), levelNumber);
    eventBus.emit("game:start", { level: levelNumber });
    transitionTo("PLAYING");
  }

  function pauseGame(): void {
    const store = useGameStore.getState();
    if (store.lifecycleState !== "PLAYING") {
      return;
    }

    timerEngine.pause();
    eventBus.emit("game:pause", {});
    transitionTo("PAUSED");
  }

  function submitAction(action: GameAction): void {
    const store = useGameStore.getState();
    if (store.lifecycleState !== "PLAYING") {
      return;
    }

    eventBus.emit("game:action", {
      action,
      level: store.currentLevelIndex + 1,
    });
  }

  async function finalizeGame(config: GameConfig): Promise<void> {
    if (finalizingRef.current) {
      return;
    }

    finalizingRef.current = true;

    const store = useGameStore.getState();
    const finalScore = scoreEngine.calculateFinalScore();
    store.setFinalScore(finalScore);
    eventBus.emit("game:over", { finalScore });

    const submission = {
      userId: getOrCreateUserId(),
      gameId: config.gameId,
      score: finalScore.totalScore,
      timeTaken: Math.max(0, Math.round(finalScore.timeTaken)),
      level: config.levels.length,
      metadata: {
        accuracy: finalScore.accuracy,
        difficulty: config.difficulty,
        levelBreakdown: finalScore.levelScores,
      },
    };

    const submissionResult = await leaderboardConnector.submitScore(submission);
    if (submissionResult.pendingSync) {
      pushToast("Score queued locally and will retry on the next session.", "info");
    } else if (submissionResult.success) {
      pushToast("Score submitted to the leaderboard.", "success");
    } else if (submissionResult.error) {
      pushToast(submissionResult.error.message, "error");
    }

    try {
      await refreshLeaderboard(config.gameId);
    } catch {
      pushToast("Leaderboard fetch failed, but the run is still complete.", "error");
    }

    const currentState = useGameStore.getState().lifecycleState;
    if (currentState === "GAME_OVER") {
      transitionTo("RESULTS");
    }
  }

  function completeLevel(partial: Partial<LevelResult> = {}): void {
    const store = useGameStore.getState();
    const config = store.activeConfig;

    if (!config || store.lifecycleState !== "PLAYING" || completionLockRef.current) {
      return;
    }

    completionLockRef.current = true;

    const scoreSnapshot = scoreEngine.getState();
    const levelNumber = store.currentLevelIndex + 1;
    const result: LevelResult = {
      completed: partial.completed ?? true,
      correctActions: scoreSnapshot.correctActions,
      wrongActions: scoreSnapshot.wrongActions,
      totalActions: scoreSnapshot.totalActions,
      hintsUsed: scoreSnapshot.hintsUsed,
      metadata: partial.metadata,
    };

    const levelScore = scoreEngine.calculateLevelScore(
      timerEngine.getElapsed(),
      Math.ceil(timerEngine.getRemaining() / 1000),
    );

    store.setLevelSummary(levelScore);
    timerEngine.reset();
    eventBus.emit("level:completed", { level: levelNumber, result, score: levelScore });

    if (store.currentLevelIndex >= config.levels.length - 1) {
      transitionTo("LEVEL_END");
      transitionTo("GAME_OVER");
      void finalizeGame(config);
      return;
    }

    transitionTo("LEVEL_END");
  }

  completeLevelRef.current = completeLevel;

  function nextLevel(): void {
    const store = useGameStore.getState();
    const config = store.activeConfig;
    if (!config || store.lifecycleState !== "LEVEL_END") {
      return;
    }

    store.setCurrentLevelIndex(Math.min(store.currentLevelIndex + 1, config.levels.length - 1));
    store.setLevelSummary(null);
    startCurrentLevel();
  }

  function replayGame(): void {
    const store = useGameStore.getState();
    const config = store.activeConfig;
    if (!config) {
      return;
    }

    resetLifecycleLocks();
    timerEngine.reset();
    scoreEngine.initialize(config.scoringConfig);
    scoreEngine.startLevel(1, getLevelMultiplier(config, 0));
    store.setCurrentLevelIndex(0);
    store.setTimerTick(EMPTY_TIMER_TICK);
    store.setScoreState(scoreEngine.getState());
    store.setLevelSummary(null);
    store.setFinalScore(null);
    store.setLeaderboard([]);
    store.setError(null);
    transitionTo("READY");
  }

  function backToGames(): void {
    resetLifecycleLocks();
    timerEngine.reset();
    useGameStore.getState().resetSession();
  }

  function dismissError(): void {
    backToGames();
  }

  return {
    selectGame,
    startCurrentLevel,
    pauseGame,
    submitAction,
    completeLevel,
    nextLevel,
    replayGame,
    backToGames,
    dismissError,
    refreshLeaderboard,
  };
}
