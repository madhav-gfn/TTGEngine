import { useEffect, useState } from "react";
import type { GameRendererProps, GridCell, GridLevelConfig, InteractionCommand } from "@/core/types";
import { useInputCapture } from "@/hooks/useInputCapture";
import { buildGridState, getSubgridDimensions, serializeCellKey } from "@/lib/utils";

function findNextHint(level: GridLevelConfig, board: number[][]): GridCell | null {
  const explicitHint = level.hints?.find((cell) => board[cell.row][cell.col] !== cell.value);
  if (explicitHint) {
    return explicitHint;
  }

  for (let row = 0; row < level.gridSize; row += 1) {
    for (let col = 0; col < level.gridSize; col += 1) {
      if (board[row][col] !== level.solution[row][col]) {
        return { row, col, value: level.solution[row][col] };
      }
    }
  }

  return null;
}

function isSolved(level: GridLevelConfig, board: number[][]): boolean {
  return board.every((row, rowIndex) =>
    row.every((value, colIndex) => value === level.solution[rowIndex][colIndex]),
  );
}

function findFirstEditableCell(level: GridLevelConfig): { row: number; col: number } {
  const locked = new Set(level.preFilledCells.map((cell) => serializeCellKey(cell.row, cell.col)));
  for (let row = 0; row < level.gridSize; row += 1) {
    for (let col = 0; col < level.gridSize; col += 1) {
      if (!locked.has(serializeCellKey(row, col))) {
        return { row, col };
      }
    }
  }

  return { row: 0, col: 0 };
}

export function GridRenderer({ config, level, levelIndex, onAction, onComplete, isPaused }: GameRendererProps) {
  const gridLevel = level as GridLevelConfig;
  const [board, setBoard] = useState<number[][]>(() => buildGridState(gridLevel));
  const [locked, setLocked] = useState<Set<string>>(
    () => new Set(gridLevel.preFilledCells.map((cell) => serializeCellKey(cell.row, cell.col))),
  );
  const [lastWrongCell, setLastWrongCell] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [focusedCell, setFocusedCell] = useState(() => findFirstEditableCell(gridLevel));
  const subgrid = getSubgridDimensions(gridLevel.gridSize);

  useEffect(() => {
    setBoard(buildGridState(gridLevel));
    setLocked(new Set(gridLevel.preFilledCells.map((cell) => serializeCellKey(cell.row, cell.col))));
    setLastWrongCell(null);
    setCompleted(false);
    setFocusedCell(findFirstEditableCell(gridLevel));
  }, [config.gameId, levelIndex, gridLevel]);

  useEffect(() => {
    if (completed || !isSolved(gridLevel, board)) {
      return;
    }

    setCompleted(true);
    onComplete({
      completed: true,
      correctActions: 0,
      wrongActions: 0,
      totalActions: 0,
      hintsUsed: 0,
      metadata: { gridSize: gridLevel.gridSize },
    });
  }, [board, completed, gridLevel, onComplete]);

  function updateCell(row: number, col: number, nextValue: number): void {
    const key = serializeCellKey(row, col);
    if (locked.has(key)) {
      return;
    }

    if (nextValue === 0) {
      setBoard((current) =>
        current.map((line, index) =>
          index === row ? line.map((value, innerCol) => (innerCol === col ? 0 : value)) : line,
        ),
      );
      setLastWrongCell(null);
      return;
    }

    if (nextValue === gridLevel.solution[row][col]) {
      setBoard((current) => {
        const next = current.map((line) => [...line]);
        next[row][col] = nextValue;
        return next;
      });
      setLocked((current) => new Set(current).add(key));
      onAction({ type: "correct", points: config.scoringConfig.basePoints });
      setLastWrongCell(null);
      return;
    }

    setLastWrongCell(key);
    onAction({ type: "wrong" });
  }

  function requestHint() {
    if (isPaused || completed) {
      return;
    }

    const hint = findNextHint(gridLevel, board);
    if (!hint) {
      return;
    }

    const key = serializeCellKey(hint.row, hint.col);
    setBoard((current) => {
      const next = current.map((line) => [...line]);
      next[hint.row][hint.col] = hint.value;
      return next;
    });
    setLocked((current) => new Set(current).add(key));
    setFocusedCell({ row: hint.row, col: hint.col });
    onAction({ type: "hint" });
  }

  function handleCommand(command: InteractionCommand): void {
    if (isPaused || completed) {
      return;
    }

    if (command.type === "move") {
      const delta = {
        up: { row: -1, col: 0 },
        down: { row: 1, col: 0 },
        left: { row: 0, col: -1 },
        right: { row: 0, col: 1 },
      }[command.direction];
      setFocusedCell((current) => ({
        row: Math.max(0, Math.min(gridLevel.gridSize - 1, current.row + delta.row)),
        col: Math.max(0, Math.min(gridLevel.gridSize - 1, current.col + delta.col)),
      }));
      return;
    }

    if (command.type === "type" && /^[0-9]$/.test(command.value)) {
      updateCell(focusedCell.row, focusedCell.col, Number(command.value));
      return;
    }

    if (command.type === "backspace") {
      updateCell(focusedCell.row, focusedCell.col, 0);
      return;
    }

    if (command.type === "hint") {
      requestHint();
    }
  }

  const captureRef = useInputCapture(!isPaused, config.interactionConfig, handleCommand);

  return (
    <section className="renderer-shell" ref={captureRef} tabIndex={0}>
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Grid Puzzle</p>
          <h3 className="renderer-title">Level {gridLevel.levelNumber}</h3>
        </div>
        <button className="button button-secondary" onClick={requestHint} type="button" disabled={isPaused || completed}>
          Reveal Hint
        </button>
      </div>
      <p className="status-line">Move with arrow keys or WASD, then type a number. Backspace clears the focused cell.</p>
      <div
        className="grid-board"
        style={{
          gridTemplateColumns: `repeat(${gridLevel.gridSize}, minmax(0, 1fr))`,
        }}
      >
        {board.flatMap((row, rowIndex) =>
          row.map((value, colIndex) => {
            const key = serializeCellKey(rowIndex, colIndex);
            const isLocked = locked.has(key);
            const wrong = lastWrongCell === key;
            const isFocused = focusedCell.row === rowIndex && focusedCell.col === colIndex;
            const borderClass =
              subgrid.rows > 1 && (rowIndex + 1) % subgrid.rows === 0 && rowIndex < gridLevel.gridSize - 1
                ? "cell-border-row"
                : subgrid.cols > 1 && (colIndex + 1) % subgrid.cols === 0 && colIndex < gridLevel.gridSize - 1
                  ? "cell-border-col"
                  : "";

            return (
              <button
                key={key}
                type="button"
                className={`grid-cell ${isLocked ? "is-locked" : ""} ${wrong ? "is-wrong" : ""} ${isFocused ? "is-focused" : ""} ${borderClass}`.trim()}
                disabled={isPaused || completed}
                onClick={() => setFocusedCell({ row: rowIndex, col: colIndex })}
              >
                <span className="sr-only">Cell {rowIndex + 1}, {colIndex + 1}</span>
                <span className="grid-cell-value">{value || ""}</span>
              </button>
            );
          }),
        )}
      </div>
    </section>
  );
}
