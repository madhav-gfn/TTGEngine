import { useGameStore } from "@/store/gameStore";
import { formatDuration } from "@/lib/utils";

export function TimerDisplay() {
  const timerTick = useGameStore((s) => s.timerTick);
  const remaining = timerTick.remaining;
  const elapsed = timerTick.elapsed;
  const isWarning = timerTick.isWarning;

  const displayMs = remaining > 0 ? remaining : elapsed;
  const label = formatDuration(displayMs);

  // Determine timer state for styling
  const remainingSeconds = Math.ceil(remaining / 1000);
  const isCritical = remaining > 0 && remainingSeconds <= 5 && isWarning;
  const isWarnState = remaining > 0 && remainingSeconds <= 15 && isWarning && !isCritical;

  const stateClass = isCritical
    ? "timer-critical"
    : isWarnState
      ? "timer-warning"
      : "timer-normal";

  return (
    <div className={`hud-pill ${stateClass}`}>
      <span className="hud-label">Timer</span>
      <span className="hud-value font-mono">{label}</span>
    </div>
  );
}
