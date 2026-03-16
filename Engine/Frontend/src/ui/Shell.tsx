import type { CSSProperties } from "react";
import { useGameLifecycle } from "@/hooks/useGameLifecycle";
import { APP_THEME } from "@/lib/constants";
import { useGameStore } from "@/store/gameStore";
import { GameSelector } from "./GameSelector";
import { GameContainer } from "./GameContainer";
import { Toast } from "./shared/Toast";

export function Shell() {
  const actions = useGameLifecycle();
  const availableGames = useGameStore((state) => state.availableGames);
  const lifecycleState = useGameStore((state) => state.lifecycleState);
  const activeConfig = useGameStore((state) => state.activeConfig);
  const backendStatus = useGameStore((state) => state.backendStatus);

  const themeStyle = {
    "--accent-primary": APP_THEME.primaryColor,
    "--accent-secondary": APP_THEME.secondaryColor,
  } as CSSProperties;
  const layoutMode = activeConfig?.uiConfig?.layout ?? "sidebar";

  return (
    <div className={`shell-root layout-${layoutMode}`} style={themeStyle} data-theme={APP_THEME.mode}>
      <header className="shell-header">
        <div>
          <p className="eyebrow">TaPTaP Engine</p>
          <h1>JSON-Driven Learning Games</h1>
        </div>
        <div className="header-badges">
          <span className="tag-chip">State: {lifecycleState}</span>
          <span className="tag-chip">Backend: {backendStatus.message}</span>
          <span className="tag-chip">Engine / Data separated</span>
        </div>
      </header>
      <main className={`shell-layout layout-${layoutMode}`}>
        <section className="shell-main">
          {lifecycleState === "IDLE" ? (
            <>
              <div className="hero-card accent-card">
                <p className="eyebrow">Engine Loop</p>
                <h2>Runtime-loaded games, shared engine core, live loop updates</h2>
                <p>
                  Select any game below. The frontend fetches its JSON at runtime, validates it,
                  normalizes v1 and v2 configs, starts the engine lifecycle, and runs the timer/input/update loop live.
                </p>
              </div>
              <GameSelector
                games={availableGames}
                backendMessage={backendStatus.message}
                onSelect={(gameId) => void actions.selectGame(gameId)}
              />
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
        {layoutMode !== "fullscreen" ? (
          <aside className="shell-aside">
            <div className="aside-card">
              <p className="eyebrow">Architecture</p>
              <h3>Engine Core</h3>
              <ul>
                <li>Registry discovers games through the backend manifest.</li>
                <li>Shared contracts normalize v1 and v2 JSON before render.</li>
                <li>Command-driven input now powers keyboard, pointer, and hybrid flows.</li>
                <li>Leaderboard API stays outside the frontend runtime.</li>
              </ul>
            </div>
            {activeConfig ? (
              <div className="aside-card">
                <p className="eyebrow">Active Config</p>
                <h3>{activeConfig.title}</h3>
                <p>{activeConfig.metadata?.targetSkill ?? "Skill-driven gameplay"}</p>
                <div className="tag-row">
                  <span className="tag-chip">Schema v{activeConfig.schemaVersion}</span>
                  <span className="tag-chip">{activeConfig.interactionMode}</span>
                  {(activeConfig.metadata?.tags ?? []).map((tag) => (
                    <span key={tag} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>
        ) : null}
      </main>
      <Toast />
    </div>
  );
}
