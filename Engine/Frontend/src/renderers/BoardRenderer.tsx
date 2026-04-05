import { useEffect, useMemo, useState } from "react";
import { CommandEngine } from "@/core/interaction/CommandEngine";
import { boardCommandAdapter, type BoardSession } from "@/core/interaction/adapters";
import {
  getBoardGoal,
  getBoardStart,
  getBoardTaskPositions,
  type BoardLevelConfig,
  type BoardTask,
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
  return "Path";
}

function getBoardInstruction(level: BoardLevelConfig): string {
  return level.movementStyle === "platformer"
    ? "Use left and right to run, up to jump, and down to drop through the lane."
    : "Use arrow keys or WASD to move through the board.";
}

function summarizeTask(task: BoardTask): string {
  if (!task.challenge) {
    return task.label;
  }

  return `${task.label}: ${task.challenge.category ?? "reasoning"} challenge`;
}

export function BoardRenderer({ config, level, levelIndex, runtime, onAction, onComplete, isPaused }: GameRendererProps) {
  const boardLevel = level as BoardLevelConfig;
  const [session, setSession] = useState<BoardSession>(() =>
    boardEngine.createSession({
      level: boardLevel,
      basePoints: config.scoringConfig.basePoints,
    })
  );
  const [status, setStatus] = useState(getBoardInstruction(boardLevel));
  const [activeChallengeTaskId, setActiveChallengeTaskId] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [challengeFeedback, setChallengeFeedback] = useState<string | null>(null);
  const tasks = useMemo(() => getBoardTaskPositions(boardLevel), [boardLevel]);
  const goal = getBoardGoal(boardLevel);
  const start = getBoardStart(boardLevel);
  const smartboardEnabled = config.uiConfig.smartboard?.enabled;
  const autoScaleBoard = config.uiConfig.smartboard?.autoScaleBoard;
  const activeChallengeTask = tasks.find((task) => task.id === activeChallengeTaskId) ?? null;
  const movementStyle = boardLevel.movementStyle ?? "maze";

  useEffect(() => {
    setSession(boardEngine.createSession({
      level: boardLevel,
      basePoints: config.scoringConfig.basePoints,
    }));
    setStatus(getBoardInstruction(boardLevel));
    setActiveChallengeTaskId(null);
    setSelectedOptionId(null);
    setChallengeFeedback(null);
  }, [boardLevel, config.scoringConfig.basePoints, config.gameId, levelIndex]);

  useEffect(() => {
    const currentTask = tasks.find((task) =>
      task.row === session.row &&
      task.col === session.col &&
      task.challenge &&
      !session.collectedTaskIds.includes(task.id),
    );

    if (!currentTask) {
      if (activeChallengeTaskId) {
        setActiveChallengeTaskId(null);
        setSelectedOptionId(null);
        setChallengeFeedback(null);
      }
      return;
    }

    if (activeChallengeTaskId !== currentTask.id) {
      setActiveChallengeTaskId(currentTask.id);
      setSelectedOptionId(currentTask.challenge?.options[0]?.id ?? null);
      setChallengeFeedback(null);
      setStatus(`Solve ${summarizeTask(currentTask)} to claim the checkpoint.`);
    }
  }, [activeChallengeTaskId, session.col, session.collectedTaskIds, session.row, tasks]);

  function finalizeRun(nextSession: BoardSession, metadata?: Record<string, unknown>): void {
    onComplete({
      completed: nextSession.completed,
      correctActions: nextSession.collectedTaskIds.length,
      wrongActions: nextSession.collisions,
      totalActions: tasks.length,
      hintsUsed: 0,
      metadata: {
        collectedTaskIds: nextSession.collectedTaskIds,
        movementStyle,
        ...metadata,
      },
    });
  }

  function dispatchCommand(command: InteractionCommand): void {
    if (isPaused || activeChallengeTask) {
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
      finalizeRun(outcome.session, outcome.completion.metadata);
    }
  }

  function submitChallenge(): void {
    if (!activeChallengeTask?.challenge || !selectedOptionId) {
      return;
    }

    const isCorrect = selectedOptionId === activeChallengeTask.challenge.correctOptionId;
    if (!isCorrect) {
      onAction({
        type: "wrong",
        metadata: {
          taskId: activeChallengeTask.id,
          category: activeChallengeTask.challenge.category,
          reason: "challenge_wrong_answer",
        },
      });
      setChallengeFeedback(activeChallengeTask.challenge.explanation ?? "Incorrect. Try again and recalculate.");
      setStatus(`Challenge not solved yet at ${activeChallengeTask.label}.`);
      return;
    }

    const nextCollectedTaskIds = session.collectedTaskIds.includes(activeChallengeTask.id)
      ? session.collectedTaskIds
      : [...session.collectedTaskIds, activeChallengeTask.id];
    const completed =
      session.row === goal.row &&
      session.col === goal.col &&
      nextCollectedTaskIds.length === tasks.length;
    const nextSession: BoardSession = {
      ...session,
      collectedTaskIds: nextCollectedTaskIds,
      completed,
    };

    setSession(nextSession);
    setActiveChallengeTaskId(null);
    setSelectedOptionId(null);
    setChallengeFeedback(null);
    setStatus(activeChallengeTask.challenge.explanation ?? `${activeChallengeTask.label} cleared.`);

    onAction({
      type: "correct",
      points: activeChallengeTask.challenge.points ?? config.scoringConfig.basePoints,
      metadata: {
        taskId: activeChallengeTask.id,
        category: activeChallengeTask.challenge.category,
        reason: "challenge_correct_answer",
      },
    });

    if (completed) {
      finalizeRun(nextSession, {
        challengeTaskId: activeChallengeTask.id,
      });
    }
  }

  const captureRef = useInputCapture(!isPaused && !activeChallengeTask, config.interactionConfig, dispatchCommand);

  return (
    <section className="renderer-shell board-shell" ref={captureRef} tabIndex={0}>
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">{movementStyle === "platformer" ? "Platformer Runner" : "Board Runner"}</p>
          <h3 className="renderer-title">Level {boardLevel.levelNumber}</h3>
        </div>
        <span className="question-tag">
          Tasks {session.collectedTaskIds.length}/{tasks.length}
        </span>
      </div>
      {runtime ? <p className="status-line">{runtime.summary}</p> : null}
      <p className="status-line">{status}</p>

      {activeChallengeTask?.challenge ? (
        <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow mb-1">Checkpoint Challenge</p>
              <h4 className="question-title">{activeChallengeTask.label}</h4>
            </div>
            <span className="question-tag">{activeChallengeTask.challenge.category ?? "mixed"}</span>
          </div>
          <p className="text-sm text-ink">{activeChallengeTask.challenge.prompt}</p>
          <div className="option-list">
            {activeChallengeTask.challenge.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`option-card ${selectedOptionId === option.id ? "is-focused" : ""}`.trim()}
                onClick={() => setSelectedOptionId(option.id)}
                disabled={isPaused}
              >
                <span>{option.text}</span>
                <span className="tag-chip">{option.id.toUpperCase()}</span>
              </button>
            ))}
          </div>
          {challengeFeedback ? <p className="status-line">{challengeFeedback}</p> : null}
          <div className="board-controls">
            <button className="btn-primary" type="button" onClick={submitChallenge} disabled={isPaused || !selectedOptionId}>
              Submit Answer
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={`board-grid ${smartboardEnabled ? "board-grid-smartboard" : ""} ${movementStyle === "platformer" ? "board-grid-platformer" : ""}`.trim()}
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
            const collected = task ? session.collectedTaskIds.includes(task.id) : false;
            const tileDisplay = isPlayer
              ? "P"
              : isEnemy
                ? "E"
                : collected
                  ? "."
                  : task?.challenge
                    ? "?"
                    : task
                      ? "T"
                      : tile === "."
                        ? ""
                        : tile;
            const tileKind = task ? "T" : tile;
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={[
                  "board-tile",
                  movementStyle === "platformer" ? "is-platformer" : "",
                  tile === "#" ? "is-wall" : "",
                  isGoal ? "is-goal" : "",
                  tile === "S" ? "is-start" : "",
                  task && !collected ? "is-task" : "",
                  isPlayer ? "is-player" : "",
                  isEnemy ? "is-enemy" : "",
                  collected ? "is-cleared" : "",
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
        <span className="tag-chip">{movementStyle === "platformer" ? "Mode Platformer" : "Mode Maze"}</span>
        <span className="tag-chip">Start {start.row + 1},{start.col + 1}</span>
        <span className="tag-chip">Goal {goal.row + 1},{goal.col + 1}</span>
        <span className="tag-chip">Enemies {session.enemies.length}</span>
        <span className="tag-chip">Hits {session.collisions}</span>
      </div>
      <div className={`board-controls ${config.uiConfig.smartboard?.emphasizeControls ? "board-controls-smartboard" : ""}`}>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "up" })}>
          {movementStyle === "platformer" ? "Jump" : "Up"}
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "left" })}>
          Left
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "down" })}>
          {movementStyle === "platformer" ? "Drop" : "Down"}
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "right" })}>
          Right
        </button>
      </div>
    </section>
  );
}
