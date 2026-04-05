import { useEffect, useState } from "react";
import { CommandEngine } from "@/core/interaction/CommandEngine";
import {
  dragDropCommandAdapter,
  evaluateDragDropMapping,
  type DragDropSession,
} from "@/core/interaction/adapters";
import type { DragDropLevelConfig, GameRendererProps, InteractionCommand } from "@/core/types";
import { useInputCapture } from "@/hooks/useInputCapture";
import { shuffleArray } from "@/lib/utils";

const dragDropEngine = new CommandEngine(dragDropCommandAdapter);

function buildShuffledLevel(level: DragDropLevelConfig): DragDropLevelConfig {
  return {
    ...level,
    items: shuffleArray(level.items),
    targets: shuffleArray(level.targets),
  };
}

export function DragDropRenderer({ config, level, levelIndex, runtime, onAction, onComplete, isPaused }: GameRendererProps) {
  const dragLevel = level as DragDropLevelConfig;
  const [shuffledLevel, setShuffledLevel] = useState<DragDropLevelConfig>(() => buildShuffledLevel(dragLevel));
  const [session, setSession] = useState<DragDropSession>(() =>
    dragDropEngine.createSession({ level: shuffledLevel }),
  );
  const [status, setStatus] = useState("Drag items into targets or use keyboard pickup/drop.");

  useEffect(() => {
    const nextLevel = buildShuffledLevel(dragLevel);
    setShuffledLevel(nextLevel);
    const nextSession = dragDropEngine.createSession({ level: nextLevel });

    if (runtime?.band === "support" && nextLevel.items[0]) {
      nextSession.mapping[nextLevel.items[0].id] = nextLevel.correctMapping[nextLevel.items[0].id];
    }

    setSession(nextSession);
    setStatus(runtime?.band === "challenge"
      ? "Challenge mode active: no auto-guidance, watch for decoy targets."
      : runtime?.band === "support"
        ? "Support mode placed one item for you. Finish the rest."
        : "Drag items into targets or use keyboard pickup/drop.");
  }, [config.gameId, dragLevel, levelIndex, runtime?.band]);

  function setMapping(itemId: string, targetId: string): void {
    const target = shuffledLevel.targets.find((entry) => entry.id === targetId);
    if (!target) {
      return;
    }

    setSession((current) => {
      if (!target.acceptsMultiple) {
        const occupied = Object.entries(current.mapping).find(([mappedItemId, mappedTargetId]) =>
          mappedItemId !== itemId && mappedTargetId === targetId
        );
        if (occupied) {
          setStatus("That target only accepts one item.");
          return current;
        }
      }

      return {
        ...current,
        heldItemId: null,
        mapping: {
          ...current.mapping,
          [itemId]: targetId,
        },
      };
    });
  }

  function submitMapping() {
    const result = evaluateDragDropMapping(session, shuffledLevel);

    shuffledLevel.items.forEach((item) => {
      if (session.mapping[item.id] === shuffledLevel.correctMapping[item.id]) {
        onAction({ type: "correct", points: config.scoringConfig.basePoints });
      } else {
        onAction({ type: "wrong" });
      }
    });

    onComplete({
      completed: true,
      correctActions: result.correctActions,
      wrongActions: result.wrongActions,
      totalActions: result.totalActions,
      hintsUsed: 0,
      metadata: { mapping: session.mapping },
    });
  }

  function dispatchCommand(command: InteractionCommand): void {
    if (isPaused) {
      return;
    }

    if (command.type === "submit") {
      submitMapping();
      return;
    }

    const outcome = dragDropEngine.dispatch(session, command, { level: shuffledLevel });
    setSession(outcome.session);
    if (outcome.announcement) {
      setStatus(outcome.announcement);
    }
  }

  const captureRef = useInputCapture(!isPaused, config.interactionConfig, dispatchCommand);

  return (
    <section className="renderer-shell" ref={captureRef} tabIndex={0}>
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Drag and Drop</p>
          <h3 className="renderer-title">Level {dragLevel.levelNumber}</h3>
        </div>
        <span className="question-tag">{session.heldItemId ? `Holding ${session.heldItemId}` : "Hybrid input"}</span>
      </div>
      {runtime ? <p className="status-line">{runtime.summary}</p> : null}
      <p className="status-line">{status}</p>
      <p className="status-line">Keyboard: arrow keys move focus, Enter picks up or drops, and the submit button finalizes the mapping.</p>
      <div className="dragdrop-layout">
        <div className="dragdrop-column">
          <h4>Items</h4>
          <div className="dragdrop-stack">
            {shuffledLevel.items.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                draggable={!isPaused}
                className={`drag-card ${session.focusZone === "items" && session.focusIndex === itemIndex ? "is-focused" : ""} ${session.heldItemId === item.id ? "is-held" : ""}`.trim()}
                onClick={() =>
                  setSession((current) => ({
                    ...current,
                    focusZone: "items",
                    focusIndex: itemIndex,
                    heldItemId: item.id,
                  }))
                }
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/plain", item.id);
                  setSession((current) => ({
                    ...current,
                    heldItemId: item.id,
                    focusZone: "items",
                    focusIndex: itemIndex,
                  }));
                }}
                disabled={isPaused}
              >
                <span>{item.label}</span>
                <span className="tag-chip">
                  {runtime?.band === "challenge"
                    ? session.mapping[item.id] ? "mapped" : "hidden"
                    : session.mapping[item.id] ?? "unassigned"}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="dragdrop-column">
          <h4>Targets</h4>
          <div className="dragdrop-stack">
            {shuffledLevel.targets.map((target, targetIndex) => {
              const assignedItems = shuffledLevel.items.filter((item) => session.mapping[item.id] === target.id);
              return (
                <div
                  key={target.id}
                  className={`drop-zone ${session.focusZone === "targets" && session.targetIndex === targetIndex ? "is-focused" : ""}`.trim()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const itemId = event.dataTransfer.getData("text/plain");
                    if (itemId) {
                      setMapping(itemId, target.id);
                    }
                  }}
                  onClick={() =>
                    setSession((current) => ({
                      ...current,
                      focusZone: "targets",
                      targetIndex,
                    }))
                  }
                >
                  <div className="drop-zone-head">
                    <span>{target.label}</span>
                    <span className="tag-chip">{target.acceptsMultiple ? "multi" : "single"}</span>
                  </div>
                  <div className="drop-zone-items">
                    {assignedItems.length > 0 ? assignedItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="dropped-chip"
                        onClick={() =>
                          setSession((current) => ({
                            ...current,
                            heldItemId: item.id,
                            focusZone: "targets",
                            targetIndex,
                          }))
                        }
                      >
                        {item.label}
                      </button>
                    )) : <span className="empty-state">Drop item here</span>}
                  </div>
                  {session.focusZone === "targets" && session.targetIndex === targetIndex && session.heldItemId ? (
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setMapping(session.heldItemId!, target.id)}
                    >
                      Drop Held Item
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <button className="button" type="button" onClick={submitMapping} disabled={isPaused}>
        Submit Mapping
      </button>
    </section>
  );
}
