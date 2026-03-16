import { useGameStore } from "@/store/gameStore";
import type { GameAction, LevelResult } from "@/core/types";
import { RendererFactory } from "@/renderers/RendererFactory";
import { ProgressBar } from "./shared/ProgressBar";
import { Button } from "./shared/Button";
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
  const activeConfig = useGameStore((state) => state.activeConfig);
  const lifecycleState = useGameStore((state) => state.lifecycleState);
  const currentLevelIndex = useGameStore((state) => state.currentLevelIndex);
  const levelSummary = useGameStore((state) => state.levelSummary);
  const finalScore = useGameStore((state) => state.finalScore);
  const leaderboard = useGameStore((state) => state.leaderboard);
  const submissionResult = useGameStore((state) => state.submissionResult);
  const error = useGameStore((state) => state.error);

  if (lifecycleState === "LOADING") {
    return <div className="loading-card">Loading game configuration and validating JSON...</div>;
  }

  if (lifecycleState === "ERROR") {
    return (
      <div className="error-panel">
        <h2>{error?.code ?? "Engine Error"}</h2>
        <p>{error?.message ?? "Something went wrong while loading the game."}</p>
        <Button onClick={dismissError}>Back To Games</Button>
      </div>
    );
  }

  if (!activeConfig) {
    return <div className="empty-state">Pick a game from the selector to begin.</div>;
  }

  if (lifecycleState === "RESULTS" && finalScore) {
    return (
      <ResultsScreen
        config={activeConfig}
        score={finalScore}
        leaderboard={leaderboard}
        submissionResult={submissionResult}
        onReplay={replayGame}
        onBack={backToGames}
      />
    );
  }

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

  const currentLevel = activeConfig.levels[currentLevelIndex];

  return (
    <section className="game-surface">
      <div className="game-header">
        <div>
          <p className="eyebrow">{activeConfig.gameType}</p>
          <h2>{activeConfig.title}</h2>
          <p>{activeConfig.description}</p>
        </div>
        <div className="button-row">
          {lifecycleState === "PLAYING" ? <Button onClick={pauseGame}>Pause</Button> : null}
          {lifecycleState === "PAUSED" ? <Button onClick={startCurrentLevel}>Resume</Button> : null}
          {lifecycleState === "READY" ? <Button onClick={startCurrentLevel}>Start Run</Button> : null}
          <Button onClick={backToGames} variant="secondary">
            Exit
          </Button>
        </div>
      </div>
      <ProgressBar
        value={currentLevelIndex + 1}
        max={activeConfig.levels.length}
        label={`Level ${currentLevelIndex + 1} of ${activeConfig.levels.length}`}
      />
      <div className="hud-row">
        {(activeConfig.uiConfig?.showTimer ?? true) ? <TimerDisplay /> : null}
        {(activeConfig.uiConfig?.showScore ?? true) ? <ScoreDisplay /> : null}
      </div>
      <RendererFactory
        config={activeConfig}
        levelIndex={currentLevelIndex}
        level={currentLevel}
        onAction={submitAction}
        onComplete={(result) => completeLevel(result)}
        isPaused={lifecycleState !== "PLAYING"}
      />
      {lifecycleState === "READY" ? (
        <p className="status-line">Preview mode is live. Press Start Run to enter the active engine loop.</p>
      ) : null}
      {lifecycleState === "PAUSED" ? (
        <p className="status-line">The board is paused. Resume to restart timer updates and input processing.</p>
      ) : null}
    </section>
  );
}
