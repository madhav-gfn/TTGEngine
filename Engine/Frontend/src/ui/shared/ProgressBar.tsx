interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
}

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));

  return (
    <div className="progress-shell">
      {label ? <div className="progress-label">{label}</div> : null}
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
