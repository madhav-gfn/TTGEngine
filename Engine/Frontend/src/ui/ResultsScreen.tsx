import type { FinalScore, LeaderboardEntry } from "@/core/types";
import { formatDuration } from "@/lib/utils";
import { LeaderboardView } from "./LeaderboardView";
import { Button } from "./shared/Button";

interface ResultsScreenProps {
  score: FinalScore;
  leaderboard: LeaderboardEntry[];
  onReplay: () => void;
  onBack: () => void;
}

export function ResultsScreen({ score, leaderboard, onReplay, onBack }: ResultsScreenProps) {
  return (
    <section className="results-grid">
      <div className="results-card accent-card">
        <p className="eyebrow">Run Complete</p>
        <h2>{score.totalScore} points</h2>
        <div className="results-metrics">
          <span>Accuracy: {Math.round(score.accuracy * 100)}%</span>
          <span>Total Time: {formatDuration(score.timeTaken)}</span>
          <span>Levels Cleared: {score.levelScores.length}</span>
        </div>
        <div className="button-row">
          <Button onClick={onReplay}>Replay</Button>
          <Button onClick={onBack} variant="secondary">
            Back To Games
          </Button>
        </div>
      </div>
      <div className="results-card">
        <h3>Level Breakdown</h3>
        <div className="level-breakdown">
          {score.levelScores.map((level) => (
            <div key={level.levelNumber} className="breakdown-row">
              <span>Level {level.levelNumber}</span>
              <span>{level.levelTotal} pts</span>
              <span>{Math.round(level.accuracy * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="results-card results-full">
        <h3>Leaderboard</h3>
        <LeaderboardView entries={leaderboard ?? []} />
      </div>
    </section>
  );
}
