interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
}

export function ProgressBar({ value, max, label }: ProgressBarProps) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs text-ink-muted font-medium">
          <span>{label}</span>
          <span>{percent}%</span>
        </div>
      )}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
    </div>
  );
}
