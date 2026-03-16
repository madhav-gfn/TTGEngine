import { useEffect, useState } from "react";
import type { FinalScore, GameConfig, LeaderboardEntry, LeaderboardQuery, SubmissionResult } from "@/core/types";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatDuration } from "@/lib/utils";
import { LeaderboardView } from "./LeaderboardView";
import { Button } from "./shared/Button";

interface ResultsScreenProps {
  config: GameConfig;
  score: FinalScore;
  leaderboard: LeaderboardEntry[];
  submissionResult: SubmissionResult | null;
  onReplay: () => void;
  onBack: () => void;
}

export function ResultsScreen({
  config,
  score,
  leaderboard,
  submissionResult,
  onReplay,
  onBack,
}: ResultsScreenProps) {
  const { loadLeaderboard } = useLeaderboard();
  const [filters, setFilters] = useState<LeaderboardQuery>({
    difficulty: "all",
    period: "all",
    limit: 20,
    offset: 0,
  });
  const [entries, setEntries] = useState(leaderboard ?? []);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(leaderboard ?? []);
  }, [leaderboard]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void loadLeaderboard(config.gameId, filters, config)
      .then((nextEntries) => {
        if (!cancelled) {
          setEntries(nextEntries);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Failed to load leaderboard.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [config, filters, loadLeaderboard]);

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
        <div className="submission-status">
          <span className="tag-chip">
            {submissionResult?.pendingSync
              ? "Pending sync"
              : submissionResult?.data?.leaderboardEligible === false
                ? "Saved / not ranked"
                : submissionResult?.success
                  ? "Ranked submission"
                  : "Submission pending"}
          </span>
          {submissionResult?.data ? (
            <>
              <span className="tag-chip">Rank #{submissionResult.data.rank || "-"}</span>
              <span className="tag-chip">Players {submissionResult.data.totalPlayers}</span>
              <span className="tag-chip">{submissionResult.data.personalBest ? "Personal best" : "Run saved"}</span>
            </>
          ) : null}
          {submissionResult?.error ? <p className="status-line">{submissionResult.error.message}</p> : null}
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
        <div className="renderer-toolbar">
          <div>
            <h3>Leaderboard</h3>
            <p className="status-line">Filters are applied directly against the backend leaderboard API.</p>
          </div>
          <div className="leaderboard-filters">
            <label>
              <span className="sr-only">Difficulty filter</span>
              <select
                value={filters.difficulty ?? "all"}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    difficulty: event.target.value as LeaderboardQuery["difficulty"],
                  }))
                }
              >
                <option value="all">All difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Period filter</span>
              <select
                value={filters.period ?? "all"}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    period: event.target.value as LeaderboardQuery["period"],
                  }))
                }
              >
                <option value="all">All time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
        </div>
        {loading ? <p className="status-line">Refreshing leaderboard...</p> : null}
        {loadError ? <p className="status-line">{loadError}</p> : null}
        <LeaderboardView entries={entries ?? []} />
      </div>
    </section>
  );
}
