import type { LevelScore } from "@/core/types";
import { formatDuration } from "@/lib/utils";

interface LevelTransitionProps {
  score: LevelScore;
  currentLevel: number;
  totalLevels: number;
  generationStatus?: "idle" | "pending" | "error";
  generationMessage?: string | null;
  onNext: () => void;
}

function StarRating({ accuracy }: { accuracy: number }) {
  const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.6 ? 2 : 1;
  return (
    <div className="flex justify-center gap-1 text-2xl">
      {[1, 2, 3].map((index) => (
        <span key={index} className={index <= stars ? "opacity-100" : "opacity-25"}>*</span>
      ))}
    </div>
  );
}

export function LevelTransition({
  score,
  currentLevel,
  totalLevels,
  generationStatus = "idle",
  generationMessage = null,
  onNext,
}: LevelTransitionProps) {
  const isLast = currentLevel >= totalLevels;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center animate-scale-in">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-card-lg">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100 text-4xl">
          {isLast ? "T" : "+"}
        </div>

        <div>
          <p className="eyebrow mb-1">Level {currentLevel} Cleared!</p>
          <h2 className="font-display text-2xl font-bold text-ink">
            {isLast ? "All Levels Done!" : `On to Level ${currentLevel + 1}`}
          </h2>
        </div>

        <StarRating accuracy={score.accuracy} />

        <div className="space-y-2.5 rounded-2xl bg-gray-50 p-5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Level Score</span>
            <span className="font-bold text-ink tabular-nums">{score.levelTotal.toLocaleString()} pts</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Accuracy</span>
            <span className="font-bold text-ink">{Math.round(score.accuracy * 100)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Time</span>
            <span className="font-bold text-ink">{formatDuration(score.timeTaken)}</span>
          </div>
        </div>

        {generationMessage ? (
          <p className={`text-xs ${generationStatus === "error" ? "text-amber-600" : "text-ink-muted"}`}>
            {generationMessage}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-primary btn-lg w-full disabled:opacity-60"
          onClick={onNext}
          disabled={!isLast && generationStatus === "pending"}
        >
          {isLast ? "View Results ->" : generationStatus === "pending" ? "Generating Next Level..." : "Next Level ->"}
        </button>
      </div>
    </div>
  );
}
