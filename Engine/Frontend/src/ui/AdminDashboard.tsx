import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  createAdminGame,
  deleteAdminGame,
  getAdminGame,
  getAdminOverview,
  updateAdminGame,
  type AdminOverview,
} from "@/lib/adminApi";
import { useGameStore } from "@/store/gameStore";
import { Button } from "./shared/Button";

type Difficulty = "easy" | "medium" | "hard";
type GameType = "MCQ" | "WORD" | "GRID" | "DRAG_DROP" | "BOARD" | "CUSTOM";

interface CoreFormState {
  schemaVersion: 1 | 2;
  gameId: string;
  title: string;
  description: string;
  version: string;
  gameType: GameType;
  difficulty: Difficulty;
  directoryName: string;
  author: string;
  targetSkill: string;
  tagsText: string;
  estimatedPlayTime: number;
  timerType: "countdown" | "countup";
  timerDuration: number;
  warningAtText: string;
  basePoints: number;
  bonusMultiplier: number;
  penaltyPerHint: number;
  penaltyPerWrong: number;
  timeBonusFormula: "none" | "linear" | "exponential";
  timeBonusMultiplier: number;
}

interface LevelBase {
  levelNumber: number;
  timeLimit?: number;
  bonusMultiplier?: number;
}

interface MCQLevelForm extends LevelBase {
  question: string;
  optionCount: 2 | 3 | 4;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOptionId: "A" | "B" | "C" | "D";
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  negativeMarking: boolean;
}

interface WordLevelForm extends LevelBase {
  availableLettersText: string;
  wordsText: string;
}

interface GridLevelForm extends LevelBase {
  gridSize: number;
  cluesCount: number;
}

interface DragDropLevelForm extends LevelBase {
  itemsText: string;
  targetsText: string;
}

interface BoardLevelForm extends LevelBase {
  rows: number;
  cols: number;
  blockagesText: string;
  tasksText: string;
}

interface CustomLevelForm extends LevelBase {
  levelName: string;
  objective: string;
  instruction: string;
  successText: string;
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseIntegerList(value: string): number[] {
  const parsed = splitCsv(value)
    .map((token) => Number(token))
    .filter((valueNumber) => Number.isFinite(valueNumber) && valueNumber > 0)
    .map((valueNumber) => Math.round(valueNumber));

  return parsed.length > 0 ? parsed : [30, 10, 5];
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const payload = error.data as { error?: { message?: string } } | undefined;
    return payload?.error?.message ?? `Request failed (${error.status})`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected admin error.";
}

function createDefaultCoreState(): CoreFormState {
  return {
    schemaVersion: 2,
    gameId: "new-game-id",
    title: "New Admin Game",
    description: "Created from the admin dashboard",
    version: "1.0.0",
    gameType: "MCQ",
    difficulty: "medium",
    directoryName: "",
    author: "Admin",
    targetSkill: "general",
    tagsText: "admin",
    estimatedPlayTime: 3,
    timerType: "countdown",
    timerDuration: 120,
    warningAtText: "30,10,5",
    basePoints: 100,
    bonusMultiplier: 1,
    penaltyPerHint: 0,
    penaltyPerWrong: 0,
    timeBonusFormula: "none",
    timeBonusMultiplier: 1,
  };
}

function createDefaultMCQLevel(levelNumber: number): MCQLevelForm {
  return {
    levelNumber,
    question: `Level ${levelNumber}: Sample question`,
    optionCount: 2,
    optionA: "Correct answer",
    optionB: "Wrong answer",
    optionC: "",
    optionD: "",
    correctOptionId: "A",
    shuffleQuestions: false,
    shuffleOptions: false,
    negativeMarking: false,
  };
}

function createDefaultWordLevel(levelNumber: number): WordLevelForm {
  return {
    levelNumber,
    availableLettersText: "C,A,T,D,O,G",
    wordsText: "CAT,DOG",
  };
}

function createDefaultGridLevel(levelNumber: number): GridLevelForm {
  return {
    levelNumber,
    gridSize: 4,
    cluesCount: 4,
  };
}

function createDefaultDragDropLevel(levelNumber: number): DragDropLevelForm {
  return {
    levelNumber,
    itemsText: "Apple,Carrot,Milk",
    targetsText: "Fruit,Vegetable,Dairy",
  };
}

function createDefaultBoardLevel(levelNumber: number): BoardLevelForm {
  return {
    levelNumber,
    rows: 5,
    cols: 5,
    blockagesText: "2,2",
    tasksText: "2,3;3,3",
  };
}

function createDefaultCustomLevel(levelNumber: number): CustomLevelForm {
  return {
    levelNumber,
    levelName: `Level ${levelNumber}`,
    objective: "Complete the objective",
    instruction: "Describe what the player should do in this level.",
    successText: "Great job!",
  };
}

function assignLevelNumbers<T extends LevelBase>(levels: T[]): T[] {
  return levels.map((level, index) => ({ ...level, levelNumber: index + 1 }));
}

function makeLatinSquare(size: number): number[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ((row + col) % size) + 1),
  );
}

function makePrefilledCells(solution: number[][], cluesCount: number): Array<{ row: number; col: number; value: number }> {
  const size = solution.length;
  const total = Math.max(1, Math.min(cluesCount, size * size));
  const cells: Array<{ row: number; col: number; value: number }> = [];

  for (let index = 0; index < total; index += 1) {
    const row = Math.floor(index / size);
    const col = index % size;
    cells.push({ row, col, value: solution[row][col] });
  }

  return cells;
}

function parseCoordinatePairs(raw: string): Array<{ row: number; col: number }> {
  return raw
    .split(/[;\n]/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [rowRaw, colRaw] = token.split(",").map((value) => Number(value.trim()));
      return {
        row: Number.isFinite(rowRaw) ? Math.max(1, Math.round(rowRaw)) : 1,
        col: Number.isFinite(colRaw) ? Math.max(1, Math.round(colRaw)) : 1,
      };
    });
}

function makeBoard(
  rows: number,
  cols: number,
  blockages: Array<{ row: number; col: number }>,
  tasks: Array<{ row: number; col: number }>,
): string[] {
  const safeRows = Math.max(3, rows);
  const safeCols = Math.max(3, cols);
  const board = Array.from({ length: safeRows }, () => Array.from({ length: safeCols }, () => "."));
  board[0][0] = "S";
  board[safeRows - 1][safeCols - 1] = "G";

  blockages.forEach((cell) => {
    const rowIndex = cell.row - 1;
    const colIndex = cell.col - 1;
    if (rowIndex < 0 || colIndex < 0 || rowIndex >= safeRows || colIndex >= safeCols) {
      return;
    }

    if ((rowIndex === 0 && colIndex === 0) || (rowIndex === safeRows - 1 && colIndex === safeCols - 1)) {
      return;
    }

    board[rowIndex][colIndex] = "#";
  });

  tasks.forEach((cell) => {
    const rowIndex = cell.row - 1;
    const colIndex = cell.col - 1;
    if (rowIndex < 0 || colIndex < 0 || rowIndex >= safeRows || colIndex >= safeCols) {
      return;
    }

    if (board[rowIndex][colIndex] === "#") {
      return;
    }

    if ((rowIndex === 0 && colIndex === 0) || (rowIndex === safeRows - 1 && colIndex === safeCols - 1)) {
      return;
    }

    board[rowIndex][colIndex] = "T";
  });

  return board.map((row) => row.join(""));
}

function makeBoardTasks(
  rows: number,
  cols: number,
  tasks: Array<{ row: number; col: number }>,
): Array<{ id: string; row: number; col: number; label: string }> {
  const safeRows = Math.max(3, rows);
  const safeCols = Math.max(3, cols);
  return tasks
    .map((cell, index) => {
      const row = Math.max(1, Math.min(safeRows - 2, cell.row - 1));
      const col = Math.max(1, Math.min(safeCols - 2, cell.col - 1));
      return {
        id: `task-${index + 1}`,
        row,
        col,
        label: `Task ${index + 1}`,
      };
    })
    .filter((task, index, list) => list.findIndex((entry) => entry.row === task.row && entry.col === task.col) === index)
    .slice(0, Math.max(0, safeRows * safeCols - 2))
    .map((task, index) => ({
      ...task,
      id: `task-${index + 1}`,
      label: `Task ${index + 1}`,
    }));
}

function parseDifficulty(value: unknown): Difficulty {
  if (value === "easy" || value === "hard") {
    return value;
  }

  return "medium";
}

export function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string>("");
  const [isCreateMode, setIsCreateMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [coreForm, setCoreForm] = useState<CoreFormState>(createDefaultCoreState());
  const [mcqLevels, setMcqLevels] = useState<MCQLevelForm[]>([createDefaultMCQLevel(1)]);
  const [wordLevels, setWordLevels] = useState<WordLevelForm[]>([createDefaultWordLevel(1)]);
  const [gridLevels, setGridLevels] = useState<GridLevelForm[]>([createDefaultGridLevel(1)]);
  const [dragDropLevels, setDragDropLevels] = useState<DragDropLevelForm[]>([createDefaultDragDropLevel(1)]);
  const [boardLevels, setBoardLevels] = useState<BoardLevelForm[]>([createDefaultBoardLevel(1)]);
  const [customLevels, setCustomLevels] = useState<CustomLevelForm[]>([createDefaultCustomLevel(1)]);

  const setAvailableGames = useGameStore((state) => state.setAvailableGames);

  const selectedGame = useMemo(
    () => overview?.games.find((game) => game.gameId === selectedGameId) ?? null,
    [overview, selectedGameId],
  );

  const generatedConfig = useMemo(() => {
    const now = new Date().toISOString();
    const baseConfig = {
      ...(coreForm.schemaVersion === 2 ? { schemaVersion: 2 as const } : {}),
      gameId: coreForm.gameId.trim(),
      gameType: coreForm.gameType,
      title: coreForm.title.trim(),
      description: coreForm.description.trim(),
      version: coreForm.version.trim(),
      difficulty: coreForm.difficulty,
      timerConfig: {
        type: coreForm.timerType,
        duration: Math.max(10, Math.round(coreForm.timerDuration)),
        warningAt: parseIntegerList(coreForm.warningAtText),
      },
      scoringConfig: {
        basePoints: Math.max(1, Math.round(coreForm.basePoints)),
        bonusMultiplier: Math.max(0.1, coreForm.bonusMultiplier),
        penaltyPerHint: Math.max(0, Math.round(coreForm.penaltyPerHint)),
        penaltyPerWrong: Math.max(0, Math.round(coreForm.penaltyPerWrong)),
        timeBonusFormula: coreForm.timeBonusFormula,
        timeBonusMultiplier: Math.max(0, coreForm.timeBonusMultiplier),
      },
      metadata: {
        author: coreForm.author.trim() || "Admin",
        createdAt: now,
        updatedAt: now,
        tags: splitCsv(coreForm.tagsText),
        targetSkill: coreForm.targetSkill.trim() || "general",
        estimatedPlayTime: Math.max(1, Math.round(coreForm.estimatedPlayTime)),
      },
      apiConfig: {
        leaderboardEndpoint: `/api/leaderboard/${coreForm.gameId.trim()}`,
        scoreSubmitEndpoint: "/api/score",
      },
    };

    if (coreForm.gameType === "MCQ") {
      return {
        ...baseConfig,
        levels: assignLevelNumbers(mcqLevels).map((level) => ({
          levelNumber: level.levelNumber,
          timeLimit: level.timeLimit,
          bonusMultiplier: level.bonusMultiplier,
          questions: [
            {
              id: `q-${level.levelNumber}`,
              question: level.question,
              options: [
                { id: "A", text: level.optionA },
                { id: "B", text: level.optionB },
                ...(level.optionCount >= 3 ? [{ id: "C", text: level.optionC || "Option C" }] : []),
                ...(level.optionCount >= 4 ? [{ id: "D", text: level.optionD || "Option D" }] : []),
              ],
              correctOptionId: level.correctOptionId,
              difficulty: coreForm.difficulty,
            },
          ],
          shuffleQuestions: level.shuffleQuestions,
          shuffleOptions: level.shuffleOptions,
          negativeMarking: level.negativeMarking,
        })),
      };
    }

    if (coreForm.gameType === "WORD") {
      return {
        ...baseConfig,
        levels: assignLevelNumbers(wordLevels).map((level) => {
          const words = splitCsv(level.wordsText);
          return {
            levelNumber: level.levelNumber,
            timeLimit: level.timeLimit,
            bonusMultiplier: level.bonusMultiplier,
            availableLetters: splitCsv(level.availableLettersText),
            validWords: words.map((word) => ({
              word: word.toUpperCase(),
              points: 100,
              difficulty: coreForm.difficulty,
            })),
            bonusWords: [],
            minWordLength: 2,
            maxWordLength: 12,
          };
        }),
      };
    }

    if (coreForm.gameType === "GRID") {
      return {
        ...baseConfig,
        levels: assignLevelNumbers(gridLevels).map((level) => {
          const size = Math.max(2, Math.min(9, Math.round(level.gridSize)));
          const solution = makeLatinSquare(size);
          const preFilledCells = makePrefilledCells(solution, Math.max(1, level.cluesCount));

          return {
            levelNumber: level.levelNumber,
            timeLimit: level.timeLimit,
            bonusMultiplier: level.bonusMultiplier,
            gridSize: size,
            preFilledCells,
            solution,
            hints: preFilledCells.slice(0, Math.min(2, preFilledCells.length)),
          };
        }),
      };
    }

    if (coreForm.gameType === "DRAG_DROP") {
      return {
        ...baseConfig,
        levels: assignLevelNumbers(dragDropLevels).map((level) => {
          const items = splitCsv(level.itemsText).map((label, index) => ({
            id: `item-${index + 1}`,
            label,
          }));
          const targets = splitCsv(level.targetsText).map((label, index) => ({
            id: `target-${index + 1}`,
            label,
            acceptsMultiple: false,
          }));
          const fallbackTargetId = targets[0]?.id ?? "target-1";
          const correctMapping = items.reduce<Record<string, string>>((mapping, item, index) => {
            mapping[item.id] = targets[index]?.id ?? fallbackTargetId;
            return mapping;
          }, {});

          return {
            levelNumber: level.levelNumber,
            timeLimit: level.timeLimit,
            bonusMultiplier: level.bonusMultiplier,
            items,
            targets,
            correctMapping,
          };
        }),
      };
    }

    if (coreForm.gameType === "BOARD") {
      return {
        ...baseConfig,
        levels: assignLevelNumbers(boardLevels).map((level) => {
          const blockageCells = parseCoordinatePairs(level.blockagesText);
          const taskCells = parseCoordinatePairs(level.tasksText);
          return {
            levelNumber: level.levelNumber,
            timeLimit: level.timeLimit,
            bonusMultiplier: level.bonusMultiplier,
            board: makeBoard(level.rows, level.cols, blockageCells, taskCells),
            tasks: makeBoardTasks(level.rows, level.cols, taskCells),
          };
        }),
      };
    }

    return {
      ...baseConfig,
      levels: assignLevelNumbers(customLevels).map((level) => ({
        levelNumber: level.levelNumber,
        timeLimit: level.timeLimit,
        bonusMultiplier: level.bonusMultiplier,
        name: level.levelName,
        objective: level.objective,
        instruction: level.instruction,
        successText: level.successText,
      })),
    };
  }, [boardLevels, coreForm, customLevels, dragDropLevels, gridLevels, mcqLevels, wordLevels]);

  async function refreshOverview(): Promise<void> {
    setIsLoading(true);
    setError(null);

    try {
      const nextOverview = await getAdminOverview();
      setOverview(nextOverview);
      setAvailableGames(
        nextOverview.games.map((game) => ({
          gameId: game.gameId,
          title: game.title,
          description: game.description,
          gameType: game.gameType,
          difficulty: game.difficulty,
          version: game.version,
          estimatedPlayTime: game.estimatedPlayTime,
          tags: game.tags,
        })),
      );
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshOverview();
  }, []);

  async function loadGameIntoBuilder(gameId: string): Promise<void> {
    setError(null);
    setNotice(null);

    try {
      const game = (await getAdminGame(gameId)) as Record<string, any>;
      const gameType = (game.gameType as GameType | undefined) ?? "MCQ";
      const defaultCore = createDefaultCoreState();

      setCoreForm({
        ...defaultCore,
        schemaVersion: game.schemaVersion === 2 ? 2 : 1,
        gameId: String(game.gameId ?? defaultCore.gameId),
        title: String(game.title ?? defaultCore.title),
        description: String(game.description ?? defaultCore.description),
        version: String(game.version ?? defaultCore.version),
        gameType,
        difficulty: parseDifficulty(game.difficulty),
        directoryName: overview?.games.find((entry) => entry.gameId === gameId)?.directory ?? "",
        author: String(game.metadata?.author ?? defaultCore.author),
        targetSkill: String(game.metadata?.targetSkill ?? defaultCore.targetSkill),
        tagsText: Array.isArray(game.metadata?.tags) ? game.metadata.tags.join(",") : defaultCore.tagsText,
        estimatedPlayTime: Number(game.metadata?.estimatedPlayTime) || defaultCore.estimatedPlayTime,
        timerType: game.timerConfig?.type === "countup" ? "countup" : "countdown",
        timerDuration: Number(game.timerConfig?.duration) || defaultCore.timerDuration,
        warningAtText: Array.isArray(game.timerConfig?.warningAt)
          ? game.timerConfig.warningAt.join(",")
          : defaultCore.warningAtText,
        basePoints: Number(game.scoringConfig?.basePoints) || defaultCore.basePoints,
        bonusMultiplier: Number(game.scoringConfig?.bonusMultiplier) || defaultCore.bonusMultiplier,
        penaltyPerHint: Number(game.scoringConfig?.penaltyPerHint) || defaultCore.penaltyPerHint,
        penaltyPerWrong: Number(game.scoringConfig?.penaltyPerWrong) || defaultCore.penaltyPerWrong,
        timeBonusFormula:
          game.scoringConfig?.timeBonusFormula === "linear" || game.scoringConfig?.timeBonusFormula === "exponential"
            ? game.scoringConfig.timeBonusFormula
            : "none",
        timeBonusMultiplier: Number(game.scoringConfig?.timeBonusMultiplier) || defaultCore.timeBonusMultiplier,
      });

      const levels = Array.isArray(game.levels) ? game.levels : [];

      if (gameType === "MCQ") {
        setMcqLevels(
          assignLevelNumbers(
            (levels.length > 0 ? levels : [createDefaultMCQLevel(1)]).map((level: any, index: number) => ({
              levelNumber: Number(level.levelNumber) || index + 1,
              question: String(level.questions?.[0]?.question ?? "Question"),
              optionA: String(level.questions?.[0]?.options?.[0]?.text ?? "Option A"),
              optionB: String(level.questions?.[0]?.options?.[1]?.text ?? "Option B"),
              optionC: String(level.questions?.[0]?.options?.[2]?.text ?? ""),
              optionD: String(level.questions?.[0]?.options?.[3]?.text ?? ""),
              optionCount:
                (Array.isArray(level.questions?.[0]?.options) && level.questions[0].options.length >= 4
                  ? 4
                  : Array.isArray(level.questions?.[0]?.options) && level.questions[0].options.length >= 3
                    ? 3
                    : 2) as 2 | 3 | 4,
              correctOptionId:
                level.questions?.[0]?.correctOptionId === "D"
                  ? "D"
                  : level.questions?.[0]?.correctOptionId === "C"
                    ? "C"
                    : level.questions?.[0]?.correctOptionId === "B"
                      ? "B"
                      : "A",
              shuffleQuestions: Boolean(level.shuffleQuestions),
              shuffleOptions: Boolean(level.shuffleOptions),
              negativeMarking: Boolean(level.negativeMarking),
              timeLimit: Number(level.timeLimit) || undefined,
              bonusMultiplier: Number(level.bonusMultiplier) || undefined,
            })),
          ),
        );
      }

      if (gameType === "WORD") {
        setWordLevels(
          assignLevelNumbers(
            (levels.length > 0 ? levels : [createDefaultWordLevel(1)]).map((level: any, index: number) => ({
              levelNumber: Number(level.levelNumber) || index + 1,
              availableLettersText: Array.isArray(level.availableLetters) ? level.availableLetters.join(",") : "C,A,T",
              wordsText: Array.isArray(level.validWords)
                ? level.validWords.map((entry: any) => String(entry.word)).join(",")
                : "CAT,DOG",
              timeLimit: Number(level.timeLimit) || undefined,
              bonusMultiplier: Number(level.bonusMultiplier) || undefined,
            })),
          ),
        );
      }

      if (gameType === "GRID") {
        setGridLevels(
          assignLevelNumbers(
            (levels.length > 0 ? levels : [createDefaultGridLevel(1)]).map((level: any, index: number) => ({
              levelNumber: Number(level.levelNumber) || index + 1,
              gridSize: Number(level.gridSize) || 4,
              cluesCount: Array.isArray(level.preFilledCells) ? level.preFilledCells.length : 4,
              timeLimit: Number(level.timeLimit) || undefined,
              bonusMultiplier: Number(level.bonusMultiplier) || undefined,
            })),
          ),
        );
      }

      if (gameType === "DRAG_DROP") {
        setDragDropLevels(
          assignLevelNumbers(
            (levels.length > 0 ? levels : [createDefaultDragDropLevel(1)]).map((level: any, index: number) => ({
              levelNumber: Number(level.levelNumber) || index + 1,
              itemsText: Array.isArray(level.items) ? level.items.map((item: any) => item.label).join(",") : "Item A,Item B",
              targetsText: Array.isArray(level.targets)
                ? level.targets.map((target: any) => target.label).join(",")
                : "Bucket A,Bucket B",
              timeLimit: Number(level.timeLimit) || undefined,
              bonusMultiplier: Number(level.bonusMultiplier) || undefined,
            })),
          ),
        );
      }

      if (gameType === "BOARD") {
        setBoardLevels(
          assignLevelNumbers(
            (levels.length > 0 ? levels : [createDefaultBoardLevel(1)]).map((level: any, index: number) => ({
              levelNumber: Number(level.levelNumber) || index + 1,
              rows: Array.isArray(level.board) ? level.board.length : 5,
              cols: Array.isArray(level.board) && level.board[0] ? String(level.board[0]).length : 5,
              blockagesText: Array.isArray(level.board)
                ? level.board
                    .flatMap((row: string, rowIndex: number) =>
                      row
                        .split("")
                        .map((tile, colIndex) => ({ tile, rowIndex, colIndex }))
                        .filter((entry) => entry.tile === "#")
                        .map((entry) => `${entry.rowIndex + 1},${entry.colIndex + 1}`),
                    )
                    .join(";")
                : "",
              tasksText: Array.isArray(level.tasks)
                ? level.tasks.map((task: any) => `${Number(task.row) + 1},${Number(task.col) + 1}`).join(";")
                : Array.isArray(level.board)
                  ? level.board
                      .flatMap((row: string, rowIndex: number) =>
                        row
                          .split("")
                          .map((tile, colIndex) => ({ tile, rowIndex, colIndex }))
                          .filter((entry) => entry.tile === "T")
                          .map((entry) => `${entry.rowIndex + 1},${entry.colIndex + 1}`),
                      )
                      .join(";")
                  : "",
              timeLimit: Number(level.timeLimit) || undefined,
              bonusMultiplier: Number(level.bonusMultiplier) || undefined,
            })),
          ),
        );
      }

      if (gameType === "CUSTOM") {
        setCustomLevels(
          assignLevelNumbers(
            (levels.length > 0 ? levels : [createDefaultCustomLevel(1)]).map((level: any, index: number) => ({
              levelNumber: Number(level.levelNumber) || index + 1,
              levelName: String(level.name ?? `Level ${index + 1}`),
              objective: String(level.objective ?? "Complete objective"),
              instruction: String(level.instruction ?? "Follow instructions"),
              successText: String(level.successText ?? "Great!"),
              timeLimit: Number(level.timeLimit) || undefined,
              bonusMultiplier: Number(level.bonusMultiplier) || undefined,
            })),
          ),
        );
      }

      setSelectedGameId(gameId);
      setIsCreateMode(false);
      setNotice("Game loaded into the form builder.");
    } catch (loadError) {
      setError(toErrorMessage(loadError));
    }
  }

  function switchToCreate(): void {
    setCoreForm(createDefaultCoreState());
    setMcqLevels([createDefaultMCQLevel(1)]);
    setWordLevels([createDefaultWordLevel(1)]);
    setGridLevels([createDefaultGridLevel(1)]);
    setDragDropLevels([createDefaultDragDropLevel(1)]);
    setBoardLevels([createDefaultBoardLevel(1)]);
    setCustomLevels([createDefaultCustomLevel(1)]);
    setIsCreateMode(true);
    setSelectedGameId("");
    setNotice("New game form ready. Add levels and save.");
    setError(null);
  }

  async function saveGame(): Promise<void> {
    setError(null);
    setNotice(null);

    setIsSaving(true);
    try {
      if (isCreateMode) {
        await createAdminGame(generatedConfig, coreForm.directoryName || undefined);
        setNotice("Game created successfully from form data.");
      } else {
        if (!selectedGameId) {
          setError("Select a game to update.");
          return;
        }

        await updateAdminGame(selectedGameId, generatedConfig);
        setNotice("Game updated successfully from form data.");
      }

      await refreshOverview();
    } catch (saveError) {
      setError(toErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeGame(): Promise<void> {
    if (!selectedGameId || isCreateMode) {
      setError("Choose an existing game before deleting.");
      return;
    }

    const confirmed = window.confirm(`Delete game '${selectedGameId}' and its folder? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteAdminGame(selectedGameId);
      setNotice("Game deleted successfully.");
      switchToCreate();
      await refreshOverview();
    } catch (deleteError) {
      setError(toErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  function addLevel(): void {
    if (coreForm.gameType === "MCQ") {
      setMcqLevels((prev) => [...assignLevelNumbers(prev), createDefaultMCQLevel(prev.length + 1)]);
      return;
    }

    if (coreForm.gameType === "WORD") {
      setWordLevels((prev) => [...assignLevelNumbers(prev), createDefaultWordLevel(prev.length + 1)]);
      return;
    }

    if (coreForm.gameType === "GRID") {
      setGridLevels((prev) => [...assignLevelNumbers(prev), createDefaultGridLevel(prev.length + 1)]);
      return;
    }

    if (coreForm.gameType === "DRAG_DROP") {
      setDragDropLevels((prev) => [...assignLevelNumbers(prev), createDefaultDragDropLevel(prev.length + 1)]);
      return;
    }

    if (coreForm.gameType === "BOARD") {
      setBoardLevels((prev) => [...assignLevelNumbers(prev), createDefaultBoardLevel(prev.length + 1)]);
      return;
    }

    setCustomLevels((prev) => [...assignLevelNumbers(prev), createDefaultCustomLevel(prev.length + 1)]);
  }

  function removeLastLevel(): void {
    if (coreForm.gameType === "MCQ") {
      setMcqLevels((prev) => (prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev));
      return;
    }

    if (coreForm.gameType === "WORD") {
      setWordLevels((prev) => (prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev));
      return;
    }

    if (coreForm.gameType === "GRID") {
      setGridLevels((prev) => (prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev));
      return;
    }

    if (coreForm.gameType === "DRAG_DROP") {
      setDragDropLevels((prev) => (prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev));
      return;
    }

    if (coreForm.gameType === "BOARD") {
      setBoardLevels((prev) => (prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev));
      return;
    }

    setCustomLevels((prev) => (prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev));
  }

  const activeLevelCount =
    coreForm.gameType === "MCQ"
      ? mcqLevels.length
      : coreForm.gameType === "WORD"
        ? wordLevels.length
        : coreForm.gameType === "GRID"
          ? gridLevels.length
          : coreForm.gameType === "DRAG_DROP"
            ? dragDropLevels.length
            : coreForm.gameType === "BOARD"
              ? boardLevels.length
              : customLevels.length;

  return (
    <section className="admin-grid">
      <article className="admin-card admin-summary-card">
        <div>
          <p className="eyebrow">Admin Dashboard</p>
          <h2>Easy game creator: multi-level and auto-generated config</h2>
        </div>
        <div className="button-row">
          <Button variant="secondary" onClick={() => void refreshOverview()} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh Stats"}
          </Button>
          <Button variant="secondary" onClick={switchToCreate}>
            New Game Builder
          </Button>
        </div>
      </article>

      <article className="admin-card admin-metrics-grid">
        <div className="metric-block">
          <span>Total Games</span>
          <strong>{overview?.overall.totalGames ?? 0}</strong>
        </div>
        <div className="metric-block">
          <span>Total Submissions</span>
          <strong>{overview?.overall.submissions ?? 0}</strong>
        </div>
        <div className="metric-block">
          <span>Valid Leaderboard Submissions</span>
          <strong>{overview?.overall.validSubmissions ?? 0}</strong>
        </div>
        <div className="metric-block">
          <span>Unique Players</span>
          <strong>{overview?.overall.players ?? 0}</strong>
        </div>
      </article>

      <article className="admin-card admin-table-card">
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Type</th>
                <th>Difficulty</th>
                <th>Submissions</th>
                <th>Players</th>
                <th>Best Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(overview?.games ?? []).map((game) => (
                <tr key={game.gameId} className={game.gameId === selectedGameId ? "is-selected" : ""}>
                  <td>
                    <strong>{game.title}</strong>
                    <div className="table-subtext">{game.gameId}</div>
                  </td>
                  <td>{game.gameType}</td>
                  <td>{game.difficulty}</td>
                  <td>{game.submissions}</td>
                  <td>{game.players}</td>
                  <td>{game.highScore ?? "-"}</td>
                  <td>
                    <Button variant="ghost" onClick={() => void loadGameIntoBuilder(game.gameId)}>
                      Open Builder
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="admin-card admin-editor-card">
        <div className="admin-editor-header">
          <div>
            <p className="eyebrow">Game Builder</p>
            <h3>{isCreateMode ? "Create New Game" : `Editing ${selectedGameId}`}</h3>
          </div>
          <div className="button-row">
            <Button onClick={() => void saveGame()} disabled={isSaving}>
              {isSaving ? "Saving..." : isCreateMode ? "Create Game" : "Update Game"}
            </Button>
            {!isCreateMode ? (
              <Button variant="secondary" onClick={() => void removeGame()} disabled={isDeleting}>
                {isDeleting ? "Deleting..." : "Delete Game"}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="admin-form-grid">
          <label className="admin-label">
            Game Id
            <input
              className="admin-input"
              value={coreForm.gameId}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, gameId: event.target.value }))}
            />
          </label>

          <label className="admin-label">
            Title
            <input
              className="admin-input"
              value={coreForm.title}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, title: event.target.value }))}
            />
          </label>

          <label className="admin-label admin-field-span-2">
            Description
            <textarea
              className="admin-input"
              value={coreForm.description}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <label className="admin-label">
            Game Type
            <select
              className="admin-input"
              value={coreForm.gameType}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, gameType: event.target.value as GameType }))}
            >
              <option value="MCQ">Quiz (MCQ)</option>
              <option value="WORD">Word Builder</option>
              <option value="GRID">Number Grid Puzzle</option>
              <option value="DRAG_DROP">Drag and Drop Match</option>
              <option value="BOARD">Maze / Board Runner</option>
            </select>
          </label>

          <label className="admin-label">
            Difficulty
            <select
              className="admin-input"
              value={coreForm.difficulty}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, difficulty: event.target.value as Difficulty }))}
            >
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
          </label>

          <label className="admin-label">
            Version
            <input
              className="admin-input"
              value={coreForm.version}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, version: event.target.value }))}
            />
          </label>

          <label className="admin-label">
            Folder Name (create only)
            <input
              className="admin-input"
              value={coreForm.directoryName}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, directoryName: event.target.value }))}
              disabled={!isCreateMode}
            />
          </label>

          <label className="admin-label">
            Author
            <input
              className="admin-input"
              value={coreForm.author}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, author: event.target.value }))}
            />
          </label>

          <label className="admin-label">
            Tags (comma separated)
            <input
              className="admin-input"
              value={coreForm.tagsText}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, tagsText: event.target.value }))}
            />
          </label>

          <label className="admin-label">
            Target Skill
            <input
              className="admin-input"
              value={coreForm.targetSkill}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, targetSkill: event.target.value }))}
            />
          </label>

          <label className="admin-label">
            Estimated Play Time (min)
            <input
              type="number"
              className="admin-input"
              value={coreForm.estimatedPlayTime}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, estimatedPlayTime: Number(event.target.value) || 1 }))}
            />
          </label>

          <label className="admin-label">
            Timer Type
            <select
              className="admin-input"
              value={coreForm.timerType}
              onChange={(event) =>
                setCoreForm((prev) => ({ ...prev, timerType: event.target.value as "countdown" | "countup" }))
              }
            >
              <option value="countdown">countdown</option>
              <option value="countup">countup</option>
            </select>
          </label>

          <label className="admin-label">
            Timer Duration (sec)
            <input
              type="number"
              className="admin-input"
              value={coreForm.timerDuration}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, timerDuration: Number(event.target.value) || 10 }))}
            />
          </label>

          <label className="admin-label">
            Warning At (comma separated)
            <input
              className="admin-input"
              value={coreForm.warningAtText}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, warningAtText: event.target.value }))}
            />
          </label>

          <label className="admin-label">
            Base Points
            <input
              type="number"
              className="admin-input"
              value={coreForm.basePoints}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, basePoints: Number(event.target.value) || 1 }))}
            />
          </label>

          <label className="admin-label">
            Level Bonus Multiplier
            <input
              type="number"
              className="admin-input"
              value={coreForm.bonusMultiplier}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, bonusMultiplier: Number(event.target.value) || 1 }))}
            />
          </label>

          <label className="admin-label">
            Penalty Per Hint
            <input
              type="number"
              className="admin-input"
              value={coreForm.penaltyPerHint}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, penaltyPerHint: Number(event.target.value) || 0 }))}
            />
          </label>

          <label className="admin-label">
            Penalty Per Wrong
            <input
              type="number"
              className="admin-input"
              value={coreForm.penaltyPerWrong}
              onChange={(event) => setCoreForm((prev) => ({ ...prev, penaltyPerWrong: Number(event.target.value) || 0 }))}
            />
          </label>

          <label className="admin-label">
            Time Bonus Formula
            <select
              className="admin-input"
              value={coreForm.timeBonusFormula}
              onChange={(event) =>
                setCoreForm((prev) => ({
                  ...prev,
                  timeBonusFormula: event.target.value as "none" | "linear" | "exponential",
                }))
              }
            >
              <option value="none">none</option>
              <option value="linear">linear</option>
              <option value="exponential">exponential</option>
            </select>
          </label>

          <label className="admin-label">
            Time Bonus Multiplier
            <input
              type="number"
              className="admin-input"
              value={coreForm.timeBonusMultiplier}
              onChange={(event) =>
                setCoreForm((prev) => ({ ...prev, timeBonusMultiplier: Number(event.target.value) || 0 }))
              }
            />
          </label>
        </div>

        <section className="admin-level-card">
          <div className="admin-level-header">
            <h4>{coreForm.gameType} Levels</h4>
            <div className="button-row">
              <span className="table-subtext">{activeLevelCount} level(s)</span>
              <Button variant="secondary" onClick={addLevel}>
                Add Level
              </Button>
              <Button variant="secondary" onClick={removeLastLevel} disabled={activeLevelCount <= 1}>
                Remove Last
              </Button>
            </div>
          </div>

          {coreForm.gameType === "MCQ"
            ? mcqLevels.map((level, levelIndex) => (
                <div key={levelIndex} className="admin-form-grid admin-level-entry">
                  <h5 className="admin-field-span-2">Level {levelIndex + 1}</h5>
                  <label className="admin-label">
                    Options Count
                    <select
                      className="admin-input"
                      value={level.optionCount}
                      onChange={(event) =>
                        setMcqLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex
                                ? { ...item, optionCount: Number(event.target.value) as 2 | 3 | 4 }
                                : item,
                            ),
                          ),
                        )
                      }
                    >
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                    </select>
                  </label>
                  <label className="admin-label admin-field-span-2">
                    Question
                    <input
                      className="admin-input"
                      value={level.question}
                      onChange={(event) =>
                        setMcqLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, question: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label">
                    Option A
                    <input
                      className="admin-input"
                      value={level.optionA}
                      onChange={(event) =>
                        setMcqLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, optionA: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label">
                    Option B
                    <input
                      className="admin-input"
                      value={level.optionB}
                      onChange={(event) =>
                        setMcqLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, optionB: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  {level.optionCount >= 3 ? (
                    <label className="admin-label">
                      Option C
                      <input
                        className="admin-input"
                        value={level.optionC}
                        onChange={(event) =>
                          setMcqLevels((prev) =>
                            assignLevelNumbers(
                              prev.map((item, index) =>
                                index === levelIndex ? { ...item, optionC: event.target.value } : item,
                              ),
                            ),
                          )
                        }
                      />
                    </label>
                  ) : null}
                  {level.optionCount >= 4 ? (
                    <label className="admin-label">
                      Option D
                      <input
                        className="admin-input"
                        value={level.optionD}
                        onChange={(event) =>
                          setMcqLevels((prev) =>
                            assignLevelNumbers(
                              prev.map((item, index) =>
                                index === levelIndex ? { ...item, optionD: event.target.value } : item,
                              ),
                            ),
                          )
                        }
                      />
                    </label>
                  ) : null}
                  <label className="admin-label">
                    Correct Option
                    <select
                      className="admin-input"
                      value={level.correctOptionId}
                      onChange={(event) =>
                        setMcqLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex
                                ? { ...item, correctOptionId: event.target.value as "A" | "B" }
                                : item,
                            ),
                          ),
                        )
                      }
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      {level.optionCount >= 3 ? <option value="C">C</option> : null}
                      {level.optionCount >= 4 ? <option value="D">D</option> : null}
                    </select>
                  </label>
                </div>
              ))
            : null}

          {coreForm.gameType === "WORD"
            ? wordLevels.map((level, levelIndex) => (
                <div key={levelIndex} className="admin-form-grid admin-level-entry">
                  <h5 className="admin-field-span-2">Level {levelIndex + 1}</h5>
                  <label className="admin-label admin-field-span-2">
                    Available Letters (comma separated)
                    <input
                      className="admin-input"
                      value={level.availableLettersText}
                      onChange={(event) =>
                        setWordLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, availableLettersText: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label admin-field-span-2">
                    Valid Words (comma separated)
                    <input
                      className="admin-input"
                      value={level.wordsText}
                      onChange={(event) =>
                        setWordLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, wordsText: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))
            : null}

          {coreForm.gameType === "GRID"
            ? gridLevels.map((level, levelIndex) => (
                <div key={levelIndex} className="admin-form-grid admin-level-entry">
                  <h5 className="admin-field-span-2">Level {levelIndex + 1}</h5>
                  <label className="admin-label">
                    Grid Size
                    <input
                      type="number"
                      min={2}
                      max={9}
                      className="admin-input"
                      value={level.gridSize}
                      onChange={(event) =>
                        setGridLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, gridSize: Number(event.target.value) || 2 } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label">
                    Clues To Reveal
                    <input
                      type="number"
                      min={1}
                      className="admin-input"
                      value={level.cluesCount}
                      onChange={(event) =>
                        setGridLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, cluesCount: Number(event.target.value) || 1 } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))
            : null}

          {coreForm.gameType === "DRAG_DROP"
            ? dragDropLevels.map((level, levelIndex) => (
                <div key={levelIndex} className="admin-form-grid admin-level-entry">
                  <h5 className="admin-field-span-2">Level {levelIndex + 1}</h5>
                  <label className="admin-label admin-field-span-2">
                    Items (comma separated)
                    <input
                      className="admin-input"
                      value={level.itemsText}
                      onChange={(event) =>
                        setDragDropLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, itemsText: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label admin-field-span-2">
                    Targets (comma separated)
                    <input
                      className="admin-input"
                      value={level.targetsText}
                      onChange={(event) =>
                        setDragDropLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, targetsText: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))
            : null}

          {coreForm.gameType === "BOARD"
            ? boardLevels.map((level, levelIndex) => (
                <div key={levelIndex} className="admin-form-grid admin-level-entry">
                  <h5 className="admin-field-span-2">Level {levelIndex + 1}</h5>
                  <label className="admin-label">
                    Rows
                    <input
                      type="number"
                      min={3}
                      className="admin-input"
                      value={level.rows}
                      onChange={(event) =>
                        setBoardLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, rows: Number(event.target.value) || 3 } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label">
                    Columns
                    <input
                      type="number"
                      min={3}
                      className="admin-input"
                      value={level.cols}
                      onChange={(event) =>
                        setBoardLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, cols: Number(event.target.value) || 3 } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label admin-field-span-2">
                    Blockages (#) as row,col;row,col (1-based)
                    <input
                      className="admin-input"
                      placeholder="2,2;2,3;3,3"
                      value={level.blockagesText}
                      onChange={(event) =>
                        setBoardLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, blockagesText: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label admin-field-span-2">
                    Task Cells (T) as row,col;row,col (1-based)
                    <input
                      className="admin-input"
                      placeholder="2,4;3,4"
                      value={level.tasksText}
                      onChange={(event) =>
                        setBoardLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, tasksText: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))
            : null}

          {coreForm.gameType === "CUSTOM"
            ? customLevels.map((level, levelIndex) => (
                <div key={levelIndex} className="admin-form-grid admin-level-entry">
                  <h5 className="admin-field-span-2">Level {levelIndex + 1}</h5>
                  <label className="admin-label">
                    Level Name
                    <input
                      className="admin-input"
                      value={level.levelName}
                      onChange={(event) =>
                        setCustomLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, levelName: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label admin-field-span-2">
                    Objective
                    <input
                      className="admin-input"
                      value={level.objective}
                      onChange={(event) =>
                        setCustomLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, objective: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label admin-field-span-2">
                    Instruction
                    <textarea
                      className="admin-input"
                      value={level.instruction}
                      onChange={(event) =>
                        setCustomLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, instruction: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-label admin-field-span-2">
                    Success Message
                    <input
                      className="admin-input"
                      value={level.successText}
                      onChange={(event) =>
                        setCustomLevels((prev) =>
                          assignLevelNumbers(
                            prev.map((item, index) =>
                              index === levelIndex ? { ...item, successText: event.target.value } : item,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                </div>
              ))
            : null}
        </section>

        <section className="admin-preview-block">
          <p className="eyebrow">Auto-generated Config Preview</p>
          <pre className="admin-preview">{JSON.stringify(generatedConfig, null, 2)}</pre>
        </section>

        {error ? <p className="admin-status admin-status-error">{error}</p> : null}
        {notice ? <p className="admin-status admin-status-success">{notice}</p> : null}
      </article>

      <article className="admin-card admin-leaderboard-card">
        <p className="eyebrow">Leaderboard Preview</p>
        <h3>{selectedGame?.title ?? "Select a game from the table"}</h3>

        {selectedGame?.leaderboardPreview.length ? (
          <ol className="admin-leaderboard-list">
            {selectedGame.leaderboardPreview.map((entry) => (
              <li key={`${entry.userId}-${entry.rank}`}>
                <span>
                  #{entry.rank} {entry.displayName}
                </span>
                <strong>{entry.score}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p>No leaderboard entries available for this game yet.</p>
        )}
      </article>
    </section>
  );
}
