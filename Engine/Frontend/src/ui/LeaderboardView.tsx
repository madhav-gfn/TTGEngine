import type { LeaderboardEntry } from "@/core/types";
import { formatDuration } from "@/lib/utils";

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  highlightUserId?: string;
}

export function LeaderboardView({ entries, highlightUserId }: LeaderboardViewProps) {
  if (!entries || entries.length === 0) {
    return (
      <div className="empty-state py-8">
        <div className="text-2xl mb-2">📋</div>
        <p className="text-sm">No scores yet. Play a game to appear here!</p>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="grid grid-cols-[28px_1fr_80px_60px] gap-2 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-ink-faint">
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Score</span>
        <span className="text-right">Time</span>
      </div>
      {/* Rows */}
      {entries.map((entry) => {
        const isYou = highlightUserId && entry.userId === highlightUserId;
        return (
          <div
            key={`${entry.userId}-${entry.submittedAt}`}
            className={`grid grid-cols-[28px_1fr_80px_60px] gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${
              isYou
                ? "bg-teal-50 border border-teal-200 font-semibold"
                : entry.rank <= 3
                  ? "bg-amber-50/50"
                  : "hover:bg-gray-50"
            }`}
          >
            <span className="text-center text-base leading-none">
              {entry.rank <= 3
                ? medals[entry.rank - 1]
                : <span className="text-xs font-bold text-ink-faint">#{entry.rank}</span>}
            </span>
            <span className="truncate font-medium text-ink">
              {entry.displayName}
              {isYou && <span className="ml-1.5 text-[10px] text-teal-600 font-bold">YOU</span>}
            </span>
            <span className="text-right font-bold text-ink tabular-nums">{entry.score.toLocaleString()}</span>
            <span className="text-right text-ink-muted tabular-nums">{formatDuration(entry.timeTaken)}</span>
          </div>
        );
      })}
    </div>
  );
}
