import { useEffect, useMemo, useState } from "react";
import type { CustomRendererKind } from "@/core/types";
import { ApiError } from "@/lib/api";
import {
  createAdminGame,
  deleteAdminGame,
  generateAdminGameDraft,
  generateAdminLevels,
  getAdminGame,
  getAdminOverview,
  updateAdminGame,
  type AdminOverview,
} from "@/lib/adminApi";
import { useGameStore } from "@/store/gameStore";
import { Button } from "./shared/Button";

type Difficulty = "easy" | "medium" | "hard";
type GameType = "MCQ" | "WORD" | "GRID" | "DRAG_DROP" | "BOARD" | "PLATFORMER" | "MATH";
type AIProvider = "local-template" | "openai-compatible" | "google-genai";
type Tile = { row: number; col: number };
type EnemyPatrolRow = { row: number; col: number; movement: "horizontal" | "vertical"; min: number; max: number; speed: number };

const LEARNING_OUTCOMES = ["problem solving", "attention to detail", "focus", "algorithms", "vocabulary"] as const;

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
  adaptiveEnabled: boolean;
  adaptiveSupportThreshold: number;
  adaptiveChallengeThreshold: number;
  adaptiveTimerAdjustmentSeconds: number;
  adaptiveMultiplierAdjustment: number;
  aiEnabled: boolean;
  aiProvider: AIProvider;
  smartboardEnabled: boolean;
  smartboardFullscreen: boolean;
  customRendererKind: CustomRendererKind;
}

interface LevelBase { levelNumber: number; timeLimit?: number; bonusMultiplier?: number }
interface MCQLevelForm extends LevelBase { question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOptionId: "A" | "B" | "C" | "D" }
interface WordLevelForm extends LevelBase { availableLettersText: string; wordsText: string }
interface GridLevelForm extends LevelBase { gridSize: number; cluesCount: number }
interface DragDropLevelForm extends LevelBase { itemsText: string; targetsText: string }
interface BoardLevelForm extends LevelBase { rows: number; cols: number; blockagesText: string; tasksText: string; checkpointsText: string; enemyPatrolsText: string }
interface CustomLevelForm extends LevelBase {
  levelName: string; objective: string; instruction: string; successText: string; rendererKind: CustomRendererKind;
  scenarioCheckpointsText: string; boardRows: number; boardCols: number; boardBlockagesText: string; boardTasksText: string; boardCheckpointsText: string;
  enemyPatrolsText: string; promptsText: string; passingScore: number;
}

const splitCsv = (value: string) => value.split(",").map((token) => token.trim()).filter(Boolean);
const splitLines = (value: string) => value.split(/\r?\n/).map((token) => token.trim()).filter(Boolean);
const assignLevelNumbers = <T extends LevelBase>(levels: T[]) => levels.map((level, index) => ({ ...level, levelNumber: index + 1 }));
const parseDifficulty = (value: unknown): Difficulty => value === "easy" || value === "hard" ? value : "medium";
const titleCase = (value: string) => value.split(/[\s-]+/).filter(Boolean).map((token) => token[0]?.toUpperCase() + token.slice(1)).join(" ");

function parseIntegerList(value: string): number[] {
  const parsed = splitCsv(value).map((token) => Number(token)).filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.round(n));
  return parsed.length ? parsed : [30, 10, 5];
}

function parseCoordinatePairs(raw: string): Tile[] {
  return raw.split(/[;\n]/).map((token) => token.trim()).filter(Boolean).map((token) => {
    const [rowRaw, colRaw] = token.split(",").map((value) => Number(value.trim()));
    return { row: Math.max(1, Number.isFinite(rowRaw) ? Math.round(rowRaw) : 1), col: Math.max(1, Number.isFinite(colRaw) ? Math.round(colRaw) : 1) };
  });
}

function serializeCoordinatePairs(cells: Tile[]): string {
  return cells.filter((cell, index, list) => list.findIndex((entry) => entry.row === cell.row && entry.col === cell.col) === index)
    .map((cell) => `${cell.row},${cell.col}`).join(";");
}

function parseEnemyPatrolRows(raw: string): EnemyPatrolRow[] {
  return raw.split(/[;\n]/).map((token) => token.trim()).filter(Boolean).map((token) => {
    const [rowRaw, colRaw, movementRaw, minRaw, maxRaw, speedRaw] = token.split(",").map((value) => value.trim());
    return {
      row: Math.max(1, Number(rowRaw) || 1),
      col: Math.max(1, Number(colRaw) || 1),
      movement: movementRaw === "vertical" ? "vertical" : "horizontal",
      min: Math.max(1, Number(minRaw) || 1),
      max: Math.max(1, Number(maxRaw) || Number(minRaw) || 1),
      speed: Math.max(1, Number(speedRaw) || 1),
    };
  });
}

function parseEnemyPatrols(raw: string, rows: number, cols: number) {
  return parseEnemyPatrolRows(raw).map((enemy, index) => ({
    id: `enemy-${index + 1}`,
    row: Math.max(0, Math.min(rows - 1, enemy.row - 1)),
    col: Math.max(0, Math.min(cols - 1, enemy.col - 1)),
    movement: enemy.movement,
    min: Math.max(0, enemy.min - 1),
    max: enemy.movement === "horizontal" ? Math.min(cols - 1, enemy.max - 1) : Math.min(rows - 1, enemy.max - 1),
    speed: enemy.speed,
    direction: "forward" as const,
  }));
}

function makeBoard(rows: number, cols: number, blockages: Tile[], tasks: Tile[], checkpoints: Tile[]): string[] {
  const safeRows = Math.max(3, rows), safeCols = Math.max(3, cols);
  const board = Array.from({ length: safeRows }, () => Array.from({ length: safeCols }, () => "."));
  board[0][0] = "S"; board[safeRows - 1][safeCols - 1] = "G";
  parseCoordinatePairs(serializeCoordinatePairs(blockages)).forEach((cell) => { const row = cell.row - 1, col = cell.col - 1; if (board[row]?.[col] === "." && !(row === 0 && col === 0) && !(row === safeRows - 1 && col === safeCols - 1)) board[row][col] = "#"; });
  parseCoordinatePairs(serializeCoordinatePairs(checkpoints)).forEach((cell) => { const row = cell.row - 1, col = cell.col - 1; if (board[row]?.[col] === ".") board[row][col] = "C"; });
  parseCoordinatePairs(serializeCoordinatePairs(tasks)).forEach((cell) => { const row = cell.row - 1, col = cell.col - 1; if (board[row]?.[col] === ".") board[row][col] = "T"; });
  return board.map((row) => row.join(""));
}

const makeBoardTasks = (tasks: Tile[]) => parseCoordinatePairs(serializeCoordinatePairs(tasks)).map((task, index) => ({ id: `task-${index + 1}`, row: task.row - 1, col: task.col - 1, label: `Task ${index + 1}` }));
const makeBoardCheckpoints = (checkpoints: Tile[]) => parseCoordinatePairs(serializeCoordinatePairs(checkpoints)).map((checkpoint, index) => ({ id: `checkpoint-${index + 1}`, row: checkpoint.row - 1, col: checkpoint.col - 1, label: `Checkpoint ${index + 1}`, required: true }));

function parseMathPrompts(raw: string) {
  return splitLines(raw).map((line, index) => {
    const [prompt, answer, ...options] = line.split("|").map((token) => token.trim()).filter(Boolean);
    return { id: `prompt-${index + 1}`, prompt: prompt || `Prompt ${index + 1}`, answer: answer || "0", options: options.length ? options.map((text, optionIndex) => ({ id: String.fromCharCode(65 + optionIndex), text })) : undefined, hint: "Work the operation step by step.", explanation: "Check the computed result against the choices." };
  });
}

const serializeMathPrompts = (prompts: Array<Record<string, unknown>>) => prompts.map((prompt) => [String(prompt.prompt ?? ""), String(prompt.answer ?? ""), ...((((prompt.options as Array<{ text: string }> | undefined) ?? []).map((option) => option.text)))].filter(Boolean).join("|")).join("\n");
const inferCustomRendererKind = (level: Record<string, unknown> | undefined): CustomRendererKind => level?.renderer && typeof level.renderer === "object" && ((level.renderer as { kind?: unknown }).kind === "platformer" || (level.renderer as { kind?: unknown }).kind === "math") ? (level.renderer as { kind: CustomRendererKind }).kind : Array.isArray(level?.prompts) ? "math" : "platformer";

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return ((error.data as { error?: { message?: string } } | undefined)?.error?.message) ?? `Request failed (${error.status})`;
  if (error instanceof Error) return error.message;
  return "Unexpected admin error.";
}

const createDefaultCoreState = (): CoreFormState => ({ schemaVersion: 2, gameId: "ai-game", title: "New Builder Game", description: "Created from the admin dashboard", version: "1.0.0", gameType: "BOARD", difficulty: "medium", directoryName: "", author: "Admin", targetSkill: "problem solving", tagsText: "admin,ai", estimatedPlayTime: 5, timerType: "countdown", timerDuration: 120, warningAtText: "30,10,5", basePoints: 100, bonusMultiplier: 1, penaltyPerHint: 5, penaltyPerWrong: 0, timeBonusFormula: "linear", timeBonusMultiplier: 1, adaptiveEnabled: true, adaptiveSupportThreshold: 0.55, adaptiveChallengeThreshold: 0.9, adaptiveTimerAdjustmentSeconds: 12, adaptiveMultiplierAdjustment: 0.2, aiEnabled: true, aiProvider: "local-template", smartboardEnabled: true, smartboardFullscreen: true, customRendererKind: "platformer" });
const createDefaultMCQLevel = (levelNumber: number): MCQLevelForm => ({ levelNumber, question: `Level ${levelNumber}: Sample question`, optionA: "Correct", optionB: "Distractor 1", optionC: "Distractor 2", optionD: "Distractor 3", correctOptionId: "A" });
const createDefaultWordLevel = (levelNumber: number): WordLevelForm => ({ levelNumber, availableLettersText: "C,A,T,D,O,G", wordsText: "CAT,DOG" });
const createDefaultGridLevel = (levelNumber: number): GridLevelForm => ({ levelNumber, gridSize: 4, cluesCount: 4 });
const createDefaultDragDropLevel = (levelNumber: number): DragDropLevelForm => ({ levelNumber, itemsText: "Apple,Carrot,Milk", targetsText: "Fruit,Vegetable,Dairy" });
const createDefaultBoardLevel = (levelNumber: number): BoardLevelForm => ({ levelNumber, rows: 5, cols: 6, blockagesText: "2,3;3,3", tasksText: "2,4;4,2", checkpointsText: "3,5", enemyPatrolsText: "" });
const createDefaultCustomLevel = (levelNumber: number, rendererKind: CustomRendererKind): CustomLevelForm => ({ levelNumber, levelName: `Level ${levelNumber}`, objective: rendererKind === "math" ? "Solve the challenge set" : "Complete the objective", instruction: rendererKind === "platformer" ? "Move through the board, activate checkpoints, and reach the portal." : rendererKind === "math" ? "Answer every prompt and hit the pass threshold." : "Describe what the player should do.", successText: "Great job!", rendererKind, scenarioCheckpointsText: "Review the objective\nComplete the action\nConfirm the result", boardRows: 4, boardCols: 7, boardBlockagesText: "2,3;3,3", boardTasksText: "2,5;3,5", boardCheckpointsText: "2,2", enemyPatrolsText: "", promptsText: "8 + 4 = ?|12|12|10|14|11\n15 - 6 = ?|9|9|7|10|8", passingScore: 70 });

function BoardPainter(props: { rows: number; cols: number; blockagesText: string; tasksText: string; checkpointsText: string; onChange: (next: { blockagesText: string; tasksText: string; checkpointsText: string }) => void }) {
  const [tool, setTool] = useState<"wall" | "task" | "checkpoint" | "erase">("wall");
  const walls = parseCoordinatePairs(props.blockagesText), tasks = parseCoordinatePairs(props.tasksText), checkpoints = parseCoordinatePairs(props.checkpointsText);
  const has = (cells: Tile[], row: number, col: number) => cells.some((cell) => cell.row === row && cell.col === col);
  const update = (row: number, col: number) => {
    if ((row === 1 && col === 1) || (row === props.rows && col === props.cols)) return;
    let nextWalls = walls.filter((cell) => !(cell.row === row && cell.col === col));
    let nextTasks = tasks.filter((cell) => !(cell.row === row && cell.col === col));
    let nextCheckpoints = checkpoints.filter((cell) => !(cell.row === row && cell.col === col));
    if (tool === "wall") nextWalls = [...nextWalls, { row, col }];
    if (tool === "task") nextTasks = [...nextTasks, { row, col }];
    if (tool === "checkpoint") nextCheckpoints = [...nextCheckpoints, { row, col }];
    props.onChange({ blockagesText: serializeCoordinatePairs(nextWalls), tasksText: serializeCoordinatePairs(nextTasks), checkpointsText: serializeCoordinatePairs(nextCheckpoints) });
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">{["wall", "task", "checkpoint", "erase"].map((entry) => <button key={entry} type="button" className={`${tool === entry ? "btn-primary" : "btn-secondary"} btn-sm`.trim()} onClick={() => setTool(entry as typeof tool)}>{entry}</button>)}</div>
      <div className="board-grid board-grid-smartboard" style={{ gridTemplateColumns: `repeat(${props.cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: props.rows }, (_, rowIndex) => Array.from({ length: props.cols }, (_, colIndex) => {
          const row = rowIndex + 1, col = colIndex + 1, isStart = row === 1 && col === 1, isGoal = row === props.rows && col === props.cols;
          const label = isStart ? "S" : isGoal ? "G" : has(walls, row, col) ? "#" : has(tasks, row, col) ? "T" : has(checkpoints, row, col) ? "C" : "";
          return <button key={`${row}-${col}`} type="button" className={`board-tile ${label === "#" ? "is-wall" : ""} ${label === "G" ? "is-goal" : ""} ${label === "T" || label === "C" ? "is-cleared" : ""}`.trim()} onClick={() => update(row, col)}><span>{label}</span></button>;
        }))}
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [isCreateMode, setIsCreateMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAiBusy, setIsAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("Create a polished game with 3 escalating levels, clear learning goals, and memorable level variety.");
  const [aiLevelCount, setAiLevelCount] = useState(3);
  const [levelRemovalNumber, setLevelRemovalNumber] = useState(1);
  const [coreForm, setCoreForm] = useState(createDefaultCoreState());
  const [mcqLevels, setMcqLevels] = useState<MCQLevelForm[]>([createDefaultMCQLevel(1)]);
  const [wordLevels, setWordLevels] = useState<WordLevelForm[]>([createDefaultWordLevel(1)]);
  const [gridLevels, setGridLevels] = useState<GridLevelForm[]>([createDefaultGridLevel(1)]);
  const [dragDropLevels, setDragDropLevels] = useState<DragDropLevelForm[]>([createDefaultDragDropLevel(1)]);
  const [boardLevels, setBoardLevels] = useState<BoardLevelForm[]>([createDefaultBoardLevel(1)]);
  const [customLevels, setCustomLevels] = useState<CustomLevelForm[]>([createDefaultCustomLevel(1, createDefaultCoreState().customRendererKind)]);
  const setAvailableGames = useGameStore((state) => state.setAvailableGames);

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
      timerConfig: { type: coreForm.timerType, duration: Math.max(10, Math.round(coreForm.timerDuration)), warningAt: parseIntegerList(coreForm.warningAtText) },
      scoringConfig: { basePoints: Math.max(1, Math.round(coreForm.basePoints)), bonusMultiplier: Math.max(0.1, coreForm.bonusMultiplier), penaltyPerHint: Math.max(0, Math.round(coreForm.penaltyPerHint)), penaltyPerWrong: Math.max(0, Math.round(coreForm.penaltyPerWrong)), timeBonusFormula: coreForm.timeBonusFormula, timeBonusMultiplier: Math.max(0, coreForm.timeBonusMultiplier) },
      uiConfig: { theme: "system" as const, primaryColor: "#0f766e", secondaryColor: "#f59e0b", iconSet: "lucide", layout: coreForm.smartboardEnabled ? "fullscreen" as const : "centered" as const, showTimer: true, showScore: true, showProgress: true, smartboard: { enabled: coreForm.smartboardEnabled, allowFullscreen: coreForm.smartboardFullscreen, autoScaleBoard: true, emphasizeControls: coreForm.smartboardEnabled } },
      metadata: { author: coreForm.author.trim() || "Admin", createdAt: now, updatedAt: now, tags: splitCsv(coreForm.tagsText), targetSkill: coreForm.targetSkill.trim() || "problem solving", estimatedPlayTime: Math.max(1, Math.round(coreForm.estimatedPlayTime)) },
      apiConfig: { leaderboardEndpoint: `/api/leaderboard/${coreForm.gameId.trim()}`, scoreSubmitEndpoint: "/api/score" },
      adaptiveConfig: coreForm.adaptiveEnabled ? { enabled: true, supportThreshold: coreForm.adaptiveSupportThreshold, challengeThreshold: coreForm.adaptiveChallengeThreshold, timerAdjustmentSeconds: coreForm.adaptiveTimerAdjustmentSeconds, multiplierAdjustment: coreForm.adaptiveMultiplierAdjustment, maxTimerAdjustmentSeconds: 30, minimumMultiplier: 0.75, maximumMultiplier: 2, adaptContent: true, adaptTimer: true, adaptScoring: true, adaptPenalties: true } : undefined,
      aiConfig: coreForm.aiEnabled ? { enabled: true, provider: coreForm.aiProvider, fallbackToLocal: true } : undefined,
      interactionConfig: { inputMode: "hybrid" as const, autoFocus: true, pointer: { dragEnabled: true, touchEnabled: true }, accessibility: { keyboardDragDrop: true, announceCommands: true } },
    };

    if (coreForm.gameType === "MCQ") return { ...baseConfig, levels: assignLevelNumbers(mcqLevels).map((level) => ({ levelNumber: level.levelNumber, timeLimit: level.timeLimit, bonusMultiplier: level.bonusMultiplier, shuffleQuestions: true, shuffleOptions: true, negativeMarking: coreForm.penaltyPerWrong > 0, questions: [{ id: `q-${level.levelNumber}`, question: level.question, options: [{ id: "A", text: level.optionA }, { id: "B", text: level.optionB }, { id: "C", text: level.optionC }, { id: "D", text: level.optionD }], correctOptionId: level.correctOptionId, difficulty: coreForm.difficulty }] })) };
    if (coreForm.gameType === "WORD") return { ...baseConfig, levels: assignLevelNumbers(wordLevels).map((level) => ({ levelNumber: level.levelNumber, timeLimit: level.timeLimit, bonusMultiplier: level.bonusMultiplier, availableLetters: splitCsv(level.availableLettersText), validWords: splitCsv(level.wordsText).map((word) => ({ word: word.toUpperCase(), points: 100, difficulty: coreForm.difficulty })), bonusWords: [], minWordLength: 2, maxWordLength: 12 })) };
    if (coreForm.gameType === "GRID") return { ...baseConfig, levels: assignLevelNumbers(gridLevels).map((level) => ({ levelNumber: level.levelNumber, timeLimit: level.timeLimit, bonusMultiplier: level.bonusMultiplier, gridSize: level.gridSize, preFilledCells: Array.from({ length: Math.max(1, level.cluesCount) }, (_, index) => ({ row: Math.floor(index / level.gridSize), col: index % level.gridSize, value: (index % level.gridSize) + 1 })), solution: Array.from({ length: level.gridSize }, (_, rowIndex) => Array.from({ length: level.gridSize }, (_, colIndex) => ((rowIndex + colIndex) % level.gridSize) + 1)), hints: [] })) };
    if (coreForm.gameType === "DRAG_DROP") return { ...baseConfig, levels: assignLevelNumbers(dragDropLevels).map((level) => { const items = splitCsv(level.itemsText).map((label, index) => ({ id: `item-${index + 1}`, label })); const targets = splitCsv(level.targetsText).map((label, index) => ({ id: `target-${index + 1}`, label, acceptsMultiple: false })); return { levelNumber: level.levelNumber, timeLimit: level.timeLimit, bonusMultiplier: level.bonusMultiplier, items, targets, correctMapping: items.reduce<Record<string, string>>((mapping, item, index) => ({ ...mapping, [item.id]: targets[index]?.id ?? targets[0]?.id ?? "target-1" }), {}) }; }) };
    if (coreForm.gameType === "BOARD") return { ...baseConfig, levels: assignLevelNumbers(boardLevels).map((level) => { const walls = parseCoordinatePairs(level.blockagesText), tasks = parseCoordinatePairs(level.tasksText), checkpoints = parseCoordinatePairs(level.checkpointsText); return { levelNumber: level.levelNumber, timeLimit: level.timeLimit, bonusMultiplier: level.bonusMultiplier, board: makeBoard(level.rows, level.cols, walls, tasks, checkpoints), tasks: makeBoardTasks(tasks), checkpoints: makeBoardCheckpoints(checkpoints), enemies: parseEnemyPatrols(level.enemyPatrolsText, level.rows, level.cols) }; }) };
    if (coreForm.gameType === "PLATFORMER") return { ...baseConfig, levels: assignLevelNumbers(customLevels).map((level) => { const walls = parseCoordinatePairs(level.boardBlockagesText), tasks = parseCoordinatePairs(level.boardTasksText), checkpoints = parseCoordinatePairs(level.boardCheckpointsText); return { levelNumber: level.levelNumber, timeLimit: level.timeLimit, bonusMultiplier: level.bonusMultiplier, name: level.levelName, objective: level.objective, instruction: level.instruction, successText: level.successText, renderer: { kind: "platformer" as const, strategy: "extend-board" as const }, boardGoalText: "Portal", board: makeBoard(level.boardRows, level.boardCols, walls, tasks, checkpoints), boardTasks: makeBoardTasks(tasks), boardCheckpoints: makeBoardCheckpoints(checkpoints), enemies: parseEnemyPatrols(level.enemyPatrolsText, level.boardRows, level.boardCols) }; }) };
    if (coreForm.gameType === "MATH") return { ...baseConfig, levels: assignLevelNumbers(customLevels).map((level) => ({ levelNumber: level.levelNumber, timeLimit: level.timeLimit, bonusMultiplier: level.bonusMultiplier, name: level.levelName, objective: level.objective, instruction: level.instruction, successText: level.successText, renderer: { kind: "math" as const, strategy: "extend-mcq" as const }, prompts: parseMathPrompts(level.promptsText), passingScore: level.passingScore })) };
    return { ...baseConfig, levels: [] };
  }, [boardLevels, coreForm, customLevels, dragDropLevels, gridLevels, mcqLevels, wordLevels]);

  const previewLevel = useMemo(() => (Array.isArray(generatedConfig.levels) ? generatedConfig.levels[0] : undefined) as Record<string, unknown> | undefined, [generatedConfig]);

  async function refreshOverview(): Promise<void> {
    setIsLoading(true); setError(null);
    try {
      const nextOverview = await getAdminOverview();
      setOverview(nextOverview);
      setAvailableGames(nextOverview.games.map((game) => ({ gameId: game.gameId, title: game.title, description: game.description, gameType: game.gameType, difficulty: game.difficulty, version: game.version, estimatedPlayTime: game.estimatedPlayTime, tags: game.tags })));
    } catch (loadError) { setError(toErrorMessage(loadError)); } finally { setIsLoading(false); }
  }

  useEffect(() => { void refreshOverview(); }, []);

  function switchToCreate(): void {
    const defaults = createDefaultCoreState();
    setCoreForm(defaults); setMcqLevels([createDefaultMCQLevel(1)]); setWordLevels([createDefaultWordLevel(1)]); setGridLevels([createDefaultGridLevel(1)]); setDragDropLevels([createDefaultDragDropLevel(1)]); setBoardLevels([createDefaultBoardLevel(1)]); setCustomLevels([createDefaultCustomLevel(1, defaults.customRendererKind)]); setSelectedGameId(""); setIsCreateMode(true); setError(null); setNotice("New game form ready."); setLevelRemovalNumber(1);
  }

  function hydrateBuilder(game: Record<string, any>, mode: "create" | "edit", gameId?: string): void {
    const defaults = createDefaultCoreState(); const rawGameType = String(game.gameType ?? defaults.gameType); const customKind = inferCustomRendererKind(Array.isArray(game.levels) ? game.levels[0] : undefined); const gameType = (rawGameType === "CUSTOM" ? (customKind === "math" ? "MATH" : "PLATFORMER") : rawGameType) as GameType;
    setCoreForm({ ...defaults, schemaVersion: game.schemaVersion === 2 ? 2 : 1, gameId: String(game.gameId ?? defaults.gameId), title: String(game.title ?? defaults.title), description: String(game.description ?? defaults.description), version: String(game.version ?? defaults.version), gameType, difficulty: parseDifficulty(game.difficulty), directoryName: mode === "edit" ? (overview?.games.find((entry) => entry.gameId === gameId)?.directory ?? "") : "", author: String(game.metadata?.author ?? defaults.author), targetSkill: String(game.metadata?.targetSkill ?? defaults.targetSkill), tagsText: Array.isArray(game.metadata?.tags) ? game.metadata.tags.join(",") : defaults.tagsText, estimatedPlayTime: Number(game.metadata?.estimatedPlayTime) || defaults.estimatedPlayTime, timerType: game.timerConfig?.type === "countup" ? "countup" : "countdown", timerDuration: Number(game.timerConfig?.duration) || defaults.timerDuration, warningAtText: Array.isArray(game.timerConfig?.warningAt) ? game.timerConfig.warningAt.join(",") : defaults.warningAtText, basePoints: Number(game.scoringConfig?.basePoints) || defaults.basePoints, bonusMultiplier: Number(game.scoringConfig?.bonusMultiplier) || defaults.bonusMultiplier, penaltyPerHint: Number(game.scoringConfig?.penaltyPerHint) || defaults.penaltyPerHint, penaltyPerWrong: Number(game.scoringConfig?.penaltyPerWrong) || defaults.penaltyPerWrong, timeBonusFormula: game.scoringConfig?.timeBonusFormula === "linear" || game.scoringConfig?.timeBonusFormula === "exponential" ? game.scoringConfig.timeBonusFormula : "none", timeBonusMultiplier: Number(game.scoringConfig?.timeBonusMultiplier) || defaults.timeBonusMultiplier, adaptiveEnabled: Boolean(game.adaptiveConfig?.enabled), adaptiveSupportThreshold: Number(game.adaptiveConfig?.supportThreshold) || defaults.adaptiveSupportThreshold, adaptiveChallengeThreshold: Number(game.adaptiveConfig?.challengeThreshold) || defaults.adaptiveChallengeThreshold, adaptiveTimerAdjustmentSeconds: Number(game.adaptiveConfig?.timerAdjustmentSeconds) || defaults.adaptiveTimerAdjustmentSeconds, adaptiveMultiplierAdjustment: Number(game.adaptiveConfig?.multiplierAdjustment) || defaults.adaptiveMultiplierAdjustment, aiEnabled: Boolean(game.aiConfig?.enabled ?? true), aiProvider: game.aiConfig?.provider === "openai-compatible" || game.aiConfig?.provider === "google-genai" ? game.aiConfig.provider : "local-template", smartboardEnabled: Boolean(game.uiConfig?.smartboard?.enabled), smartboardFullscreen: game.uiConfig?.smartboard?.allowFullscreen !== false, customRendererKind: customKind });
    const levels = Array.isArray(game.levels) ? game.levels : [];
    if (gameType === "MCQ") setMcqLevels(assignLevelNumbers(levels.map((level: any, index: number) => ({ levelNumber: Number(level.levelNumber) || index + 1, question: String(level.questions?.[0]?.question ?? `Level ${index + 1} question`), optionA: String(level.questions?.[0]?.options?.[0]?.text ?? "Option A"), optionB: String(level.questions?.[0]?.options?.[1]?.text ?? "Option B"), optionC: String(level.questions?.[0]?.options?.[2]?.text ?? "Option C"), optionD: String(level.questions?.[0]?.options?.[3]?.text ?? "Option D"), correctOptionId: level.questions?.[0]?.correctOptionId === "B" || level.questions?.[0]?.correctOptionId === "C" || level.questions?.[0]?.correctOptionId === "D" ? level.questions[0].correctOptionId : "A", timeLimit: Number(level.timeLimit) || undefined, bonusMultiplier: Number(level.bonusMultiplier) || undefined }))));
    if (gameType === "WORD") setWordLevels(assignLevelNumbers(levels.map((level: any, index: number) => ({ levelNumber: Number(level.levelNumber) || index + 1, availableLettersText: Array.isArray(level.availableLetters) ? level.availableLetters.join(",") : "C,A,T", wordsText: Array.isArray(level.validWords) ? level.validWords.map((entry: any) => String(entry.word)).join(",") : "CAT,DOG", timeLimit: Number(level.timeLimit) || undefined, bonusMultiplier: Number(level.bonusMultiplier) || undefined }))));
    if (gameType === "GRID") setGridLevels(assignLevelNumbers(levels.map((level: any, index: number) => ({ levelNumber: Number(level.levelNumber) || index + 1, gridSize: Number(level.gridSize) || 4, cluesCount: Array.isArray(level.preFilledCells) ? level.preFilledCells.length : 4, timeLimit: Number(level.timeLimit) || undefined, bonusMultiplier: Number(level.bonusMultiplier) || undefined }))));
    if (gameType === "DRAG_DROP") setDragDropLevels(assignLevelNumbers(levels.map((level: any, index: number) => ({ levelNumber: Number(level.levelNumber) || index + 1, itemsText: Array.isArray(level.items) ? level.items.map((item: any) => item.label).join(",") : "Apple,Carrot", targetsText: Array.isArray(level.targets) ? level.targets.map((target: any) => target.label).join(",") : "Fruit,Vegetable", timeLimit: Number(level.timeLimit) || undefined, bonusMultiplier: Number(level.bonusMultiplier) || undefined }))));
    if (gameType === "BOARD") setBoardLevels(assignLevelNumbers(levels.map((level: any, index: number) => ({ levelNumber: Number(level.levelNumber) || index + 1, rows: Array.isArray(level.board) ? level.board.length : 5, cols: Array.isArray(level.board) && level.board[0] ? String(level.board[0]).length : 6, blockagesText: Array.isArray(level.board) ? level.board.flatMap((row: string, rowIndex: number) => row.split("").map((tile, colIndex) => ({ tile, rowIndex, colIndex })).filter((entry) => entry.tile === "#").map((entry) => `${entry.rowIndex + 1},${entry.colIndex + 1}`)).join(";") : "", tasksText: Array.isArray(level.tasks) ? level.tasks.map((task: any) => `${Number(task.row) + 1},${Number(task.col) + 1}`).join(";") : "", checkpointsText: Array.isArray(level.checkpoints) ? level.checkpoints.map((checkpoint: any) => `${Number(checkpoint.row) + 1},${Number(checkpoint.col) + 1}`).join(";") : "", enemyPatrolsText: Array.isArray(level.enemies) ? level.enemies.map((enemy: any) => [Number(enemy.row) + 1, Number(enemy.col) + 1, enemy.movement === "vertical" ? "vertical" : "horizontal", Number(enemy.min) + 1, Number(enemy.max) + 1, Number(enemy.speed) || 1].join(",")).join(";") : "", timeLimit: Number(level.timeLimit) || undefined, bonusMultiplier: Number(level.bonusMultiplier) || undefined }))));
    if (gameType === "PLATFORMER" || gameType === "MATH") setCustomLevels(assignLevelNumbers(levels.map((level: any, index: number) => { const rendererKind = gameType === "MATH" ? "math" : "platformer"; return { levelNumber: Number(level.levelNumber) || index + 1, levelName: String(level.name ?? `Level ${index + 1}`), objective: String(level.objective ?? "Complete the objective"), instruction: String(level.instruction ?? "Follow the instructions"), successText: String(level.successText ?? "Great job!"), rendererKind, scenarioCheckpointsText: "", boardRows: Array.isArray(level.board) ? level.board.length : 4, boardCols: Array.isArray(level.board) && level.board[0] ? String(level.board[0]).length : 7, boardBlockagesText: Array.isArray(level.board) ? level.board.flatMap((row: string, rowIndex: number) => row.split("").map((tile, colIndex) => ({ tile, rowIndex, colIndex })).filter((entry) => entry.tile === "#").map((entry) => `${entry.rowIndex + 1},${entry.colIndex + 1}`)).join(";") : "", boardTasksText: Array.isArray(level.boardTasks) ? level.boardTasks.map((task: any) => `${Number(task.row) + 1},${Number(task.col) + 1}`).join(";") : "", boardCheckpointsText: Array.isArray(level.boardCheckpoints) ? level.boardCheckpoints.map((checkpoint: any) => `${Number(checkpoint.row) + 1},${Number(checkpoint.col) + 1}`).join(";") : "", enemyPatrolsText: Array.isArray(level.enemies) ? level.enemies.map((enemy: any) => [Number(enemy.row) + 1, Number(enemy.col) + 1, enemy.movement === "vertical" ? "vertical" : "horizontal", Number(enemy.min) + 1, Number(enemy.max) + 1, Number(enemy.speed) || 1].join(",")).join(";") : "", promptsText: Array.isArray(level.prompts) ? serializeMathPrompts(level.prompts) : "8 + 4 = ?|12|12|10|14|11", passingScore: Number(level.passingScore) || 70, timeLimit: Number(level.timeLimit) || undefined, bonusMultiplier: Number(level.bonusMultiplier) || undefined }; })));
    setSelectedGameId(mode === "edit" ? (gameId ?? String(game.gameId ?? "")) : ""); setIsCreateMode(mode === "create");
  }

  async function loadGameIntoBuilder(gameId: string): Promise<void> { setError(null); setNotice(null); try { hydrateBuilder(await getAdminGame(gameId) as Record<string, any>, "edit", gameId); setNotice("Game loaded into the builder."); } catch (loadError) { setError(toErrorMessage(loadError)); } }
  async function saveGame(): Promise<void> { setIsSaving(true); setError(null); setNotice(null); try { if (isCreateMode) { await createAdminGame(generatedConfig, coreForm.directoryName || undefined); setSelectedGameId(String(generatedConfig.gameId ?? coreForm.gameId)); setIsCreateMode(false); setNotice("Game created successfully and loaded for editing."); } else { if (!selectedGameId) throw new Error("Select a game to update."); await updateAdminGame(selectedGameId, generatedConfig); setNotice("Game updated successfully."); } await refreshOverview(); } catch (saveError) { setError(toErrorMessage(saveError)); } finally { setIsSaving(false); } }
  async function removeGame(): Promise<void> { if (!selectedGameId || isCreateMode) { setError("Choose an existing game before deleting."); return; } if (!window.confirm(`Delete '${selectedGameId}' and its folder?`)) return; setIsDeleting(true); setError(null); setNotice(null); try { await deleteAdminGame(selectedGameId); switchToCreate(); await refreshOverview(); setNotice("Game deleted successfully."); } catch (deleteError) { setError(toErrorMessage(deleteError)); } finally { setIsDeleting(false); } }
  async function generateAiGameDraft(): Promise<void> { setIsAiBusy(true); setError(null); setNotice(null); try { hydrateBuilder(await generateAdminGameDraft({ prompt: aiPrompt, gameType: coreForm.gameType, difficulty: coreForm.difficulty, targetSkill: coreForm.targetSkill, aiProvider: coreForm.aiProvider }) as Record<string, any>, "create"); setNotice("AI drafted a new game. Review and save when ready."); } catch (aiError) { setError(toErrorMessage(aiError)); } finally { setIsAiBusy(false); } }
  async function generateAiLevels(): Promise<void> { setIsAiBusy(true); setError(null); setNotice(null); try { hydrateBuilder(await generateAdminLevels({ config: generatedConfig, prompt: aiPrompt, count: aiLevelCount, aiProvider: coreForm.aiProvider }) as Record<string, any>, isCreateMode ? "create" : "edit", selectedGameId); setNotice(`AI appended ${aiLevelCount} level(s) after reading the current progression.`); } catch (aiError) { setError(toErrorMessage(aiError)); } finally { setIsAiBusy(false); } }

  const addLevel = () => coreForm.gameType === "MCQ" ? setMcqLevels((prev) => [...assignLevelNumbers(prev), createDefaultMCQLevel(prev.length + 1)]) : coreForm.gameType === "WORD" ? setWordLevels((prev) => [...assignLevelNumbers(prev), createDefaultWordLevel(prev.length + 1)]) : coreForm.gameType === "GRID" ? setGridLevels((prev) => [...assignLevelNumbers(prev), createDefaultGridLevel(prev.length + 1)]) : coreForm.gameType === "DRAG_DROP" ? setDragDropLevels((prev) => [...assignLevelNumbers(prev), createDefaultDragDropLevel(prev.length + 1)]) : coreForm.gameType === "BOARD" ? setBoardLevels((prev) => [...assignLevelNumbers(prev), createDefaultBoardLevel(prev.length + 1)]) : setCustomLevels((prev) => [...assignLevelNumbers(prev), createDefaultCustomLevel(prev.length + 1, coreForm.gameType === "MATH" ? "math" : "platformer")]);
  const removeLastLevel = () => coreForm.gameType === "MCQ" ? setMcqLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev) : coreForm.gameType === "WORD" ? setWordLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev) : coreForm.gameType === "GRID" ? setGridLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev) : coreForm.gameType === "DRAG_DROP" ? setDragDropLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev) : coreForm.gameType === "BOARD" ? setBoardLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev) : setCustomLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.slice(0, -1)) : prev);
  const removeLevelAt = (levelIndex: number) => {
    if (levelIndex < 0) return;
    if (coreForm.gameType === "MCQ") setMcqLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.filter((_, index) => index !== levelIndex)) : prev);
    else if (coreForm.gameType === "WORD") setWordLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.filter((_, index) => index !== levelIndex)) : prev);
    else if (coreForm.gameType === "GRID") setGridLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.filter((_, index) => index !== levelIndex)) : prev);
    else if (coreForm.gameType === "DRAG_DROP") setDragDropLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.filter((_, index) => index !== levelIndex)) : prev);
    else if (coreForm.gameType === "BOARD") setBoardLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.filter((_, index) => index !== levelIndex)) : prev);
    else setCustomLevels((prev) => prev.length > 1 ? assignLevelNumbers(prev.filter((_, index) => index !== levelIndex)) : prev);
  };
  const activeLevelCount = coreForm.gameType === "MCQ" ? mcqLevels.length : coreForm.gameType === "WORD" ? wordLevels.length : coreForm.gameType === "GRID" ? gridLevels.length : coreForm.gameType === "DRAG_DROP" ? dragDropLevels.length : coreForm.gameType === "BOARD" ? boardLevels.length : customLevels.length;
  useEffect(() => { setLevelRemovalNumber((current) => Math.max(1, Math.min(current, activeLevelCount))); }, [activeLevelCount]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div><p className="eyebrow mb-1">Admin Dashboard</p><h1 className="font-display font-bold text-2xl text-ink">AI Builder + Engine Authoring</h1></div>
        <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={() => void refreshOverview()} disabled={isLoading}>{isLoading ? "Refreshing..." : "Refresh"}</Button><Button size="sm" onClick={switchToCreate}>New Game</Button></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">{[{ label: "Total Games", value: overview?.overall.totalGames ?? 0 }, { label: "Submissions", value: overview?.overall.submissions ?? 0 }, { label: "Valid Ranked", value: overview?.overall.validSubmissions ?? 0 }, { label: "Players", value: overview?.overall.players ?? 0 }].map((stat) => <div key={stat.label} className="metric-block bg-white border border-gray-100 shadow-card"><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div><p className="eyebrow mb-0.5">Game Builder</p><h2 className="font-display font-bold text-lg text-ink">{isCreateMode ? "Create New Game" : `Editing ${selectedGameId}`}</h2></div>
              <div className="flex gap-2"><Button onClick={() => void saveGame()} disabled={isSaving} size="sm">{isSaving ? "Saving..." : isCreateMode ? "Create Game" : "Update Game"}</Button>{!isCreateMode ? <Button variant="danger" size="sm" onClick={() => void removeGame()} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</Button> : null}</div>
            </div>
            {error ? <p className="admin-status admin-status-error">{error}</p> : null}
            {notice ? <p className="admin-status admin-status-success">{notice}</p> : null}
            <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 space-y-3">
              <p className="eyebrow mb-1">AI Authoring</p>
              <textarea className="admin-input" value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Describe the theme, pacing, and learning outcome you want." />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5"><span className="admin-label">AI Provider</span><select className="admin-input" value={coreForm.aiProvider} onChange={(event) => setCoreForm((current) => ({ ...current, aiProvider: event.target.value as AIProvider }))}><option value="local-template">Local Template</option><option value="openai-compatible">OpenAI Compatible</option><option value="google-genai">Google GenAI</option></select></label>
                <label className="flex flex-col gap-1.5"><span className="admin-label">New Levels</span><input type="number" min={1} max={10} className="admin-input" value={aiLevelCount} onChange={(event) => setAiLevelCount(Math.min(10, Math.max(1, Number(event.target.value) || 1)))} /></label>
              </div>
              <div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" onClick={() => void generateAiGameDraft()} disabled={isAiBusy}>{isAiBusy ? "Working..." : "AI Draft New Game"}</Button><Button variant="secondary" size="sm" onClick={() => void generateAiLevels()} disabled={isAiBusy}>{isAiBusy ? "Working..." : "AI Add Levels"}</Button></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5"><span className="admin-label">Game ID</span><input className="admin-input" value={coreForm.gameId} onChange={(event) => setCoreForm((current) => ({ ...current, gameId: event.target.value }))} /></label>
              <label className="flex flex-col gap-1.5"><span className="admin-label">Title</span><input className="admin-input" value={coreForm.title} onChange={(event) => setCoreForm((current) => ({ ...current, title: event.target.value }))} /></label>
              <label className="flex flex-col gap-1.5 sm:col-span-2"><span className="admin-label">Description</span><textarea className="admin-input" value={coreForm.description} onChange={(event) => setCoreForm((current) => ({ ...current, description: event.target.value }))} /></label>
              <label className="flex flex-col gap-1.5"><span className="admin-label">Game Type</span><select className="admin-input" value={coreForm.gameType} onChange={(event) => setCoreForm((current) => ({ ...current, gameType: event.target.value as GameType }))}><option value="BOARD">Maze / Board Runner</option><option value="PLATFORMER">Platformer</option><option value="MATH">Math Sprint</option><option value="MCQ">Quiz</option><option value="WORD">Word Builder</option><option value="GRID">Number Grid</option><option value="DRAG_DROP">Drag and Drop</option></select></label>
              <label className="flex flex-col gap-1.5"><span className="admin-label">Difficulty</span><select className="admin-input" value={coreForm.difficulty} onChange={(event) => setCoreForm((current) => ({ ...current, difficulty: event.target.value as Difficulty }))}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
              <label className="flex flex-col gap-1.5"><span className="admin-label">Target Skill</span><select className="admin-input" value={coreForm.targetSkill} onChange={(event) => setCoreForm((current) => ({ ...current, targetSkill: event.target.value }))}>{LEARNING_OUTCOMES.map((outcome) => <option key={outcome} value={outcome}>{titleCase(outcome)}</option>)}</select></label>
              <label className="flex flex-col gap-1.5"><span className="admin-label">Folder Name</span><input className="admin-input" value={coreForm.directoryName} disabled={!isCreateMode} onChange={(event) => setCoreForm((current) => ({ ...current, directoryName: event.target.value }))} /></label>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap"><div><p className="eyebrow mb-1">Levels</p><h3 className="font-display font-semibold text-ink">Author progression visually</h3></div><div className="flex gap-2 flex-wrap items-center"><Button variant="secondary" size="sm" onClick={addLevel}>Add Level</Button><Button variant="secondary" size="sm" onClick={removeLastLevel} disabled={activeLevelCount <= 1}>Remove Last</Button><input type="number" min={1} max={activeLevelCount} className="admin-input w-24" value={levelRemovalNumber} onChange={(event) => setLevelRemovalNumber(Math.max(1, Math.min(activeLevelCount, Number(event.target.value) || 1)))} /><Button variant="secondary" size="sm" onClick={() => removeLevelAt(levelRemovalNumber - 1)} disabled={activeLevelCount <= 1}>Remove Level #</Button></div></div>
            {coreForm.gameType === "MCQ" ? mcqLevels.map((level, levelIndex) => <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 sm:col-span-2"><span className="admin-label">Question</span><input className="admin-input" value={level.question} onChange={(event) => setMcqLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, question: event.target.value } : entry)))} /></label><label className="flex flex-col gap-1.5"><span className="admin-label">Option A</span><input className="admin-input" value={level.optionA} onChange={(event) => setMcqLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, optionA: event.target.value } : entry)))} /></label><label className="flex flex-col gap-1.5"><span className="admin-label">Option B</span><input className="admin-input" value={level.optionB} onChange={(event) => setMcqLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, optionB: event.target.value } : entry)))} /></label><label className="flex flex-col gap-1.5"><span className="admin-label">Option C</span><input className="admin-input" value={level.optionC} onChange={(event) => setMcqLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, optionC: event.target.value } : entry)))} /></label><label className="flex flex-col gap-1.5"><span className="admin-label">Option D</span><input className="admin-input" value={level.optionD} onChange={(event) => setMcqLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, optionD: event.target.value } : entry)))} /></label></div>) : null}
            {coreForm.gameType === "BOARD" ? boardLevels.map((level, levelIndex) => <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-4"><div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5"><span className="admin-label">Rows</span><input type="number" min={3} className="admin-input" value={level.rows} onChange={(event) => setBoardLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, rows: Math.max(3, Number(event.target.value) || 3) } : entry)))} /></label><label className="flex flex-col gap-1.5"><span className="admin-label">Cols</span><input type="number" min={3} className="admin-input" value={level.cols} onChange={(event) => setBoardLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, cols: Math.max(3, Number(event.target.value) || 3) } : entry)))} /></label></div><BoardPainter rows={level.rows} cols={level.cols} blockagesText={level.blockagesText} tasksText={level.tasksText} checkpointsText={level.checkpointsText} onChange={(next) => setBoardLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, ...next } : entry)))} /><label className="flex flex-col gap-1.5"><span className="admin-label">Enemy Patrols</span><textarea className="admin-input" value={level.enemyPatrolsText} onChange={(event) => setBoardLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, enemyPatrolsText: event.target.value } : entry)))} /></label></div>) : null}
            {coreForm.gameType === "PLATFORMER" ? customLevels.map((level, levelIndex) => <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="flex flex-col gap-1.5"><span className="admin-label">Level Name</span><input className="admin-input" value={level.levelName} onChange={(event) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, levelName: event.target.value } : entry)))} /></label><label className="flex flex-col gap-1.5"><span className="admin-label">Objective</span><input className="admin-input" value={level.objective} onChange={(event) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, objective: event.target.value } : entry)))} /></label><label className="flex flex-col gap-1.5 sm:col-span-2"><span className="admin-label">Instruction</span><textarea className="admin-input" value={level.instruction} onChange={(event) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, instruction: event.target.value } : entry)))} /></label></div><BoardPainter rows={level.boardRows} cols={level.boardCols} blockagesText={level.boardBlockagesText} tasksText={level.boardTasksText} checkpointsText={level.boardCheckpointsText} onChange={(next) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, boardBlockagesText: next.blockagesText, boardTasksText: next.tasksText, boardCheckpointsText: next.checkpointsText } : entry)))} /><label className="flex flex-col gap-1.5"><span className="admin-label">Enemy Patrols</span><textarea className="admin-input" value={level.enemyPatrolsText} onChange={(event) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, enemyPatrolsText: event.target.value } : entry)))} /></label></div>) : null}
            {coreForm.gameType === "MATH" ? customLevels.map((level, levelIndex) => <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="flex flex-col gap-1.5"><span className="admin-label">Level Name</span><input className="admin-input" value={level.levelName} onChange={(event) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, levelName: event.target.value } : entry)))} /></label><label className="flex flex-col gap-1.5"><span className="admin-label">Passing Score</span><input type="number" min={1} max={100} className="admin-input" value={level.passingScore} onChange={(event) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, passingScore: Math.max(1, Math.min(100, Number(event.target.value) || 70)) } : entry)))} /></label><label className="flex flex-col gap-1.5 sm:col-span-2"><span className="admin-label">Objective</span><input className="admin-input" value={level.objective} onChange={(event) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, objective: event.target.value } : entry)))} /></label><label className="flex flex-col gap-1.5 sm:col-span-2"><span className="admin-label">Prompts</span><textarea className="admin-input" value={level.promptsText} onChange={(event) => setCustomLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, promptsText: event.target.value } : entry)))} /></label></div></div>) : null}
            {coreForm.gameType === "WORD" ? wordLevels.map((level, levelIndex) => <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 grid gap-3"><input className="admin-input" value={level.availableLettersText} onChange={(event) => setWordLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, availableLettersText: event.target.value } : entry)))} /><input className="admin-input" value={level.wordsText} onChange={(event) => setWordLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, wordsText: event.target.value } : entry)))} /></div>) : null}
            {coreForm.gameType === "GRID" ? gridLevels.map((level, levelIndex) => <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 grid grid-cols-2 gap-3"><input type="number" min={2} max={9} className="admin-input" value={level.gridSize} onChange={(event) => setGridLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, gridSize: Math.max(2, Number(event.target.value) || 2) } : entry)))} /><input type="number" min={1} className="admin-input" value={level.cluesCount} onChange={(event) => setGridLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, cluesCount: Math.max(1, Number(event.target.value) || 1) } : entry)))} /></div>) : null}
            {coreForm.gameType === "DRAG_DROP" ? dragDropLevels.map((level, levelIndex) => <div key={levelIndex} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 grid gap-3"><input className="admin-input" value={level.itemsText} onChange={(event) => setDragDropLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, itemsText: event.target.value } : entry)))} /><input className="admin-input" value={level.targetsText} onChange={(event) => setDragDropLevels((prev) => assignLevelNumbers(prev.map((entry, index) => index === levelIndex ? { ...entry, targetsText: event.target.value } : entry)))} /></div>) : null}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6"><p className="eyebrow mb-1">Preview</p><h3 className="font-display font-semibold text-ink mb-4">Level 1 Snapshot</h3>{"board" in (previewLevel ?? {}) ? <div className="space-y-3"><div className="board-grid board-grid-smartboard" style={{ gridTemplateColumns: `repeat(${String((previewLevel?.board as string[])[0] ?? "").length || 1}, minmax(0, 1fr))` }}>{((previewLevel?.board as string[]) ?? []).flatMap((row, rowIndex) => row.split("").map((tile, colIndex) => <div key={`${rowIndex}-${colIndex}`} className={`board-tile ${tile === "#" ? "is-wall" : ""} ${tile === "G" ? "is-goal" : ""}`.trim()}><span>{tile === "." ? "" : tile}</span></div>))}</div></div> : null}{"prompts" in (previewLevel ?? {}) ? <div className="space-y-2">{((previewLevel?.prompts as Array<{ prompt: string }>) ?? []).slice(0, 2).map((prompt) => <div key={prompt.prompt} className="option-card"><span>{prompt.prompt}</span></div>)}</div> : null}{"checkpoints" in (previewLevel ?? {}) && !("prompts" in (previewLevel ?? {})) ? <div className="space-y-2">{(((previewLevel?.checkpoints as Array<string | { id?: string; label?: string; row?: number; col?: number }>) ?? [])).map((checkpoint, index) => { const label = typeof checkpoint === "string" ? checkpoint : checkpoint.label ?? `Checkpoint ${index + 1}`; const key = typeof checkpoint === "string" ? checkpoint : checkpoint.id ?? `${checkpoint.row ?? 0}-${checkpoint.col ?? 0}-${index}`; return <div key={key} className="mapping-row"><span>{label}</span><span className="tag-chip">checkpoint</span></div>; })}</div> : null}</div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6"><p className="eyebrow mb-1">Generated JSON</p><pre className="text-xs font-mono bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-96 text-ink-muted">{JSON.stringify(generatedConfig, null, 2)}</pre></div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6"><h3 className="font-display font-bold text-ink mb-4">All Games</h3><div className="overflow-x-auto"><table className="admin-table"><thead><tr><th>Game</th><th>Type</th><th>Submissions</th><th></th></tr></thead><tbody>{(overview?.games ?? []).map((game) => <tr key={game.gameId} className={game.gameId === selectedGameId ? "is-selected" : ""}><td><strong className="text-sm">{game.title}</strong><div className="table-subtext">{game.gameId}</div></td><td><span className="game-type-badge">{game.gameType}</span></td><td className="text-sm">{game.submissions}</td><td><Button variant="ghost" size="sm" onClick={() => void loadGameIntoBuilder(game.gameId)}>Edit</Button></td></tr>)}</tbody></table></div></div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-6"><p className="eyebrow mb-1">Learning Outcomes</p><div className="space-y-2">{LEARNING_OUTCOMES.map((outcome) => <div key={outcome} className={`mapping-row ${coreForm.targetSkill === outcome ? "border-teal-200 bg-teal-50" : ""}`.trim()}><span>{titleCase(outcome)}</span><span className="tag-chip">{coreForm.targetSkill === outcome ? "active" : "available"}</span></div>)}</div></div>
        </div>
      </div>
    </div>
  );
}
