import { useEffect, useMemo, useState } from "react";
import type { CustomLevelConfig, GameRendererProps } from "@/core/types";

function normalizeCheckpoints(level: CustomLevelConfig): string[] {
  if (level.checkpoints?.length) {
    return level.checkpoints;
  }

  return [level.objective];
}

export function CustomRenderer({ config, level, runtime, onAction, onComplete, isPaused }: GameRendererProps) {
  const customLevel = level as CustomLevelConfig;
  const checkpoints = useMemo(() => normalizeCheckpoints(customLevel), [customLevel]);
  const [completedCheckpoints, setCompletedCheckpoints] = useState<string[]>([]);
  const [status, setStatus] = useState(customLevel.instruction);

  useEffect(() => {
    setCompletedCheckpoints(runtime?.band === "support" && checkpoints.length > 1 ? [checkpoints[0]] : []);
    setStatus(customLevel.instruction);
  }, [checkpoints, customLevel.instruction, runtime?.band]);

  function toggleCheckpoint(checkpoint: string): void {
    if (isPaused) {
      return;
    }

    setCompletedCheckpoints((current) => {
      const next = current.includes(checkpoint)
        ? current.filter((entry) => entry !== checkpoint)
        : [...current, checkpoint];

      setStatus(`${next.length}/${checkpoints.length} checkpoints completed.`);
      return next;
    });
  }

  function requestHint(): void {
    if (isPaused) {
      return;
    }

    onAction({ type: "hint" });
    setStatus(runtime?.band === "challenge"
      ? "Challenge mode keeps hints minimal. Focus on the objective wording."
      : customLevel.instruction);
  }

  function submitProgress(): void {
    if (isPaused) {
      return;
    }

    const correctActions = completedCheckpoints.length;
    const wrongActions = Math.max(0, checkpoints.length - completedCheckpoints.length);

    if (correctActions > 0) {
      for (let index = 0; index < correctActions; index += 1) {
        onAction({ type: "correct", points: config.scoringConfig.basePoints });
      }
    }

    if (wrongActions > 0) {
      for (let index = 0; index < wrongActions; index += 1) {
        onAction({ type: "wrong" });
      }
    }

    onComplete({
      completed: correctActions === checkpoints.length,
      correctActions,
      wrongActions,
      totalActions: checkpoints.length,
      hintsUsed: 0,
      metadata: {
        objective: customLevel.objective,
        checkpoints: completedCheckpoints,
        adaptiveBand: runtime?.band,
      },
    });
  }

  return (
    <section className="renderer-shell">
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Custom Scenario</p>
          <h3 className="renderer-title">{customLevel.name}</h3>
        </div>
        <span className="question-tag">
          {completedCheckpoints.length}/{checkpoints.length} complete
        </span>
      </div>
      {runtime ? <p className="status-line">{runtime.summary}</p> : null}
      <p className="status-line">{status}</p>
      <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Objective</p>
          <p className="mt-2 text-base font-semibold text-ink">{customLevel.objective}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Instruction</p>
          <p className="mt-2 text-sm text-ink-muted">{customLevel.instruction}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Checkpoints</p>
          {checkpoints.map((checkpoint) => (
            <button
              key={checkpoint}
              type="button"
              className={`option-card ${completedCheckpoints.includes(checkpoint) ? "is-correct" : ""}`.trim()}
              onClick={() => toggleCheckpoint(checkpoint)}
              disabled={isPaused}
            >
              <span>{checkpoint}</span>
              <span className="tag-chip">{completedCheckpoints.includes(checkpoint) ? "done" : "pending"}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="board-controls">
        <button className="btn-secondary" type="button" onClick={requestHint} disabled={isPaused}>
          Hint
        </button>
        <button className="btn-primary" type="button" onClick={submitProgress} disabled={isPaused}>
          Submit Scenario
        </button>
      </div>
      <p className="status-line">{customLevel.successText}</p>
    </section>
  );
}
