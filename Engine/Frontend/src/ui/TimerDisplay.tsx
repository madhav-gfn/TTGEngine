import { useTimer } from "@/hooks/useTimer";

export function TimerDisplay() {
  const { label, isWarning } = useTimer();

  return (
    <div className={`hud-card ${isWarning ? "is-warning" : ""}`.trim()}>
      <span className="hud-label">Timer</span>
      <strong>{label}</strong>
    </div>
  );
}
