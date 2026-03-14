import type { LeaderboardEntry } from "@/core/types";
import { formatDuration } from "@/lib/utils";

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardView({ entries }: LeaderboardViewProps) {
  if (!entries || entries.length === 0) {
    return (
      <p className="empty-state">
        No leaderboard entries available. Play a game and submit your score to appear here.
      </p>
    );
  }

  return (
    <div className="leaderboard-table">
      <div className="leaderboard-row leaderboard-head">
        <span>Rank</span>
        <span>Player</span>
        <span>Score</span>
        <span>Time</span>
      </div>
      {entries.map((entry) => (
        <div key={`${entry.userId}-${entry.submittedAt}`} className="leaderboard-row">
          <span>#{entry.rank}</span>
          <span>{entry.displayName}</span>
          <span>{entry.score}</span>
          <span>{formatDuration(entry.timeTaken)}</span>
        </div>
      ))}
    </div>
  );
}
