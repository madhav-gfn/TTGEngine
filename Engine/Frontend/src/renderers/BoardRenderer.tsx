import { useEffect, useState } from "react";
import { CommandEngine } from "@/core/interaction/CommandEngine";
import { boardCommandAdapter, type BoardSession } from "@/core/interaction/adapters";
import {
  getBoardCheckpointPositions,
  getBoardGoal,
  getBoardStart,
  getBoardTaskPositions,
  type BoardLevelConfig,
  type GameRendererProps,
  type InteractionCommand,
} from "@/core/types";
import { useInputCapture } from "@/hooks/useInputCapture";

const boardEngine = new CommandEngine(boardCommandAdapter);

function tileLabel(tile: string): string {
  if (tile === "#") {
    return "Wall";
  }
  if (tile === "G") {
    return "Goal";
  }
  if (tile === "S") {
    return "Start";
  }
  if (tile === "T") {
    return "Task";
  }
  if (tile === "C") {
    return "Checkpoint";
  }
  return "Path";
}

export function BoardRenderer({ config, level, levelIndex, runtime, onAction, onComplete, isPaused }: GameRendererProps) {
  const boardLevel = level as BoardLevelConfig;
  const [session, setSession] = useState<BoardSession>(() =>
    boardEngine.createSession({
      level: boardLevel,
      basePoints: config.scoringConfig.basePoints,
    })
  );
  const [status, setStatus] = useState("Use arrow keys or WASD to move through the board.");
  const tasks = getBoardTaskPositions(boardLevel);
  const checkpoints = getBoardCheckpointPositions(boardLevel);
  const requiredCheckpoints = checkpoints.filter((checkpoint) => checkpoint.required !== false);
  const goal = getBoardGoal(boardLevel);
  const start = getBoardStart(boardLevel);
  const smartboardEnabled = config.uiConfig.smartboard?.enabled;
  const autoScaleBoard = config.uiConfig.smartboard?.autoScaleBoard;
  const progressCount = session.collectedTaskIds.length + session.activatedCheckpointIds.length;
  const progressTotal = tasks.length + requiredCheckpoints.length;

  useEffect(() => {
    setSession(boardEngine.createSession({
      level: boardLevel,
      basePoints: config.scoringConfig.basePoints,
    }));
    setStatus("Use arrow keys or WASD to move through the board.");
  }, [boardLevel, config.scoringConfig.basePoints, config.gameId, levelIndex]);

  function dispatchCommand(command: InteractionCommand): void {
    if (isPaused) {
      return;
    }

    const outcome = boardEngine.dispatch(session, command, {
      level: boardLevel,
      basePoints: config.scoringConfig.basePoints,
    });
    setSession(outcome.session);

    if (outcome.announcement) {
      setStatus(outcome.announcement);
    }
    if (outcome.action) {
      onAction(outcome.action);
    }
    if (outcome.completion && !session.completed) {
      onComplete({
        completed: outcome.completion.completed,
        correctActions: outcome.session.collectedTaskIds.length + outcome.session.activatedCheckpointIds.length,
        wrongActions: 0,
        totalActions: progressTotal,
        hintsUsed: 0,
        metadata: outcome.completion.metadata,
      });
    }
  }

  const captureRef = useInputCapture(!isPaused, config.interactionConfig, dispatchCommand);

  return (
    <section className="renderer-shell board-shell" ref={captureRef} tabIndex={0}>
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Board Runner</p>
          <h3 className="renderer-title">Level {boardLevel.levelNumber}</h3>
        </div>
        <span className="question-tag">
          Progress {progressCount}/{progressTotal}
        </span>
      </div>
      {runtime ? <p className="status-line">{runtime.summary}</p> : null}
      <p className="status-line">{status}</p>
      <div
        className={`board-grid ${smartboardEnabled ? "board-grid-smartboard" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${boardLevel.board[0]?.length ?? 1}, minmax(0, 1fr))`,
          gridAutoRows: autoScaleBoard ? "minmax(clamp(3.25rem, 8vmin, 5.5rem), 1fr)" : undefined,
        }}
      >
        {boardLevel.board.flatMap((row, rowIndex) =>
          row.split("").map((tile, colIndex) => {
            const isPlayer = session.row === rowIndex && session.col === colIndex;
            const isEnemy = session.enemies.some((enemy) => enemy.row === rowIndex && enemy.col === colIndex);
            const isGoal = goal.row === rowIndex && goal.col === colIndex;
            const task = tasks.find((entry) => entry.row === rowIndex && entry.col === colIndex);
            const checkpoint = checkpoints.find((entry) => entry.row === rowIndex && entry.col === colIndex);
            const collected = task ? session.collectedTaskIds.includes(task.id) : false;
            const checkpointReached = checkpoint ? session.activatedCheckpointIds.includes(checkpoint.id) : false;
            const tileDisplay = isPlayer
              ? "P"
              : isEnemy
                ? "E"
                : collected || checkpointReached
                  ? "."
                  : task
                    ? "T"
                    : checkpoint
                      ? "C"
                      : tile === "."
                        ? ""
                        : tile;
            const tileKind = task ? "T" : checkpoint ? "C" : tile;
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={[
                  "board-tile",
                  tile === "#" ? "is-wall" : "",
                  isGoal ? "is-goal" : "",
                  isPlayer ? "is-player" : "",
                  isEnemy ? "is-enemy" : "",
                  collected || checkpointReached ? "is-cleared" : "",
                  smartboardEnabled ? "is-smartboard" : "",
                ].join(" ").trim()}
                aria-label={`${tileLabel(tileKind)} at row ${rowIndex + 1}, column ${colIndex + 1}`}
              >
                <span>{tileDisplay}</span>
              </div>
            );
          }),
        )}
      </div>
      <div className="board-meta">
        <span className="tag-chip">Start {start.row + 1},{start.col + 1}</span>
        <span className="tag-chip">Goal {goal.row + 1},{goal.col + 1}</span>
        <span className="tag-chip">Checkpoints {session.activatedCheckpointIds.length}/{requiredCheckpoints.length}</span>
        <span className="tag-chip">Enemies {session.enemies.length}</span>
        <span className="tag-chip">Hits {session.collisions}</span>
      </div>
      <div className={`board-controls ${config.uiConfig.smartboard?.emphasizeControls ? "board-controls-smartboard" : ""}`}>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "up" })}>
          Up
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "left" })}>
          Left
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "down" })}>
          Down
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "right" })}>
          Right
        </button>
      </div>
    </section>
  );
}
