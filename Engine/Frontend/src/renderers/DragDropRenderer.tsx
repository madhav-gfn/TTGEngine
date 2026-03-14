import { useEffect, useState } from "react";
import type { DragDropLevelConfig, GameRendererProps } from "@/core/types";

export function DragDropRenderer({ config, level, levelIndex, onAction, onComplete, isPaused }: GameRendererProps) {
  const dragLevel = level as DragDropLevelConfig;
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    setMapping({});
  }, [config.gameId, levelIndex, dragLevel]);

  function submitMapping() {
    let correctActions = 0;
    let wrongActions = 0;

    dragLevel.items.forEach((item) => {
      if (mapping[item.id] === dragLevel.correctMapping[item.id]) {
        correctActions += 1;
        onAction({ type: "correct", points: config.scoringConfig.basePoints });
      } else {
        wrongActions += 1;
        onAction({ type: "wrong" });
      }
    });

    onComplete({
      completed: true,
      correctActions,
      wrongActions,
      totalActions: dragLevel.items.length,
      hintsUsed: 0,
      metadata: { mapping },
    });
  }

  return (
    <section className="renderer-shell">
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Drag and Drop</p>
          <h3 className="renderer-title">Level {dragLevel.levelNumber}</h3>
        </div>
      </div>
      <div className="mapping-list">
        {dragLevel.items.map((item) => (
          <label key={item.id} className="mapping-row">
            <span>{item.label}</span>
            <select
              value={mapping[item.id] ?? ""}
              onChange={(event) =>
                setMapping((current) => ({
                  ...current,
                  [item.id]: event.target.value,
                }))
              }
              disabled={isPaused}
            >
              <option value="">Choose a target</option>
              {dragLevel.targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <button className="button" type="button" onClick={submitMapping}>
        Submit Mapping
      </button>
    </section>
  );
}
