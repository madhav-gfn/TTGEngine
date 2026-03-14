import type { CSSProperties } from "react";
import { useGameLifecycle } from "@/hooks/useGameLifecycle";
import { useGameStore } from "@/store/gameStore";
import { GameSelector } from "./GameSelector";
import { GameContainer } from "./GameContainer";
import { Toast } from "./shared/Toast";

export function Shell() {
  const actions = useGameLifecycle();
  const availableGames = useGameStore((state) => state.availableGames);
  const lifecycleState = useGameStore((state) => state.lifecycleState);
  const activeConfig = useGameStore((state) => state.activeConfig);

  const themeStyle = {
    "--accent-primary": activeConfig?.uiConfig?.primaryColor ?? "#0f766e",
    "--accent-secondary": activeConfig?.uiConfig?.secondaryColor ?? "#f59e0b",
  } as CSSProperties;

  return (
    <div className="shell-root" style={themeStyle}>
      <header className="shell-header">
        <div>
          <p className="eyebrow">TaPTaP Engine</p>
          <h1>JSON-Driven Learning Games</h1>
        </div>
        <div className="header-badges">
          <span className="tag-chip">State: {lifecycleState}</span>
          <span className="tag-chip">Engine / Data separated</span>
        </div>
      </header>
      <main className="shell-layout">
        <section className="shell-main">
          {lifecycleState === "IDLE" ? (
            <>
              <div className="hero-card accent-card">
                <p className="eyebrow">Engine Loop</p>
                <h2>Runtime-loaded games, shared engine core, live loop updates</h2>
                <p>
                  Select any game below. The frontend fetches its JSON at runtime, validates it,
                  starts the engine lifecycle, and runs the timer/input/update/render loop live.
                </p>
              </div>
              <GameSelector games={availableGames} onSelect={(gameId) => void actions.selectGame(gameId)} />
            </>
          ) : (
            <GameContainer
              startCurrentLevel={actions.startCurrentLevel}
              pauseGame={actions.pauseGame}
              completeLevel={actions.completeLevel}
              nextLevel={actions.nextLevel}
              submitAction={actions.submitAction}
              replayGame={actions.replayGame}
              backToGames={actions.backToGames}
              dismissError={actions.dismissError}
            />
          )}
        </section>
        <aside className="shell-aside">
          <div className="aside-card">
            <p className="eyebrow">Architecture</p>
            <h3>Engine Core</h3>
            <ul>
              <li>Registry discovers games through the backend manifest.</li>
              <li>Config loader validates JSON before render.</li>
              <li>Timer and score engines emit live state updates.</li>
              <li>Leaderboard API stays outside the frontend runtime.</li>
            </ul>
          </div>
          {activeConfig ? (
            <div className="aside-card">
              <p className="eyebrow">Active Config</p>
              <h3>{activeConfig.title}</h3>
              <p>{activeConfig.metadata?.targetSkill ?? "Skill-driven gameplay"}</p>
              <div className="tag-row">
                {(activeConfig.metadata?.tags ?? []).map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </main>
      <Toast />
    </div>
  );
}
