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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* â”€â”€ Page header â”€â”€ */}
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="eyebrow mb-1">Admin Dashboard</p>
          <h1 className="font-display font-bold text-2xl text-ink">Game Management</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void refreshOverview()} disabled={isLoading}>
            {isLoading ? "Refreshingâ€¦" : "âŸ³ Refresh"}
          </Button>
          <Button size="sm" onClick={switchToCreate}>
            + New Game
          </Button>
        </div>
      </div>

      {/* â”€â”€ Stats strip â”€â”€ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Games", value: overview?.overall.totalGames ?? 0 },
          { label: "Submissions", value: overview?.overall.submissions ?? 0 },
          { label: "Valid Ranked", value: overview?.overall.validSubmissions ?? 0 },
          { label: "Unique Players", value: overview?.overall.players ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="metric-block bg-white border border-gray-100 shadow-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      {/* â”€â”€ Main content â”€â”€ */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">

        {/* â”€â”€ Left: Game builder â”€â”€ */}
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
              <div>
                <p className="eyebrow mb-0.5">Game Builder</p>
                <h2 className="font-display font-bold text-lg text-ink">
                  {isCreateMode ? "Create New Game" : `Editing: ${selectedGameId}`}
                </h2>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void saveGame()} disabled={isSaving} size="sm">
                  {isSaving ? "Savingâ€¦" : isCreateMode ? "Create Game" : "Update Game"}
                </Button>
                {!isCreateMode ? (
                  <Button variant="danger" size="sm" onClick={() => void removeGame()} disabled={isDeleting}>
                    {isDeleting ? "Deletingâ€¦" : "Delete"}
                  </Button>
                ) : null}
              </div>
            </div>

            {error ? <p className="admin-status admin-status-error mb-4">{error}</p> : null}
            {notice ? <p className="admin-status admin-status-success mb-4">{notice}</p> : null}

            {/* Core form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Game ID</span>
                <input className="admin-input" value={coreForm.gameId}
                  onChange={(e) => setCoreForm((p) => ({ ...p, gameId: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Title</span>
                <input className="admin-input" value={coreForm.title}
                  onChange={(e) => setCoreForm((p) => ({ ...p, title: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="admin-label">Description</span>
                <textarea className="admin-input" value={coreForm.description}
                  onChange={(e) => setCoreForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Game Type</span>
                <select className="admin-input" value={coreForm.gameType}
                  onChange={(e) => setCoreForm((p) => ({ ...p, gameType: e.target.value as GameType }))}>
                  <option value="MCQ">Quiz (MCQ)</option>
                  <option value="WORD">Word Builder</option>
                  <option value="GRID">Number Grid Puzzle</option>
                  <option value="DRAG_DROP">Drag and Drop Match</option>
                  <option value="BOARD">Maze / Board Runner</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Difficulty</span>
                <select className="admin-input" value={coreForm.difficulty}
                  onChange={(e) => setCoreForm((p) => ({ ...p, difficulty: e.target.value as Difficulty }))}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Version</span>
                <input className="admin-input" value={coreForm.version}
                  onChange={(e) => setCoreForm((p) => ({ ...p, version: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Folder Name (create only)</span>
                <input className="admin-input" value={coreForm.directoryName} disabled={!isCreateMode}
                  onChange={(e) => setCoreForm((p) => ({ ...p, directoryName: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Author</span>
                <input className="admin-input" value={coreForm.author}
                  onChange={(e) => setCoreForm((p) => ({ ...p, author: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Target Skill</span>
                <input className="admin-input" value={coreForm.targetSkill}
                  onChange={(e) => setCoreForm((p) => ({ ...p, targetSkill: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="admin-label">Tags (comma separated)</span>
                <input className="admin-input" value={coreForm.tagsText}
                  onChange={(e) => setCoreForm((p) => ({ ...p, tagsText: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Estimated Play Time (min)</span>
                <input type="number" className="admin-input" value={coreForm.estimatedPlayTime}
                  onChange={(e) => setCoreForm((p) => ({ ...p, estimatedPlayTime: Number(e.target.value) || 1 }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Timer Type</span>
                <select className="admin-input" value={coreForm.timerType}
                  onChange={(e) => setCoreForm((p) => ({ ...p, timerType: e.target.value as "countdown" | "countup" }))}>
                  <option value="countdown">Countdown</option>
                  <option value="countup">Count Up</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Timer Duration (sec)</span>
                <input type="number" className="admin-input" value={coreForm.timerDuration}
                  onChange={(e) => setCoreForm((p) => ({ ...p, timerDuration: Number(e.target.value) || 10 }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Warning At (comma separated)</span>
                <input className="admin-input" value={coreForm.warningAtText}
                  onChange={(e) => setCoreForm((p) => ({ ...p, warningAtText: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Base Points</span>
                <input type="number" className="admin-input" value={coreForm.basePoints}
                  onChange={(e) => setCoreForm((p) => ({ ...p, basePoints: Number(e.target.value) || 1 }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Level Bonus Multiplier</span>
                <input type="number" className="admin-input" value={coreForm.bonusMultiplier}
                  onChange={(e) => setCoreForm((p) => ({ ...p, bonusMultiplier: Number(e.target.value) || 1 }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Penalty Per Hint</span>
                <input type="number" className="admin-input" value={coreForm.penaltyPerHint}
                  onChange={(e) => setCoreForm((p) => ({ ...p, penaltyPerHint: Number(e.target.value) || 0 }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Penalty Per Wrong</span>
                <input type="number" className="admin-input" value={coreForm.penaltyPerWrong}
                  onChange={(e) => setCoreForm((p) => ({ ...p, penaltyPerWrong: Number(e.target.value) || 0 }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Time Bonus Formula</span>
                <select className="admin-input" value={coreForm.timeBonusFormula}
                  onChange={(e) => setCoreForm((p) => ({ ...p, timeBonusFormula: e.target.value as "none" | "linear" | "exponential" }))}>
                  <option value="none">None</option>
                  <option value="linear">Linear</option>
                  <option value="exponential">Exponential</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="admin-label">Time Bonus Multiplier</span>
                <input type="number" className="admin-input" value={coreForm.timeBonusMultiplier}
                  onChange={(e) => setCoreForm((p) => ({ ...p, timeBonusMultiplier: Number(e.target.value) || 0 }))} />
              </label>
            </div>
          </div>

          {/* Level editor */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
              <div>
                <h3 className="font-display font-bold text-ink">
                  {coreForm.gameType} Levels
                </h3>
                <p className="text-xs text-ink-muted mt-0.5">{activeLevelCount} level(s)</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={addLevel}>+ Add Level</Button>
                <Button variant="secondary" size="sm" onClick={removeLastLevel} disabled={activeLevelCount <= 1}>
                  Remove Last
                </Button>
              </div>
            </div>

            <div className="space-y-5">
              {coreForm.gameType === "MCQ"
                ? mcqLevels.map((level, levelIndex) => (
                    <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-ink-faint">Level {levelIndex + 1}</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Options Count</span>
                          <select className="admin-input" value={level.optionCount}
                            onChange={(e) => setMcqLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, optionCount: Number(e.target.value) as 2 | 3 | 4 } : item)))}>
                            <option value={2}>2</option><option value={3}>3</option><option value={4}>4</option>
                          </select>
                        </label>
                        <label className="flex flex-col gap-1.5 sm:col-span-2">
                          <span className="admin-label">Question</span>
                          <input className="admin-input" value={level.question}
                            onChange={(e) => setMcqLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, question: e.target.value } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Option A</span>
                          <input className="admin-input" value={level.optionA}
                            onChange={(e) => setMcqLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, optionA: e.target.value } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Option B</span>
                          <input className="admin-input" value={level.optionB}
                            onChange={(e) => setMcqLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, optionB: e.target.value } : item)))} />
                        </label>
                        {level.optionCount >= 3 ? (
                          <label className="flex flex-col gap-1.5">
                            <span className="admin-label">Option C</span>
                            <input className="admin-input" value={level.optionC}
                              onChange={(e) => setMcqLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, optionC: e.target.value } : item)))} />
                          </label>
                        ) : null}
                        {level.optionCount >= 4 ? (
                          <label className="flex flex-col gap-1.5">
                            <span className="admin-label">Option D</span>
                            <input className="admin-input" value={level.optionD}
                              onChange={(e) => setMcqLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, optionD: e.target.value } : item)))} />
                          </label>
                        ) : null}
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Correct Option</span>
                          <select className="admin-input" value={level.correctOptionId}
                            onChange={(e) => setMcqLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, correctOptionId: e.target.value as "A" | "B" } : item)))}>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            {level.optionCount >= 3 ? <option value="C">C</option> : null}
                            {level.optionCount >= 4 ? <option value="D">D</option> : null}
                          </select>
                        </label>
                      </div>
                    </div>
                  ))
                : null}

              {coreForm.gameType === "WORD"
                ? wordLevels.map((level, levelIndex) => (
                    <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-ink-faint">Level {levelIndex + 1}</h5>
                      <div className="grid grid-cols-1 gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Available Letters (comma separated)</span>
                          <input className="admin-input" value={level.availableLettersText}
                            onChange={(e) => setWordLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, availableLettersText: e.target.value } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Valid Words (comma separated)</span>
                          <input className="admin-input" value={level.wordsText}
                            onChange={(e) => setWordLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, wordsText: e.target.value } : item)))} />
                        </label>
                      </div>
                    </div>
                  ))
                : null}

              {coreForm.gameType === "GRID"
                ? gridLevels.map((level, levelIndex) => (
                    <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-ink-faint">Level {levelIndex + 1}</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Grid Size (2â€“9)</span>
                          <input type="number" min={2} max={9} className="admin-input" value={level.gridSize}
                            onChange={(e) => setGridLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, gridSize: Number(e.target.value) || 2 } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Clues to Reveal</span>
                          <input type="number" min={1} className="admin-input" value={level.cluesCount}
                            onChange={(e) => setGridLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, cluesCount: Number(e.target.value) || 1 } : item)))} />
                        </label>
                      </div>
                    </div>
                  ))
                : null}

              {coreForm.gameType === "DRAG_DROP"
                ? dragDropLevels.map((level, levelIndex) => (
                    <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-ink-faint">Level {levelIndex + 1}</h5>
                      <div className="grid grid-cols-1 gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Items (comma separated)</span>
                          <input className="admin-input" value={level.itemsText}
                            onChange={(e) => setDragDropLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, itemsText: e.target.value } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Targets (comma separated)</span>
                          <input className="admin-input" value={level.targetsText}
                            onChange={(e) => setDragDropLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, targetsText: e.target.value } : item)))} />
                        </label>
                      </div>
                    </div>
                  ))
                : null}

              {coreForm.gameType === "BOARD"
                ? boardLevels.map((level, levelIndex) => (
                    <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-ink-faint">Level {levelIndex + 1}</h5>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Rows (min 3)</span>
                          <input type="number" min={3} className="admin-input" value={level.rows}
                            onChange={(e) => setBoardLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, rows: Number(e.target.value) || 3 } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Columns (min 3)</span>
                          <input type="number" min={3} className="admin-input" value={level.cols}
                            onChange={(e) => setBoardLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, cols: Number(e.target.value) || 3 } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5 col-span-2">
                          <span className="admin-label">Blockages (#) as row,col;row,col (1-based)</span>
                          <input className="admin-input" placeholder="2,2;2,3;3,3" value={level.blockagesText}
                            onChange={(e) => setBoardLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, blockagesText: e.target.value } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5 col-span-2">
                          <span className="admin-label">Task Cells (T) as row,col;row,col (1-based)</span>
                          <input className="admin-input" placeholder="2,4;3,4" value={level.tasksText}
                            onChange={(e) => setBoardLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, tasksText: e.target.value } : item)))} />
                        </label>
                      </div>
                    </div>
                  ))
                : null}

              {coreForm.gameType === "CUSTOM"
                ? customLevels.map((level, levelIndex) => (
                    <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50/50">
                      <h5 className="text-xs font-bold uppercase tracking-widest text-ink-faint">Level {levelIndex + 1}</h5>
                      <div className="grid grid-cols-1 gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Level Name</span>
                          <input className="admin-input" value={level.levelName}
                            onChange={(e) => setCustomLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, levelName: e.target.value } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Objective</span>
                          <input className="admin-input" value={level.objective}
                            onChange={(e) => setCustomLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, objective: e.target.value } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Instruction</span>
                          <textarea className="admin-input" value={level.instruction}
                            onChange={(e) => setCustomLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, instruction: e.target.value } : item)))} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="admin-label">Success Message</span>
                          <input className="admin-input" value={level.successText}
                            onChange={(e) => setCustomLevels((prev) => assignLevelNumbers(prev.map((item, index) => index === levelIndex ? { ...item, successText: e.target.value } : item)))} />
                        </label>
                      </div>
                    </div>
                  ))
                : null}
            </div>
          </div>

          {/* Config preview */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
            <p className="eyebrow mb-3">Auto-generated Config Preview</p>
            <pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-72 text-ink-muted">
              {JSON.stringify(generatedConfig, null, 2)}
            </pre>
          </div>
        </div>

        {/* â”€â”€ Right: Game list + leaderboard â”€â”€ */}
        <div className="space-y-6">
          {/* Game table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
            <h3 className="font-display font-bold text-ink mb-4">ðŸ“‹ All Games</h3>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Type</th>
                    <th>Submissions</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.games ?? []).map((game) => (
                    <tr key={game.gameId} className={game.gameId === selectedGameId ? "is-selected" : ""}>
                      <td>
                        <strong className="text-sm">{game.title}</strong>
                        <div className="table-subtext">{game.gameId}</div>
                      </td>
                      <td>
                        <span className="game-type-badge">{game.gameType}</span>
                      </td>
                      <td className="text-sm">{game.submissions}</td>
                      <td>
                        <Button variant="ghost" size="sm" onClick={() => void loadGameIntoBuilder(game.gameId)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(overview?.games ?? []).length === 0 && (
                <div className="empty-state py-8">
                  <p className="text-sm">No games yet. Create one!</p>
                </div>
              )}
            </div>
          </div>

          {/* Leaderboard preview */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6">
            <p className="eyebrow mb-1">Leaderboard Preview</p>
            <h3 className="font-display font-semibold text-ink mb-4">
              {selectedGame?.title ?? "Select a game"}
            </h3>
            {selectedGame?.leaderboardPreview.length ? (
              <ol className="space-y-2">
                {selectedGame.leaderboardPreview.map((entry) => (
                  <li key={`${entry.userId}-${entry.rank}`} className="flex items-center justify-between px-3 py-2 rounded-xl border border-gray-100 text-sm">
                    <span className="font-medium text-ink">
                      #{entry.rank} {entry.displayName}
                    </span>
                    <strong className="text-teal-700 tabular-nums">{entry.score}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-muted">No leaderboard entries for this game.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
