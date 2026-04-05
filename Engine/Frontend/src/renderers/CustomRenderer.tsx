import { useEffect, useMemo, useRef, useState } from "react";
import { CommandEngine } from "@/core/interaction/CommandEngine";
import { boardCommandAdapter, type BoardSession } from "@/core/interaction/adapters";
import {
  getBoardCheckpointPositions,
  getBoardGoal,
  getBoardStart,
  getBoardTaskPositions,
  type BoardLevelConfig,
  type CustomLevelConfig,
  type CustomPrompt,
  type GameRendererProps,
  type InteractionCommand,
} from "@/core/types";
import { useInputCapture } from "@/hooks/useInputCapture";

const boardEngine = new CommandEngine(boardCommandAdapter);

function normalizeScenarioCheckpoints(level: CustomLevelConfig): string[] {
  if (level.checkpoints?.length) {
    return (level.checkpoints as Array<string | { label?: string }>)
      .map((checkpoint) => typeof checkpoint === "string"
        ? checkpoint
        : checkpoint?.label
          ? String(checkpoint.label)
          : null)
      .filter((checkpoint): checkpoint is string => Boolean(checkpoint));
  }

  return [level.objective];
}

function getRendererKind(level: CustomLevelConfig): "scenario" | "platformer" | "math" {
  if (level.renderer?.kind) {
    return level.renderer.kind;
  }

  if (level.prompts?.length) {
    return "math";
  }

  if (level.board?.length) {
    return "platformer";
  }

  return "scenario";
}

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
    return "Collectible";
  }
  if (tile === "C") {
    return "Checkpoint";
  }
  return "Path";
}

function buildBoardLevel(level: CustomLevelConfig): BoardLevelConfig | null {
  if (!level.board?.length) {
    return null;
  }

  return {
    levelNumber: level.levelNumber,
    timeLimit: level.timeLimit,
    bonusMultiplier: level.bonusMultiplier,
    board: level.board,
    tasks: level.boardTasks,
    checkpoints: level.boardCheckpoints,
    enemies: level.enemies,
  };
}

function ScenarioRenderer({ config, level, runtime, onAction, onComplete, isPaused }: GameRendererProps) {
  const customLevel = level as CustomLevelConfig;
  const checkpoints = useMemo(() => normalizeScenarioCheckpoints(customLevel), [customLevel]);
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

function PlatformerRenderer({ config, level, levelIndex, runtime, onAction, onComplete, isPaused }: GameRendererProps) {
  const customLevel = level as CustomLevelConfig;
  const boardLevel = useMemo(() => buildBoardLevel(customLevel), [customLevel]);
  const [status, setStatus] = useState(customLevel.instruction);
  const [session, setSession] = useState<BoardSession | null>(() =>
    boardLevel
      ? boardEngine.createSession({
        level: boardLevel,
        basePoints: config.scoringConfig.basePoints,
      })
      : null,
  );

  const tasks = boardLevel ? getBoardTaskPositions(boardLevel) : [];
  const checkpoints = boardLevel ? getBoardCheckpointPositions(boardLevel) : [];
  const requiredCheckpoints = checkpoints.filter((checkpoint) => checkpoint.required !== false);
  const goal = boardLevel ? getBoardGoal(boardLevel) : { row: 0, col: 0 };
  const start = boardLevel ? getBoardStart(boardLevel) : { row: 0, col: 0 };
  const progress = session ? session.collectedTaskIds.length + session.activatedCheckpointIds.length : 0;
  const total = tasks.length + requiredCheckpoints.length;

  useEffect(() => {
    if (!boardLevel) {
      setSession(null);
      return;
    }

    setSession(boardEngine.createSession({
      level: boardLevel,
      basePoints: config.scoringConfig.basePoints,
    }));
    setStatus(customLevel.instruction);
  }, [boardLevel, config.scoringConfig.basePoints, customLevel.instruction, levelIndex]);

  function dispatchCommand(command: InteractionCommand): void {
    if (!boardLevel || !session || isPaused) {
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
        wrongActions: outcome.session.collisions,
        totalActions: total,
        hintsUsed: 0,
        metadata: {
          ...outcome.completion.metadata,
          renderer: "platformer",
          goalText: customLevel.boardGoalText ?? "Reach the portal",
        },
      });
    }
  }

  const captureRef = useInputCapture(Boolean(boardLevel) && !isPaused, config.interactionConfig, dispatchCommand);

  if (!boardLevel || !session) {
    return (
      <section className="renderer-shell">
        <p className="status-line">This custom platformer level is missing a board definition.</p>
      </section>
    );
  }

  return (
    <section className="renderer-shell board-shell" ref={captureRef} tabIndex={0}>
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Custom Platformer</p>
          <h3 className="renderer-title">{customLevel.name}</h3>
        </div>
        <span className="question-tag">
          Progress {progress}/{total}
        </span>
      </div>
      {runtime ? <p className="status-line">{runtime.summary}</p> : null}
      <p className="status-line">{status}</p>
      <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Objective</p>
          <p className="mt-2 text-base font-semibold text-ink">{customLevel.objective}</p>
        </div>
        <div className="board-grid board-grid-smartboard" style={{ gridTemplateColumns: `repeat(${boardLevel.board[0]?.length ?? 1}, minmax(0, 1fr))` }}>
          {boardLevel.board.flatMap((row, rowIndex) =>
            row.split("").map((tile, colIndex) => {
              const isPlayer = session.row === rowIndex && session.col === colIndex;
              const isEnemy = session.enemies.some((enemy) => enemy.row === rowIndex && enemy.col === colIndex);
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
                    goal.row === rowIndex && goal.col === colIndex ? "is-goal" : "",
                    isPlayer ? "is-player" : "",
                    isEnemy ? "is-enemy" : "",
                    collected || checkpointReached ? "is-cleared" : "",
                  ].join(" ").trim()}
                  aria-label={`${tileLabel(tileKind)} at row ${rowIndex + 1}, column ${colIndex + 1}`}
                >
                  <span>{tileDisplay}</span>
                </div>
              );
            }),
          )}
        </div>
      </div>
      <div className="board-meta">
        <span className="tag-chip">Start {start.row + 1},{start.col + 1}</span>
        <span className="tag-chip">{customLevel.boardGoalText ?? "Goal"} {goal.row + 1},{goal.col + 1}</span>
        <span className="tag-chip">Checkpoints {session.activatedCheckpointIds.length}/{requiredCheckpoints.length}</span>
        <span className="tag-chip">Coins {session.collectedTaskIds.length}/{tasks.length}</span>
      </div>
      <div className="board-controls">
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "up" })}>
          Jump
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "left" })}>
          Left
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "down" })}>
          Drop
        </button>
        <button className="button button-secondary" type="button" onClick={() => dispatchCommand({ type: "move", direction: "right" })}>
          Right
        </button>
      </div>
      <p className="status-line">{customLevel.successText}</p>
    </section>
  );
}

function buildMathOptions(prompt: CustomPrompt): Array<{ id: string; text: string }> {
  if (prompt.options?.length) {
    return prompt.options;
  }

  const numericAnswer = Number(prompt.answer);
  if (!Number.isFinite(numericAnswer)) {
    return [];
  }

  const optionValues = Array.from(new Set([
    numericAnswer,
    numericAnswer + 1,
    numericAnswer - 1,
    numericAnswer + 2,
  ])).slice(0, 4);
  const rotation = prompt.prompt.length % optionValues.length;

  return optionValues
    .map((_, index) => optionValues[(index + rotation) % optionValues.length])
    .map((value, index) => ({
      id: String.fromCharCode(65 + index),
      text: String(value),
    }));
}

function MathRenderer({ config, level, runtime, onAction, onComplete, isPaused }: GameRendererProps) {
  const customLevel = level as CustomLevelConfig;
  const prompts = useMemo<CustomPrompt[]>(() => customLevel.prompts ?? [], [customLevel.prompts]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState(customLevel.instruction);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(Date.now());
  const [questionElapsedMs, setQuestionElapsedMs] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const advanceTimeoutRef = useRef<number | null>(null);

  const currentPrompt = prompts[currentIndex];
  const passingScore = customLevel.passingScore ?? 70;
  const totalPrompts = Math.max(1, prompts.length);
  const questionDurationMs = useMemo(() => {
    const totalTimeMs = (customLevel.timeLimit ?? config.timerConfig.duration) * 1000;
    return Math.max(3500, Math.min(9000, Math.floor(totalTimeMs / (prompts.length + 1))));
  }, [config.timerConfig.duration, customLevel.timeLimit, prompts.length]);
  const paceRemaining = Math.max(0, 1 - questionElapsedMs / questionDurationMs);
  const scorePercent = Math.round((correctCount / totalPrompts) * 100);
  const promptOptions = currentPrompt ? buildMathOptions(currentPrompt) : [];

  useEffect(() => {
    setCurrentIndex(0);
    setStatus(customLevel.instruction);
    setSelectedAnswer("");
    setTypedAnswer("");
    setCorrectCount(0);
    setWrongCount(0);
    setHintsUsed(0);
    setStreak(0);
    setBestStreak(0);
    setAnswers({});
    setQuestionStartedAt(Date.now());
    setQuestionElapsedMs(0);
    setIsResolving(false);
    setIsComplete(false);
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
  }, [customLevel.instruction, customLevel.levelNumber]);

  useEffect(() => {
    if (isPaused || isResolving || isComplete || !currentPrompt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setQuestionElapsedMs(Date.now() - questionStartedAt);
    }, 100);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentPrompt, isComplete, isPaused, isResolving, questionStartedAt]);

  useEffect(() => () => {
    if (advanceTimeoutRef.current !== null) {
      window.clearTimeout(advanceTimeoutRef.current);
    }
  }, []);

  function finalizeRound(nextCorrectCount: number, nextWrongCount: number, nextAnswers: Record<string, string>, nextBestStreak: number): void {
    if (isComplete) {
      return;
    }

    const nextScorePercent = Math.round((nextCorrectCount / totalPrompts) * 100);
    setIsComplete(true);
    setIsResolving(false);
    onComplete({
      completed: nextScorePercent >= passingScore,
      correctActions: nextCorrectCount,
      wrongActions: nextWrongCount,
      totalActions: totalPrompts,
      hintsUsed,
      metadata: {
        renderer: "math",
        scorePercent: nextScorePercent,
        passingScore,
        bestStreak: nextBestStreak,
        answers: nextAnswers,
      },
    });
  }

  function moveToNextPrompt(nextCorrectCount: number, nextWrongCount: number, nextAnswers: Record<string, string>, nextBestStreak: number): void {
    if (currentIndex >= prompts.length - 1) {
      finalizeRound(nextCorrectCount, nextWrongCount, nextAnswers, nextBestStreak);
      return;
    }

    setCurrentIndex((value) => value + 1);
    setSelectedAnswer("");
    setTypedAnswer("");
    setQuestionStartedAt(Date.now());
    setQuestionElapsedMs(0);
    setIsResolving(false);
    setStatus(`Question ${Math.min(prompts.length, currentIndex + 2)}. Stay sharp and protect the streak.`);
  }

  function resolvePrompt(submittedValue: string, timedOut = false): void {
    if (!currentPrompt || isPaused || isResolving || isComplete) {
      return;
    }

    const submitted = submittedValue.trim();
    const expected = currentPrompt.answer.trim().toLowerCase();
    const isCorrect = submitted.toLowerCase() === expected;
    const nextCorrectCount = correctCount + (isCorrect ? 1 : 0);
    const nextWrongCount = wrongCount + (isCorrect ? 0 : 1);
    const nextStreak = isCorrect ? streak + 1 : 0;
    const nextBestStreak = Math.max(bestStreak, nextStreak);
    const nextAnswers = {
      ...answers,
      [currentPrompt.id]: submitted || (timedOut ? "TIMEOUT" : ""),
    };

    setAnswers(nextAnswers);
    setCorrectCount(nextCorrectCount);
    setWrongCount(nextWrongCount);
    setStreak(nextStreak);
    setBestStreak(nextBestStreak);
    setSelectedAnswer(submitted);
    setTypedAnswer(submitted);
    setIsResolving(true);

    if (isCorrect) {
      onAction({ type: "correct", points: config.scoringConfig.basePoints, metadata: { promptId: currentPrompt.id } });
      setStatus(`Correct. ${currentPrompt.explanation ?? "Keep the sprint moving."}`);
    } else {
      onAction({ type: "wrong", metadata: { promptId: currentPrompt.id, timedOut } });
      setStatus(timedOut ? `Time slipped. ${currentPrompt.explanation ?? "Move fast on the next one."}` : `Missed it. ${currentPrompt.explanation ?? "Reset and answer the next one quickly."}`);
    }

    advanceTimeoutRef.current = window.setTimeout(() => {
      moveToNextPrompt(nextCorrectCount, nextWrongCount, nextAnswers, nextBestStreak);
    }, isCorrect ? 420 : 650);
  }

  useEffect(() => {
    if (!currentPrompt || isPaused || isResolving || isComplete) {
      return;
    }

    if (questionElapsedMs >= questionDurationMs) {
      resolvePrompt("", true);
    }
  }, [currentPrompt, isComplete, isPaused, isResolving, questionDurationMs, questionElapsedMs]);

  function requestHint(): void {
    if (!currentPrompt || isPaused || isResolving || isComplete) {
      return;
    }

    onAction({ type: "hint", metadata: { promptId: currentPrompt.id } });
    setHintsUsed((value) => value + 1);
    setStatus(currentPrompt.hint ?? customLevel.instruction);
  }

  if (prompts.length === 0) {
    return (
      <section className="renderer-shell">
        <p className="status-line">This custom math level is missing prompts.</p>
      </section>
    );
  }

  if (!currentPrompt) {
    return (
      <section className="renderer-shell">
        <p className="status-line">{customLevel.successText}</p>
      </section>
    );
  }

  return (
    <section className="renderer-shell">
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Math Sprint</p>
          <h3 className="renderer-title">{customLevel.name}</h3>
        </div>
        <span className="question-tag">
          Q {Math.min(prompts.length, currentIndex + 1)}/{prompts.length}
        </span>
      </div>
      {runtime ? <p className="status-line">{runtime.summary}</p> : null}
      <p className="status-line">{status}</p>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[28px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="tag-chip">Target {passingScore}%</span>
            <span className="tag-chip">Score {scorePercent}%</span>
            <span className="tag-chip">Streak {streak}</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/80">
            <div
              className={`h-full rounded-full transition-all duration-100 ${paceRemaining > 0.45 ? "bg-emerald-500" : paceRemaining > 0.2 ? "bg-amber-500" : "bg-rose-500"}`.trim()}
              style={{ width: `${Math.max(4, paceRemaining * 100)}%` }}
            />
          </div>
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700/80">Prompt {currentIndex + 1}</p>
            <p className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{currentPrompt.prompt}</p>
            <p className="text-sm text-ink-muted">Answer fast. The next question appears right after this one resolves.</p>
          </div>
          {promptOptions.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {promptOptions.map((option) => {
                const isActive = selectedAnswer === option.text;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`option-card min-h-[74px] text-base ${isActive && !isResolving ? "is-focused" : ""} ${isActive && isResolving && option.text.trim().toLowerCase() === currentPrompt.answer.trim().toLowerCase() ? "is-correct" : ""} ${isActive && isResolving && option.text.trim().toLowerCase() !== currentPrompt.answer.trim().toLowerCase() ? "is-wrong" : ""}`.trim()}
                    onClick={() => resolvePrompt(option.text)}
                    disabled={isPaused || isResolving || isComplete}
                  >
                    <span className="text-left">{option.text}</span>
                    <span className="tag-chip">{option.id}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-6 flex gap-3">
              <input
                className="admin-input flex-1"
                value={typedAnswer}
                onChange={(event) => setTypedAnswer(event.target.value)}
                disabled={isPaused || isResolving || isComplete}
                placeholder="Type the answer"
              />
              <button
                className="btn-primary"
                type="button"
                onClick={() => resolvePrompt(typedAnswer)}
                disabled={isPaused || isResolving || isComplete || !typedAnswer.trim()}
              >
                Lock
              </button>
            </div>
          )}
        </div>
        <div className="space-y-4 rounded-[28px] border border-gray-100 bg-gray-50/80 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white bg-white p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-faint">Correct</p>
              <p className="mt-2 text-3xl font-black text-emerald-600">{correctCount}</p>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-faint">Wrong</p>
              <p className="mt-2 text-3xl font-black text-rose-600">{wrongCount}</p>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-faint">Best Streak</p>
              <p className="mt-2 text-3xl font-black text-amber-600">{bestStreak}</p>
            </div>
            <div className="rounded-2xl border border-white bg-white p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-ink-faint">Hints</p>
              <p className="mt-2 text-3xl font-black text-sky-600">{hintsUsed}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-ink-faint">Sprint Rhythm</p>
            <p className="mt-2 text-sm text-ink-muted">Keep your answers short and decisive. Wrong answers or timeouts reset the streak, but the round keeps pushing forward.</p>
          </div>
          <div className="board-controls">
            <button className="btn-secondary" type="button" onClick={requestHint} disabled={isPaused || isResolving || isComplete}>
              Hint
            </button>
          </div>
        </div>
      </div>
      <p className="status-line">{customLevel.successText}</p>
    </section>
  );
}

export function CustomRenderer(props: GameRendererProps) {
  const customLevel = props.level as CustomLevelConfig;
  const rendererKind = getRendererKind(customLevel);

  if (rendererKind === "platformer") {
    return <PlatformerRenderer {...props} />;
  }

  if (rendererKind === "math") {
    return <MathRenderer {...props} />;
  }

  return <ScenarioRenderer {...props} />;
}
