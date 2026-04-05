import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGameStore } from "@/store/gameStore";
import { useGameActions } from "@/core/GameLifecycleContext";
import { GameContainer } from "./GameContainer";

/**
 * GamePage: Loaded at /game/:gameId
 * 
 * If the store already has this game loaded (from PlayerHub), render the container.
 * If the page is accessed directly (e.g., refresh), auto-select the game.
 * If lifecycleState goes back to IDLE (after backToGames), redirect to hub.
 */
export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const lifecycleState = useGameStore((s) => s.lifecycleState);
  const activeGameId = useGameStore((s) => s.activeGameId);
  const { selectGame, startCurrentLevel, pauseGame, completeLevel, nextLevel, submitAction, replayGame, backToGames, dismissError } = useGameActions();
  const navigate = useNavigate();

  // If no game loaded but we have a gameId in URL (e.g., direct navigation), load it
  useEffect(() => {
    if (!gameId) {
      navigate("/", { replace: true });
      return;
    }

    if (lifecycleState === "IDLE" && activeGameId !== gameId) {
      void selectGame(gameId);
    }
  }, [gameId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When back to games is triggered, navigate home
  useEffect(() => {
    if (lifecycleState === "IDLE" && activeGameId === null) {
      navigate("/", { replace: true });
    }
  }, [lifecycleState, activeGameId, navigate]);

  function handleBack() {
    backToGames();
    navigate("/", { replace: true });
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <GameContainer
        startCurrentLevel={startCurrentLevel}
        pauseGame={pauseGame}
        completeLevel={completeLevel}
        nextLevel={nextLevel}
        submitAction={submitAction}
        replayGame={replayGame}
        backToGames={handleBack}
        dismissError={dismissError}
      />
    </div>
  );
}
