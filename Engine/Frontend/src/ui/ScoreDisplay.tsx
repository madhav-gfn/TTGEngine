import { useGameStore } from "@/store/gameStore";
import { useScore } from "@/hooks/useScore";

interface ScoreDisplayProps {
  /** When true, renders compact HUD pills instead of full cards */
  compact?: boolean;
}

export function ScoreDisplay({ compact = false }: ScoreDisplayProps) {
  const score = useScore();
  const loopFrame = useGameStore((s) => s.loopFrame);

  if (compact) {
    return (
      <div className="hud-pill">
        <span className="hud-label">Score</span>
        <span className="hud-value tabular-nums">{score.totalScore.toLocaleString()}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div className="hud-pill">
        <span className="hud-label">Score</span>
        <span className="hud-value tabular-nums">{score.totalScore.toLocaleString()}</span>
      </div>
      <div className="hud-pill">
        <span className="hud-label">Accuracy</span>
        <span className="hud-value">{Math.round(score.accuracy * 100)}%</span>
      </div>
      <div className="hud-pill hidden xl:flex">
        <span className="hud-label">Frame</span>
        <span className="hud-value tabular-nums">{loopFrame}</span>
      </div>
    </div>
  );
}
