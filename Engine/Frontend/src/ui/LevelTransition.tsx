import type { LevelScore } from "@/core/types";
import { formatDuration } from "@/lib/utils";

interface LevelTransitionProps {
  score: LevelScore;
  currentLevel: number;
  totalLevels: number;
  onNext: () => void;
}

function StarRating({ accuracy }: { accuracy: number }) {
  const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.6 ? 2 : 1;
  return (
    <div className="flex gap-1 justify-center text-2xl">
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= stars ? "opacity-100" : "opacity-25"}>⭐</span>
      ))}
    </div>
  );
}

export function LevelTransition({ score, currentLevel, totalLevels, onNext }: LevelTransitionProps) {
  const isLast = currentLevel >= totalLevels;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-scale-in">
      <div className="bg-white rounded-3xl border border-gray-100 shadow-card-lg p-10 text-center max-w-sm w-full space-y-6">
        {/* Trophy */}
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200 flex items-center justify-center text-4xl">
          {isLast ? "🏆" : "✅"}
        </div>

        <div>
          <p className="eyebrow mb-1">Level {currentLevel} Cleared!</p>
          <h2 className="font-display font-bold text-2xl text-ink">
            {isLast ? "All Levels Done!" : `On to Level ${currentLevel + 1}`}
          </h2>
        </div>

        <StarRating accuracy={score.accuracy} />

        {/* Score breakdown */}
        <div className="bg-gray-50 rounded-2xl p-5 space-y-2.5 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-ink-muted">Level Score</span>
            <span className="font-bold text-ink tabular-nums">{score.levelTotal.toLocaleString()} pts</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-muted">Accuracy</span>
            <span className="font-bold text-ink">{Math.round(score.accuracy * 100)}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-ink-muted">Time</span>
            <span className="font-bold text-ink">{formatDuration(score.timeTaken)}</span>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary btn-lg w-full"
          onClick={onNext}
        >
          {isLast ? "View Results →" : "Next Level →"}
        </button>
      </div>
    </div>
  );
}
