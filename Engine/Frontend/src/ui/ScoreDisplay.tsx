import { useGameStore } from "@/store/gameStore";
import { useScore } from "@/hooks/useScore";

export function ScoreDisplay() {
  const score = useScore();
  const loopFrame = useGameStore((state) => state.loopFrame);

  return (
    <div className="hud-grid">
      <div className="hud-card">
        <span className="hud-label">Score</span>
        <strong>{score.totalScore}</strong>
      </div>
      <div className="hud-card">
        <span className="hud-label">Accuracy</span>
        <strong>{Math.round(score.accuracy * 100)}%</strong>
      </div>
      <div className="hud-card">
        <span className="hud-label">Loop Frame</span>
        <strong>{loopFrame}</strong>
      </div>
    </div>
  );
}
