import type { GameSummary } from "@/core/types";
import { Button } from "./shared/Button";

interface GameSelectorProps {
  games: GameSummary[];
  backendMessage: string;
  onSelect: (gameId: string) => void;
}

export function GameSelector({ games, backendMessage, onSelect }: GameSelectorProps) {
  if (games.length === 0) {
    return (
      <section className="selector-grid">
        <article className="game-card empty-selector-card">
          <div>
            <p className="eyebrow">Game Catalogue</p>
            <h3>No games are visible yet</h3>
            <p>
              {backendMessage.includes("offline")
                ? "The backend is offline and no local game configs could be loaded."
                : "The engine did not receive any game definitions from the current source."}
            </p>
          </div>
          <div className="game-card-meta">
            <span>{backendMessage}</span>
            <span>Check the JSON configs or backend API</span>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="selector-grid">
      <article className="catalogue-card">
        <div>
          <p className="eyebrow">Game Catalogue</p>
          <h3>{games.length} games ready</h3>
          <p>Choose a game to launch the shared engine runtime.</p>
        </div>
        <span className="tag-chip">{backendMessage}</span>
      </article>
      {games.map((game) => (
        <article key={game.gameId} className="game-card">
          <div>
            <p className="eyebrow">{game.gameType}</p>
            <h3>{game.title}</h3>
            <p>{game.description}</p>
          </div>
          <div className="game-card-meta">
            <span>{game.difficulty}</span>
            <span>{game.estimatedPlayTime ?? 0} min</span>
          </div>
          <div className="tag-row">
            {game.tags.map((tag) => (
              <span key={tag} className="tag-chip">
                {tag}
              </span>
            ))}
          </div>
          <Button onClick={() => onSelect(game.gameId)}>Load Game</Button>
        </article>
      ))}
    </section>
  );
}
