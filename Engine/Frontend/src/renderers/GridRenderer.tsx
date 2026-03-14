import { useEffect, useState } from "react";
import type { GameRendererProps, GridCell, GridLevelConfig } from "@/core/types";
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

export function GridRenderer({ config, level, levelIndex, onAction, onComplete, isPaused }: GameRendererProps) {
  const gridLevel = level as GridLevelConfig;
  const [board, setBoard] = useState<number[][]>(() => buildGridState(gridLevel));
  const [locked, setLocked] = useState<Set<string>>(
    () => new Set(gridLevel.preFilledCells.map((cell) => serializeCellKey(cell.row, cell.col))),
  );
  const [lastWrongCell, setLastWrongCell] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const subgrid = getSubgridDimensions(gridLevel.gridSize);

  useEffect(() => {
    setBoard(buildGridState(gridLevel));
    setLocked(new Set(gridLevel.preFilledCells.map((cell) => serializeCellKey(cell.row, cell.col))));
    setLastWrongCell(null);
    setCompleted(false);
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

  function handleCellChange(row: number, col: number, rawValue: string) {
    if (isPaused || completed) {
      return;
    }

    const key = serializeCellKey(row, col);
    if (locked.has(key)) {
      return;
    }

    const numericValue = Number(rawValue.replace(/[^0-9]/g, "").slice(0, 2));
    if (!numericValue) {
      setBoard((current) =>
        current.map((line, index) =>
          index === row ? line.map((value, innerCol) => (innerCol === col ? 0 : value)) : line,
        ),
      );
      return;
    }

    if (numericValue === gridLevel.solution[row][col]) {
      setBoard((current) => {
        const next = current.map((line) => [...line]);
        next[row][col] = numericValue;
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
    onAction({ type: "hint" });
  }

  return (
    <section className="renderer-shell">
      <div className="renderer-toolbar">
        <div>
          <p className="eyebrow">Grid Puzzle</p>
          <h3 className="renderer-title">Level {gridLevel.levelNumber}</h3>
        </div>
        <button className="button button-secondary" onClick={requestHint} type="button" disabled={isPaused || completed}>
          Reveal Hint
        </button>
      </div>
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
            const borderClass =
              subgrid.rows > 1 && (rowIndex + 1) % subgrid.rows === 0 && rowIndex < gridLevel.gridSize - 1
                ? "cell-border-row"
                : subgrid.cols > 1 && (colIndex + 1) % subgrid.cols === 0 && colIndex < gridLevel.gridSize - 1
                  ? "cell-border-col"
                  : "";

            return (
              <label key={key} className={`grid-cell ${isLocked ? "is-locked" : ""} ${wrong ? "is-wrong" : ""} ${borderClass}`.trim()}>
                <span className="sr-only">Cell {rowIndex + 1}, {colIndex + 1}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={value || ""}
                  onChange={(event) => handleCellChange(rowIndex, colIndex, event.target.value)}
                  disabled={isPaused || isLocked || completed}
                />
              </label>
            );
          }),
        )}
      </div>
    </section>
  );
}
