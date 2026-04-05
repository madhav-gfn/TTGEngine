import { useEffect, useState } from "react";
import type { FinalScore, GameConfig, LeaderboardEntry, LeaderboardQuery, SubmissionResult } from "@/core/types";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { formatDuration } from "@/lib/utils";
import { LeaderboardView } from "./LeaderboardView";

interface ResultsScreenProps {
  config: GameConfig;
  score: FinalScore;
  leaderboard: LeaderboardEntry[];
  submissionResult: SubmissionResult | null;
  onReplay: () => void;
  onBack: () => void;
}

function AnimatedScore({ target }: { target: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const steps = 40;
    const duration = 1200;
    const stepMs = duration / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setDisplayed(Math.round((target * step) / steps));
      if (step >= steps) clearInterval(interval);
    }, stepMs);

    return () => clearInterval(interval);
  }, [target]);

  return <span>{displayed.toLocaleString()}</span>;
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

  const isPersonalBest = submissionResult?.data?.personalBest;

  useEffect(() => {
    setEntries(leaderboard ?? []);
  }, [leaderboard]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void loadLeaderboard(config.gameId, filters, config)
      .then((nextEntries) => {
        if (!cancelled) setEntries(nextEntries);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Failed to load leaderboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [config, filters, loadLeaderboard]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Hero score card ── */}
      <div className={`relative overflow-hidden rounded-3xl p-8 text-center shadow-card-lg ${
        isPersonalBest
          ? "bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white"
          : "bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 text-white"
      }`}>
        {/* decorative element */}
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
        <div className="absolute -bottom-12 -left-8 w-64 h-64 rounded-full bg-white/5" />

        <div className="relative z-10">
          {isPersonalBest && (
            <div className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white/20 rounded-full text-sm font-bold mb-4 backdrop-blur-sm">
              🏆 New Personal Best!
            </div>
          )}
          <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-2">
            Run Complete — {config.title}
          </p>
          <div className="font-display font-black text-6xl sm:text-7xl mb-1">
            <AnimatedScore target={score.totalScore} />
          </div>
          <p className="text-white/60 text-sm">points</p>

          <div className="flex items-center justify-center gap-6 mt-6 text-sm">
            <div className="text-center">
              <p className="text-white/60 text-xs">Accuracy</p>
              <p className="font-bold">{Math.round(score.accuracy * 100)}%</p>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="text-center">
              <p className="text-white/60 text-xs">Time</p>
              <p className="font-bold">{formatDuration(score.timeTaken)}</p>
            </div>
            <div className="w-px h-6 bg-white/20" />
            <div className="text-center">
              <p className="text-white/60 text-xs">Levels</p>
              <p className="font-bold">{score.levelScores.length}</p>
            </div>
          </div>

          {/* Submission status */}
          <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
            {submissionResult?.data?.rank && (
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-sm">
                Rank #{submissionResult.data.rank} of {submissionResult.data.totalPlayers}
              </span>
            )}
            {submissionResult?.pendingSync && (
              <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold backdrop-blur-sm">
                ⏳ Sync pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Level breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
          <h3 className="font-display font-bold text-ink mb-4">📊 Level Breakdown</h3>
          <div className="space-y-2">
            {score.levelScores.map((level, i) => (
              <div key={level.levelNumber} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:bg-gray-50/50 transition-colors">
                <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium text-ink">Level {level.levelNumber}</span>
                <span className="text-sm font-bold text-ink tabular-nums">{level.levelTotal.toLocaleString()} pts</span>
                <span className="text-xs text-ink-muted w-10 text-right">{Math.round(level.accuracy * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <h3 className="font-display font-bold text-ink">🏆 Leaderboard</h3>
            <div className="flex gap-2">
              <select
                className="form-select text-xs py-1.5 px-2.5 min-w-[110px]"
                value={filters.difficulty ?? "all"}
                onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value as LeaderboardQuery["difficulty"] }))}
              >
                <option value="all">All Difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <select
                className="form-select text-xs py-1.5 px-2.5 min-w-[100px]"
                value={filters.period ?? "all"}
                onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value as LeaderboardQuery["period"] }))}
              >
                <option value="all">All Time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>
          {loading && <p className="text-xs text-ink-muted py-2">Refreshing…</p>}
          {loadError && <p className="text-xs text-red-500 py-2">{loadError}</p>}
          <LeaderboardView entries={entries ?? []} />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-center gap-4">
        <button type="button" className="btn-primary btn-lg" onClick={onReplay}>
          🔄 Play Again
        </button>
        <button type="button" className="btn-secondary btn-lg" onClick={onBack}>
          ← Back to Hub
        </button>
      </div>
    </div>
  );
}
