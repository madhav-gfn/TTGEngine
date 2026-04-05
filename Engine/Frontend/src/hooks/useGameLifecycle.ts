import { useEffect, useRef } from "react";
import { eventBus } from "@/core/EventBus";
import { gameRegistry } from "@/core/GameRegistry";
import { gameStateMachine } from "@/core/GameStateMachine";
import { leaderboardConnector } from "@/core/LeaderboardConnector";
import { scoreEngine } from "@/core/ScoreEngine";
import { timerEngine } from "@/core/TimerEngine";
import { adaptiveEngine } from "@/core/AdaptiveEngine";
import type { AdaptiveBand, EngineError, GameAction, GameConfig, GameState, LeaderboardQuery, LevelResult } from "@/core/types";
import { EMPTY_TIMER_TICK } from "@/lib/constants";
import { generateGameVariant, generateMidSessionLevel } from "@/lib/gameVariants";
import {
  getOrCreateUserId,
} from "@/lib/utils";
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
  const nextLevelGenerationRef = useRef<Promise<void> | null>(null);

  function resetLifecycleLocks(): void {
    completionLockRef.current = false;
    finalizingRef.current = false;
    nextLevelGenerationRef.current = null;
    useGameStore.getState().setNextLevelGenerationState("idle");
  }

  function serializeLeaderboardKey(gameId: string, options: LeaderboardQuery): string {
    const query = new URLSearchParams();
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined) {
        query.set(key, String(value));
      }
    });
    return `${gameId}?${query.toString()}`;
  }

  useEffect(() => {
    const gameStore = useGameStore.getState();

    void gameRegistry
      .discover()
      .then((games) => {
        gameStore.setAvailableGames(games);
        if (useGameStore.getState().backendStatus.state === "offline" && games.length > 0) {
          useGameStore.getState().setBackendStatus({
            state: "offline",
            message: "Backend offline / using local games",
          });
        }
      })
      .catch((error) => {
        const engineError = toEngineError(error, "DISCOVERY_FAILED");
        gameStore.setError(engineError);
        gameStore.setLifecycleState("ERROR");
      });

    void leaderboardConnector
      .getHealth()
      .then(() => {
        useGameStore.getState().setBackendStatus({
          state: "online",
          message: "Backend online",
        });
      })
      .catch(() => {
        const message = useGameStore.getState().availableGames.length > 0
          ? "Backend offline / using local games"
          : "Backend unavailable";
        useGameStore.getState().setBackendStatus({
          state: "offline",
          message,
        });
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

  function prepareAdaptiveLevel(config: GameConfig, levelIndex: number) {
    const store = useGameStore.getState();
    const baseLevel = store.sessionLevels[levelIndex] ?? config.levels[levelIndex];
    const plan = adaptiveEngine.prepareLevel(config, levelIndex, baseLevel);
    store.setSessionLevelAt(levelIndex, plan.level);
    store.setCurrentLevelRuntime(plan.runtime);
    store.setAdaptiveBand(plan.runtime.band);
    return plan;
  }

  function queueNextLevelGeneration(
    config: GameConfig,
    nextLevelIndex: number,
    band: AdaptiveBand,
    recentAccuracies: number[],
  ): void {
    if (!config.aiConfig?.enabled || nextLevelIndex >= config.levels.length) {
      useGameStore.getState().setNextLevelGenerationState("idle");
      nextLevelGenerationRef.current = null;
      return;
    }

    const store = useGameStore.getState();
    store.setNextLevelGenerationState(
      "pending",
      `Generating level ${nextLevelIndex + 1} in ${band === "challenge" ? "challenge" : band === "support" ? "support" : "balanced"} mode...`,
    );

    const generationPromise = generateMidSessionLevel(config.gameId, config, {
      levelIndex: nextLevelIndex,
      band,
      seed: config.aiConfig.seed
        ? `${config.aiConfig.seed}:${nextLevelIndex}:${store.adaptiveInsights.length}`
        : `${config.gameId}:${nextLevelIndex}:${store.adaptiveInsights.length}`,
      recentAccuracies,
      completedLevels: store.currentLevelIndex + 1,
    });

    let trackedPromise: Promise<void>;
    trackedPromise = generationPromise
      .then(({ level, generation }) => {
        const latestStore = useGameStore.getState();
        if (latestStore.activeGameId !== config.gameId) {
          return;
        }
        latestStore.setSessionLevelAt(nextLevelIndex, level);
        latestStore.pushSessionGenerationLog(generation);
        latestStore.setNextLevelGenerationState("idle");
      })
      .catch((error) => {
        if (useGameStore.getState().activeGameId !== config.gameId) {
          return;
        }
        useGameStore.getState().setNextLevelGenerationState(
          "error",
          error instanceof Error ? error.message : "Level generation failed. Using the base level.",
        );
        pushToast("Next level generation fell back to the base configuration.", "info");
      })
      .finally(() => {
        if (nextLevelGenerationRef.current === trackedPromise) {
          nextLevelGenerationRef.current = null;
        }
      });

    nextLevelGenerationRef.current = trackedPromise;
  }

  async function refreshLeaderboard(gameId?: string, options: LeaderboardQuery = {
    limit: 20,
    offset: 0,
    period: "all",
    difficulty: "all",
  }): Promise<void> {
    const store = useGameStore.getState();
    const activeGameId = gameId ?? store.activeGameId;
    const activeConfig = store.activeConfig;
    if (!activeGameId) {
      return;
    }

    const entries = await leaderboardConnector.getLeaderboard(activeGameId, options, activeConfig ?? undefined);

    useLeaderboardStore.getState().setLeaderboard(serializeLeaderboardKey(activeGameId, options), entries);
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
      const discoveredConfig = await gameRegistry.getGame(gameId);

      if (!discoveredConfig) {
        throw new Error(`Game '${gameId}' could not be found.`);
      }

      const config = discoveredConfig.aiConfig?.enabled
        ? await generateGameVariant(discoveredConfig.gameId, { band: "standard" }).catch(() => discoveredConfig)
        : discoveredConfig;

      adaptiveEngine.initialize(config);
      store.setActiveGame(gameId, config);
      const firstPlan = prepareAdaptiveLevel(config, 0);
      scoreEngine.initialize(config.scoringConfig);
      scoreEngine.startLevel(1, firstPlan.runtime.multiplier, {
        wrongPenaltyEnabled: firstPlan.runtime.wrongPenaltyEnabled,
      });
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
    const levelPlan = store.currentLevelRuntime?.levelIndex === store.currentLevelIndex
      ? {
        level: store.sessionLevels[store.currentLevelIndex] ?? config.levels[store.currentLevelIndex],
        runtime: store.currentLevelRuntime,
      }
      : prepareAdaptiveLevel(config, store.currentLevelIndex);
    scoreEngine.startLevel(levelNumber, levelPlan.runtime.multiplier, {
      wrongPenaltyEnabled: levelPlan.runtime.wrongPenaltyEnabled,
    });
    store.setScoreState(scoreEngine.getState());
    timerEngine.start({
      ...config.timerConfig,
      duration: levelPlan.runtime.timerDuration,
      type: config.timerConfig.type,
    }, levelNumber);
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
      level: store.sessionLevels.length,
      metadata: {
        accuracy: finalScore.accuracy,
        difficulty: config.difficulty,
        levelBreakdown: finalScore.levelScores,
        targetSkill: config.metadata?.targetSkill,
        adaptiveInsights: store.adaptiveInsights,
        generationLog: store.sessionGenerationLog,
      },
    };

    const submissionResult = await leaderboardConnector.submitScore(submission, config);
    store.setSubmissionResult(submissionResult);
    if (submissionResult.pendingSync) {
      pushToast("Score queued locally and will retry on the next session.", "info");
    } else if (submissionResult.success && submissionResult.data?.leaderboardEligible) {
      pushToast("Score submitted to the leaderboard.", "success");
    } else if (submissionResult.success) {
      pushToast("Score saved, but it was not eligible for ranking.", "info");
    } else if (submissionResult.error) {
      pushToast(submissionResult.error.message, "error");
    }

    try {
      await refreshLeaderboard(config.gameId, {
        limit: 20,
        offset: 0,
        period: "all",
        difficulty: "all",
      });
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
    const insight = adaptiveEngine.recordLevelOutcome(levelNumber, result, levelScore);

    store.setLevelSummary(levelScore);
    store.pushAdaptiveInsight(insight);
    store.setAdaptiveBand(insight.recommendedNextBand);
    timerEngine.reset();
    eventBus.emit("level:completed", { level: levelNumber, result, score: levelScore });

    if (store.currentLevelIndex >= config.levels.length - 1) {
      transitionTo("LEVEL_END");
      transitionTo("GAME_OVER");
      void finalizeGame(config);
      return;
    }

    queueNextLevelGeneration(
      config,
      store.currentLevelIndex + 1,
      insight.recommendedNextBand,
      [...store.adaptiveInsights.slice(-2).map((entry) => entry.accuracy), levelScore.accuracy],
    );
    transitionTo("LEVEL_END");
  }

  completeLevelRef.current = completeLevel;

  function nextLevel(): void {
    const store = useGameStore.getState();
    const config = store.activeConfig;
    if (!config || store.lifecycleState !== "LEVEL_END") {
      return;
    }

    void (async () => {
      if (nextLevelGenerationRef.current) {
        await nextLevelGenerationRef.current;
      }

      const latestStore = useGameStore.getState();
      const totalLevels = latestStore.sessionLevels.length || config.levels.length;
      latestStore.setCurrentLevelIndex(Math.min(latestStore.currentLevelIndex + 1, totalLevels - 1));
      latestStore.setLevelSummary(null);
      latestStore.setNextLevelGenerationState("idle");
      startCurrentLevel();
    })();
  }

  function replayGame(): void {
    const store = useGameStore.getState();
    const config = store.activeConfig;
    if (!config) {
      return;
    }

    resetLifecycleLocks();
    timerEngine.reset();
    adaptiveEngine.initialize(config);
    const gameId = store.activeGameId;
    useGameStore.getState().setActiveGame(gameId, config);
    const firstPlan = prepareAdaptiveLevel(config, 0);
    scoreEngine.initialize(config.scoringConfig);
    scoreEngine.startLevel(1, firstPlan.runtime.multiplier, {
      wrongPenaltyEnabled: firstPlan.runtime.wrongPenaltyEnabled,
    });
    useGameStore.getState().setCurrentLevelIndex(0);
    useGameStore.getState().setTimerTick(EMPTY_TIMER_TICK);
    useGameStore.getState().setScoreState(scoreEngine.getState());
    useGameStore.getState().setLevelSummary(null);
    useGameStore.getState().setFinalScore(null);
    useGameStore.getState().setLeaderboard([]);
    useGameStore.getState().setSubmissionResult(null);
    useGameStore.getState().setNextLevelGenerationState("idle");
    useGameStore.getState().setError(null);
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
