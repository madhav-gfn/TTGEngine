import type { GameSummary } from "@/core/types";
import { Button } from "./shared/Button";

interface GameSelectorProps {
  games: GameSummary[];
  onSelect: (gameId: string) => void;
}

export function GameSelector({ games, onSelect }: GameSelectorProps) {
  return (
    <section className="selector-grid">
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
