import type { LeaderboardEntry } from "@/core/types";
import { formatDuration } from "@/lib/utils";

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
}

export function LeaderboardView({ entries }: LeaderboardViewProps) {
  if (entries.length === 0) {
    return <p className="empty-state">No leaderboard entries yet. Be the first one on the board.</p>;
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
