import type { LevelScore } from "@/core/types";
import { formatDuration } from "@/lib/utils";
import { Button } from "./shared/Button";

interface LevelTransitionProps {
  score: LevelScore;
  currentLevel: number;
  totalLevels: number;
  onNext: () => void;
}

export function LevelTransition({ score, currentLevel, totalLevels, onNext }: LevelTransitionProps) {
  return (
    <section className="transition-card accent-card">
      <p className="eyebrow">Level Cleared</p>
      <h2>Level {currentLevel} complete</h2>
      <div className="results-metrics">
        <span>Level Score: {score.levelTotal}</span>
        <span>Accuracy: {Math.round(score.accuracy * 100)}%</span>
        <span>Time: {formatDuration(score.timeTaken)}</span>
      </div>
      <Button onClick={onNext}>{currentLevel >= totalLevels ? "View Results" : "Next Level"}</Button>
    </section>
  );
}
