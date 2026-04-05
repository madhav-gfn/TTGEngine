import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import type { GameAction, LevelResult } from "@/core/types";
import { RendererFactory } from "@/renderers/RendererFactory";
import { ProgressBar } from "./shared/ProgressBar";
import { TimerDisplay } from "./TimerDisplay";
import { ScoreDisplay } from "./ScoreDisplay";
import { LevelTransition } from "./LevelTransition";
import { ResultsScreen } from "./ResultsScreen";

interface GameContainerProps {
  startCurrentLevel: () => void;
  pauseGame: () => void;
  completeLevel: (result: Partial<LevelResult>) => void;
  nextLevel: () => void;
  submitAction: (action: GameAction) => void;
  replayGame: () => void;
  backToGames: () => void;
  dismissError: () => void;
}

export function GameContainer({
  startCurrentLevel,
  pauseGame,
  completeLevel,
  nextLevel,
  submitAction,
  replayGame,
  backToGames,
  dismissError,
}: GameContainerProps) {
  const activeConfig = useGameStore((s) => s.activeConfig);
  const sessionLevels = useGameStore((s) => s.sessionLevels);
  const currentLevelRuntime = useGameStore((s) => s.currentLevelRuntime);
  const lifecycleState = useGameStore((s) => s.lifecycleState);
  const currentLevelIndex = useGameStore((s) => s.currentLevelIndex);
  const levelSummary = useGameStore((s) => s.levelSummary);
  const finalScore = useGameStore((s) => s.finalScore);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const submissionResult = useGameStore((s) => s.submissionResult);
  const adaptiveInsights = useGameStore((s) => s.adaptiveInsights);
  const error = useGameStore((s) => s.error);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  /* ── Loading ── */
  if (lifecycleState === "LOADING") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-ink-muted">Loading game configuration…</p>
      </div>
    );
  }

  /* ── Error ── */
  if (lifecycleState === "ERROR") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl">⚠️</div>
        <div className="text-center max-w-sm">
          <h2 className="font-display font-bold text-xl text-ink mb-2">{error?.code ?? "Engine Error"}</h2>
          <p className="text-sm text-ink-muted">{error?.message ?? "Something went wrong."}</p>
        </div>
        <button type="button" className="btn-primary" onClick={dismissError}>
          ← Back to Games
        </button>
      </div>
    );
  }

  /* ── No game selected ── */
  if (!activeConfig) {
    return (
      <div className="empty-state min-h-[60vh]">
        <div className="text-4xl mb-4">🎮</div>
        <p className="font-medium text-ink">Select a game from the hub to begin.</p>
      </div>
    );
  }

  /* ── Results screen ── */
  if (lifecycleState === "RESULTS" && finalScore) {
    return (
      <ResultsScreen
        config={activeConfig}
        score={finalScore}
        leaderboard={leaderboard}
        submissionResult={submissionResult}
        adaptiveInsights={adaptiveInsights}
        onReplay={replayGame}
        onBack={backToGames}
      />
    );
  }

  /* ── Level end transition ── */
  if (lifecycleState === "LEVEL_END" && levelSummary) {
    return (
      <LevelTransition
        score={levelSummary}
        currentLevel={currentLevelIndex + 1}
        totalLevels={activeConfig.levels.length}
        onNext={nextLevel}
      />
    );
  }

  const currentLevel = sessionLevels[currentLevelIndex] ?? activeConfig.levels[currentLevelIndex];
  const isPaused = lifecycleState !== "PLAYING";
  const isReady = lifecycleState === "READY";
  const isPausedState = lifecycleState === "PAUSED";
  const smartboardConfig = activeConfig.uiConfig.smartboard;

  async function toggleFullscreen(): Promise<void> {
    if (!smartboardConfig?.allowFullscreen || !shellRef.current) {
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await shellRef.current.requestFullscreen();
  }

  return (
    <div
      ref={shellRef}
      className={`space-y-4 ${smartboardConfig?.enabled ? "smartboard-shell" : ""}`}
      data-smartboard={smartboardConfig?.enabled ? "true" : "false"}
    >
      {/* ── Top HUD Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card px-5 py-3.5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Left: Back + Game info */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn-ghost btn-sm px-2.5 py-1.5 rounded-lg"
              onClick={backToGames}
              aria-label="Back to game hub"
            >
              ← Back
            </button>
            <div className="h-5 w-px bg-gray-200" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
                {activeConfig.gameType.replace("_", " ")}
              </p>
              <h2 className="font-display font-bold text-sm text-ink leading-tight">{activeConfig.title}</h2>
              {currentLevelRuntime ? (
                <p className="text-[11px] text-ink-faint mt-0.5">{currentLevelRuntime.summary}</p>
              ) : null}
            </div>
          </div>

          {/* Center: Level progress */}
          <div className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
            <span className="text-xs">Level</span>
            <span className="font-display font-bold text-ink">
              {currentLevelIndex + 1}
              <span className="text-ink-faint font-normal">/{activeConfig.levels.length}</span>
            </span>
          </div>

          {/* Right: HUD + Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {(activeConfig.uiConfig?.showTimer ?? true) ? <TimerDisplay /> : null}
            {(activeConfig.uiConfig?.showScore ?? true) ? <ScoreDisplay compact /> : null}

            <div className="h-6 w-px bg-gray-200" />

            {smartboardConfig?.enabled && smartboardConfig.allowFullscreen ? (
              <button type="button" className="btn-secondary btn-sm" onClick={() => void toggleFullscreen()}>
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>
            ) : null}

            {lifecycleState === "PLAYING" && (
              <button type="button" className="btn-secondary btn-sm" onClick={pauseGame}>
                ⏸ Pause
              </button>
            )}
            {isPausedState && (
              <button type="button" className="btn-primary btn-sm" onClick={startCurrentLevel}>
                ▶ Resume
              </button>
            )}
            {isReady && (
              <button type="button" className="btn-primary btn-sm" onClick={startCurrentLevel}>
                ▶ Start
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Level progress bar ── */}
      {activeConfig.levels.length > 1 && (
        <ProgressBar
          value={currentLevelIndex + 1}
          max={activeConfig.levels.length}
          label={`Level ${currentLevelIndex + 1} of ${activeConfig.levels.length}`}
        />
      )}

      {/* ── Pause / Ready overlays ── */}
      {isReady ? (
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4 min-h-[300px]">
            <div className="text-center">
              <p className="eyebrow mb-1">Ready?</p>
              <h3 className="font-display font-bold text-2xl text-ink mb-3">{activeConfig.title}</h3>
              <p className="text-sm text-ink-muted max-w-xs">{activeConfig.description}</p>
            </div>
            <button type="button" className="btn-primary btn-lg" onClick={startCurrentLevel}>
              Start Game →
            </button>
          </div>
          {/* Blurred game board behind */}
          <div className="opacity-30 pointer-events-none min-h-[300px]">
            <RendererFactory
              config={activeConfig}
              levelIndex={currentLevelIndex}
              level={currentLevel}
              runtime={currentLevelRuntime}
              onAction={submitAction}
              onComplete={completeLevel}
              isPaused={true}
            />
          </div>
        </div>
      ) : isPausedState ? (
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-white/90 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4 min-h-[300px]">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-3xl">⏸</div>
            <div className="text-center">
              <h3 className="font-display font-bold text-xl text-ink mb-1">Game Paused</h3>
              <p className="text-sm text-ink-muted">Timer and inputs are frozen.</p>
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn-primary btn-lg" onClick={startCurrentLevel}>
                ▶ Resume
              </button>
              <button type="button" className="btn-secondary" onClick={backToGames}>
                Quit
              </button>
            </div>
          </div>
          <div className="opacity-20 pointer-events-none min-h-[300px]">
            <RendererFactory
              config={activeConfig}
              levelIndex={currentLevelIndex}
              level={currentLevel}
              runtime={currentLevelRuntime}
              onAction={submitAction}
              onComplete={completeLevel}
              isPaused={true}
            />
          </div>
        </div>
      ) : (
        /* ── Active game renderer ── */
        <RendererFactory
          config={activeConfig}
          levelIndex={currentLevelIndex}
          level={currentLevel}
          runtime={currentLevelRuntime}
          onAction={submitAction}
          onComplete={(result) => completeLevel(result)}
          isPaused={isPaused}
        />
      )}
    </div>
  );
}
