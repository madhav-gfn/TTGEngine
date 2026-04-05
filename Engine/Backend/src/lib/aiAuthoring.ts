import { listGameConfigDirectories } from "./gameConfigs.js";
import {
  parseGameConfig,
  type AIConfig,
  type AnyGameConfig,
  type BoardCheckpoint,
  type BoardEnemy,
  type BoardLevelConfig,
  type BoardTask,
  type CustomLevelConfig,
  type CustomPrompt,
  type CustomRendererKind,
  type Difficulty,
  type GameType,
  TimeBonusFormula,
  TimerType,
} from "./gameSchema.js";
import { extractJsonPayload, requestJsonFromProvider, type SupportedAiProvider } from "./aiTextGeneration.js";
import { runtimeConfig } from "./runtimeConfig.js";

interface DraftGameRequest {
  prompt: string;
  gameType: GameType;
  difficulty: Difficulty;
  targetSkill: string;
  aiProvider?: AIConfig["provider"];
  customRendererKind?: CustomRendererKind;
}

interface ExpandLevelsRequest {
  config: AnyGameConfig;
  prompt: string;
  count: number;
  aiProvider?: AIConfig["provider"];
}

const MIN_DRAFT_LEVELS = 3;
const MAX_EXPAND_LEVELS = 10;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeGameId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "ai-game";
}

function titleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((token) => token[0]?.toUpperCase() + token.slice(1))
    .join(" ");
}

function getExistingGameIds(): Set<string> {
  return new Set(listGameConfigDirectories().map((entry) => entry.gameId));
}

function ensureUniqueGameId(preferred: string, reserved = getExistingGameIds()): string {
  const baseId = sanitizeGameId(preferred);
  if (!reserved.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (reserved.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function extractThemeTokens(prompt: string): string[] {
  const tokens = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !["level", "levels", "game", "games", "with", "make", "create"].includes(token));

  return tokens.slice(0, 4);
}

function inferThemeLabel(prompt: string): string {
  return titleCase(extractThemeTokens(prompt).slice(0, 2).join(" ") || "Spark");
}

function themeNoun(prompt: string, fallback: string): string {
  return titleCase(extractThemeTokens(prompt)[1] ?? fallback);
}

function createReservedCellSet(cells: Array<{ row: number; col: number }>): Set<string> {
  return new Set(cells.map((cell) => `${cell.row}:${cell.col}`));
}

function findNextAvailableCell(
  openCells: Array<{ row: number; col: number }>,
  reserved: Set<string>,
  startIndex: number,
): { row: number; col: number } | null {
  if (openCells.length === 0) {
    return null;
  }

  for (let offset = 0; offset < openCells.length; offset += 1) {
    const cell = openCells[(startIndex + offset) % openCells.length];
    const key = `${cell.row}:${cell.col}`;
    if (!reserved.has(key)) {
      reserved.add(key);
      return cell;
    }
  }

  return null;
}

function buildBoard(
  rows: number,
  cols: number,
  walls: Array<{ row: number; col: number }>,
  tasks: Array<{ row: number; col: number }>,
  checkpoints: Array<{ row: number; col: number }>,
): string[] {
  const board = Array.from({ length: rows }, () => Array.from({ length: cols }, () => "."));
  board[0][0] = "S";
  board[rows - 1][cols - 1] = "G";

  walls.forEach((cell) => {
    if ((cell.row === 0 && cell.col === 0) || (cell.row === rows - 1 && cell.col === cols - 1)) {
      return;
    }

    if (cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols) {
      board[cell.row][cell.col] = "#";
    }
  });

  checkpoints.forEach((cell) => {
    if (board[cell.row]?.[cell.col] === ".") {
      board[cell.row][cell.col] = "C";
    }
  });

  tasks.forEach((cell) => {
    if (board[cell.row]?.[cell.col] === ".") {
      board[cell.row][cell.col] = "T";
    }
  });

  return board.map((row) => row.join(""));
}

function buildBarrierWalls(rows: number, cols: number, levelNumber: number): Array<{ row: number; col: number }> {
  const walls: Array<{ row: number; col: number }> = [];

  for (let row = 2; row < rows - 1; row += 2) {
    const gapCol = 1 + ((levelNumber * 3 + row) % Math.max(1, cols - 2));
    for (let col = 1; col < cols - 1; col += 1) {
      if (col !== gapCol) {
        walls.push({ row, col });
      }
    }
  }

  return walls;
}

function getOpenCells(rows: number, cols: number, walls: Array<{ row: number; col: number }>): Array<{ row: number; col: number }> {
  const wallSet = createReservedCellSet(walls);
  const cells: Array<{ row: number; col: number }> = [];

  for (let row = 1; row < rows - 1; row += 1) {
    for (let col = 1; col < cols - 1; col += 1) {
      if (!wallSet.has(`${row}:${col}`)) {
        cells.push({ row, col });
      }
    }
  }

  return cells;
}

function makeBoardTasks(
  levelNumber: number,
  prompt: string,
  openCells: Array<{ row: number; col: number }>,
  reserved: Set<string>,
): BoardTask[] {
  const taskCount = clamp(2 + Math.floor(levelNumber / 2), 2, 5);
  const theme = themeNoun(prompt, "Token");

  return Array.from({ length: taskCount }, (_, index) => {
    const startIndex = Math.floor((openCells.length * (index + 1)) / (taskCount + 1));
    const cell = findNextAvailableCell(openCells, reserved, startIndex) ?? { row: 1 + index, col: 1 + index };

    return {
      id: `task-${levelNumber}-${index + 1}`,
      row: cell.row,
      col: cell.col,
      label: `${theme} ${index + 1}`,
    };
  });
}

function makeBoardCheckpoints(
  levelNumber: number,
  prompt: string,
  openCells: Array<{ row: number; col: number }>,
  reserved: Set<string>,
): BoardCheckpoint[] {
  const checkpointCount = openCells.length > 18 ? 2 : 1;
  const theme = themeNoun(prompt, "Gate");

  return Array.from({ length: checkpointCount }, (_, index) => {
    const startIndex = Math.floor((openCells.length * (index + 1)) / (checkpointCount + 1));
    const cell = findNextAvailableCell(openCells, reserved, startIndex) ?? { row: 1 + index, col: 2 + index };

    return {
      id: `checkpoint-${levelNumber}-${index + 1}`,
      row: cell.row,
      col: cell.col,
      label: `${theme} Gate ${index + 1}`,
      required: true,
    };
  });
}

function makeBoardEnemies(rows: number, cols: number, difficulty: Difficulty, levelNumber: number): BoardEnemy[] {
  const openPatrolRows = Array.from({ length: rows - 2 }, (_, index) => index + 1).filter((row) => row % 2 === 1);
  const desiredEnemyCount =
    difficulty === "hard"
      ? clamp(2 + Math.floor(levelNumber / 3), 2, 4)
      : difficulty === "medium"
        ? clamp(1 + Math.floor(levelNumber / 4), 1, 3)
        : levelNumber >= 3
          ? 1
          : 0;

  return Array.from({ length: Math.min(desiredEnemyCount, openPatrolRows.length) }, (_, index) => {
    const patrolRow = openPatrolRows[index];
    return {
      id: `enemy-${levelNumber}-${index + 1}`,
      row: patrolRow,
      col: 1 + ((levelNumber + index) % Math.max(1, cols - 2)),
      movement: "horizontal",
      min: 1,
      max: cols - 2,
      speed: clamp(1 + Math.floor((levelNumber + index) / 3), 1, 4),
      direction: index % 2 === 0 ? "forward" : "reverse",
    };
  });
}

function createBoardBlueprint(options: {
  levelNumber: number;
  difficulty: Difficulty;
  prompt: string;
  previousBoard?: string[];
}): {
  rows: number;
  cols: number;
  board: string[];
  tasks: BoardTask[];
  checkpoints: BoardCheckpoint[];
  enemies: BoardEnemy[];
} {
  const previousRows = options.previousBoard?.length ?? 0;
  const previousCols = options.previousBoard?.[0]?.length ?? 0;
  const rows = clamp(previousRows > 0 ? previousRows + 1 : 5 + options.levelNumber, 5, 10);
  const cols = clamp(previousCols > 0 ? previousCols + (options.levelNumber % 2 === 0 ? 1 : 0) : 6 + options.levelNumber, 6, 12);
  const walls = buildBarrierWalls(rows, cols, options.levelNumber);
  const openCells = getOpenCells(rows, cols, walls);
  const reserved = createReservedCellSet([{ row: 0, col: 0 }, { row: rows - 1, col: cols - 1 }]);
  const checkpoints = makeBoardCheckpoints(options.levelNumber, options.prompt, openCells, reserved);
  const tasks = makeBoardTasks(options.levelNumber, options.prompt, openCells, reserved);
  const enemies = makeBoardEnemies(rows, cols, options.difficulty, options.levelNumber);

  return {
    rows,
    cols,
    board: buildBoard(
      rows,
      cols,
      walls,
      tasks.map((task) => ({ row: task.row, col: task.col })),
      checkpoints.map((checkpoint) => ({ row: checkpoint.row, col: checkpoint.col })),
    ),
    tasks,
    checkpoints,
    enemies,
  };
}

function createBoardLevel(
  levelNumber: number,
  difficulty: Difficulty,
  prompt: string,
  previousLevel?: BoardLevelConfig,
): BoardLevelConfig {
  const blueprint = createBoardBlueprint({
    levelNumber,
    difficulty,
    prompt,
    previousBoard: previousLevel?.board,
  });

  return {
    levelNumber,
    timeLimit: clamp(80 + levelNumber * 12, 60, 180),
    bonusMultiplier: Number((1 + levelNumber * 0.18).toFixed(2)),
    board: blueprint.board,
    tasks: blueprint.tasks,
    checkpoints: blueprint.checkpoints,
    enemies: blueprint.enemies,
    enemyCollisionPenalty: difficulty === "easy" ? 0 : difficulty === "medium" ? 10 : 15,
  };
}

function createPlatformerLevel(
  levelNumber: number,
  prompt: string,
  difficulty: Difficulty,
  previousLevel?: CustomLevelConfig,
): CustomLevelConfig {
  const blueprint = createBoardBlueprint({
    levelNumber,
    difficulty,
    prompt,
    previousBoard: previousLevel?.board,
  });
  const theme = inferThemeLabel(prompt);

  return {
    levelNumber,
    name: `${theme} Run ${levelNumber}`,
    objective: `Reach the portal, grab every ${theme.toLowerCase()} token, and survive the patrol pressure.`,
    instruction: "Move quickly, thread through the lanes, activate every checkpoint, and time each dodge around the enemy sweeps.",
    successText: "Portal secured. Momentum maintained.",
    renderer: {
      kind: "platformer",
      strategy: "extend-board",
      title: `${theme} Platformer`,
      instructions: "A board-driven platform run with patrol timing, collectibles, and checkpoints.",
      accentColor: "#f97316",
    },
    boardGoalText: "Portal",
    board: blueprint.board,
    boardTasks: blueprint.tasks,
    boardCheckpoints: blueprint.checkpoints,
    enemies: blueprint.enemies,
    timeLimit: clamp(75 + levelNumber * 10, 60, 170),
    bonusMultiplier: Number((1 + levelNumber * 0.15).toFixed(2)),
  };
}

function createMathPrompt(levelNumber: number, index: number, difficulty: Difficulty): CustomPrompt {
  const seed = levelNumber * 11 + index * 5;
  const operationIndex = (levelNumber + index) % 4;
  const left = clamp(seed + 6, 7, 99);
  const right = clamp(index + levelNumber + 2, 2, difficulty === "easy" ? 9 : 12);

  let prompt = "";
  let answer = 0;
  if (operationIndex === 0) {
    prompt = `${left} + ${right}`;
    answer = left + right;
  } else if (operationIndex === 1) {
    prompt = `${left + right} - ${right}`;
    answer = left;
  } else if (operationIndex === 2) {
    const factor = clamp(levelNumber + 2, 3, 9);
    prompt = `${factor} x ${right}`;
    answer = factor * right;
  } else {
    const divisor = clamp(index + 2, 2, 9);
    const quotient = clamp(levelNumber + index + 3, 4, 12);
    prompt = `${divisor * quotient} / ${divisor}`;
    answer = quotient;
  }

  const distractors = Array.from(new Set([
    answer + 1,
    answer - 1,
    answer + right,
    Math.max(0, answer - right),
  ]))
    .filter((value) => value !== answer)
    .slice(0, 3);

  const optionValues = [answer, ...distractors].slice(0, 4);
  const rotation = (levelNumber + index) % optionValues.length;
  const rotatedValues = optionValues.map((_, optionIndex) => optionValues[(optionIndex + rotation) % optionValues.length]);

  const options = rotatedValues
    .map((value, optionIndex) => ({
      id: String.fromCharCode(65 + optionIndex),
      text: String(value),
    }));

  return {
    id: `prompt-${levelNumber}-${index + 1}`,
    prompt: `${prompt} = ?`,
    answer: String(answer),
    options,
    hint: operationIndex <= 1 ? "Work left to right and keep the sign in mind." : "Break the numbers into easier chunks before you solve.",
    explanation: `${prompt} evaluates to ${answer}.`,
  };
}

function createMathLevel(levelNumber: number, prompt: string, difficulty: Difficulty): CustomLevelConfig {
  const theme = inferThemeLabel(prompt);
  const promptCount = clamp(4 + Math.floor(levelNumber / 2), 4, 8);
  const passingScore = difficulty === "easy" ? 65 : difficulty === "medium" ? 75 : 80;

  return {
    levelNumber,
    name: `${theme} Sprint ${levelNumber}`,
    objective: "Answer rapid-fire questions before the pace overwhelms you.",
    instruction: "Each question flashes one at a time. Lock in the answer fast, protect your streak, and clear the target score.",
    successText: "Sprint complete. The pace stayed with you.",
    renderer: {
      kind: "math",
      strategy: "extend-mcq",
      title: `${theme} Math Sprint`,
      instructions: "Fast mental-math rounds with instant progression and plausible distractors.",
      accentColor: "#f59e0b",
    },
    prompts: Array.from({ length: promptCount }, (_, index) => createMathPrompt(levelNumber, index, difficulty)),
    passingScore,
    timeLimit: clamp(45 + levelNumber * 8, 45, 120),
    bonusMultiplier: Number((1 + levelNumber * 0.12).toFixed(2)),
  };
}

function createScenarioLevel(levelNumber: number, prompt: string): CustomLevelConfig {
  const theme = inferThemeLabel(prompt);

  return {
    levelNumber,
    name: `${theme} Scenario ${levelNumber}`,
    objective: `Resolve the ${theme.toLowerCase()} challenge cleanly.`,
    instruction: "Read the situation, complete each checkpoint in order, and submit when the outcome is validated.",
    successText: "Scenario resolved.",
    renderer: {
      kind: "scenario",
      strategy: "scenario",
      title: `${theme} Scenario`,
      instructions: "A guided scenario flow that emphasizes decision quality and validation.",
      accentColor: "#0f766e",
    },
    checkpoints: [
      "Understand the objective",
      "Complete the main action",
      "Validate the final result",
    ],
    timeLimit: 75,
    bonusMultiplier: 1,
  };
}

function createMcqLevel(levelNumber: number, prompt: string, difficulty: Difficulty) {
  const theme = inferThemeLabel(prompt);

  return {
    levelNumber,
    timeLimit: clamp(70 + levelNumber * 6, 60, 140),
    bonusMultiplier: Number((1 + levelNumber * 0.1).toFixed(2)),
    shuffleQuestions: true,
    shuffleOptions: true,
    negativeMarking: difficulty === "hard",
    questions: [
      {
        id: `q-${levelNumber}-1`,
        question: `Which choice best supports the ${theme.toLowerCase()} strategy in level ${levelNumber}?`,
        options: [
          { id: "A", text: "Rush the first visible answer" },
          { id: "B", text: "Check the pattern, then choose the most balanced option" },
          { id: "C", text: "Ignore the rule and guess late" },
          { id: "D", text: "Repeat the previous answer regardless of context" },
        ],
        correctOptionId: "B",
        explanation: "The best answer matches the target pattern instead of reacting impulsively.",
        difficulty,
      },
      {
        id: `q-${levelNumber}-2`,
        question: `What improves consistency in a ${theme.toLowerCase()} quiz run?`,
        options: [
          { id: "A", text: "Skipping instructions every time" },
          { id: "B", text: "Using the target skill to verify each answer" },
          { id: "C", text: "Choosing the longest option by default" },
          { id: "D", text: "Changing the rule each question" },
        ],
        correctOptionId: "B",
        explanation: "The skill goal should actively guide the answer selection.",
        difficulty,
      },
    ],
  };
}

function createWordLevel(levelNumber: number, prompt: string, difficulty: Difficulty) {
  const theme = themeNoun(prompt, "Code").toUpperCase();
  const wordBank = [
    `${theme}`.slice(0, Math.max(3, Math.min(6, theme.length))),
    "LOGIC",
    difficulty === "easy" ? "FOCUS" : "PATTERN",
  ].filter((word, index, list) => word.length >= 3 && list.indexOf(word) === index);
  const availableLetters = Array.from(new Set(wordBank.join("").split("")));

  return {
    levelNumber,
    timeLimit: clamp(70 + levelNumber * 10, 60, 160),
    bonusMultiplier: Number((1 + levelNumber * 0.1).toFixed(2)),
    availableLetters,
    validWords: wordBank.map((word, index) => ({
      word,
      points: 80 + index * 20,
      difficulty,
    })),
    bonusWords: difficulty === "easy"
      ? [{
        word: "GO",
        points: 40,
        difficulty: "easy" as const,
      }]
      : [],
    minWordLength: 2,
    maxWordLength: Math.max(...wordBank.map((word) => word.length)),
  };
}

function createGridLevel(levelNumber: number): { levelNumber: number; timeLimit: number; bonusMultiplier: number; gridSize: number; preFilledCells: Array<{ row: number; col: number; value: number }>; solution: number[][]; hints: Array<{ row: number; col: number; value: number }> } {
  const gridSize = clamp(3 + Math.floor(levelNumber / 2), 3, 5);
  const solution = Array.from({ length: gridSize }, (_, rowIndex) =>
    Array.from({ length: gridSize }, (_, colIndex) => ((rowIndex + colIndex) % gridSize) + 1),
  );
  const allCells = solution.flatMap((row, rowIndex) => row.map((value, colIndex) => ({ row: rowIndex, col: colIndex, value })));
  const prefilledCount = clamp(gridSize + 1 - Math.floor(levelNumber / 2), 2, allCells.length - 1);

  return {
    levelNumber,
    timeLimit: clamp(90 + levelNumber * 10, 80, 180),
    bonusMultiplier: Number((1 + levelNumber * 0.1).toFixed(2)),
    gridSize,
    preFilledCells: allCells.slice(0, prefilledCount),
    solution,
    hints: allCells.slice(prefilledCount, prefilledCount + 2),
  };
}

function createDragDropLevel(levelNumber: number, prompt: string) {
  const theme = inferThemeLabel(prompt);
  const itemLabels = [`${theme} Signal`, `${theme} Tool`, `${theme} Result`];
  const targetLabels = ["Input", "Process", "Outcome"];
  const items = itemLabels.map((label, index) => ({
    id: `item-${levelNumber}-${index + 1}`,
    label,
  }));
  const targets = targetLabels.map((label, index) => ({
    id: `target-${levelNumber}-${index + 1}`,
    label,
    acceptsMultiple: false,
  }));

  return {
    levelNumber,
    timeLimit: clamp(70 + levelNumber * 8, 60, 150),
    bonusMultiplier: Number((1 + levelNumber * 0.1).toFixed(2)),
    items,
    targets,
    correctMapping: items.reduce<Record<string, string>>((mapping, item, index) => ({
      ...mapping,
      [item.id]: targets[index]?.id ?? targets[0].id,
    }), {}),
  };
}

function createBaseConfig(request: DraftGameRequest): Record<string, unknown> {
  const now = new Date().toISOString();
  const theme = inferThemeLabel(request.prompt);
  const title =
    request.gameType === "CUSTOM"
      ? `${theme} ${titleCase(request.customRendererKind ?? "experience")}`
      : `${theme} ${titleCase(request.gameType.toLowerCase())}`;
  const suggestedId = `${theme}-${request.gameType.toLowerCase()}-${request.customRendererKind ?? "builder"}`;
  const gameId = ensureUniqueGameId(suggestedId);

  return {
    schemaVersion: 2,
    gameId,
    gameType: request.gameType,
    title,
    description: `AI-authored ${request.gameType.toLowerCase()} experience inspired by: ${request.prompt}`,
    version: "1.0.0",
    difficulty: request.difficulty,
    timerConfig: {
      type: TimerType.COUNTDOWN,
      duration: 120,
      warningAt: [30, 10, 5],
    },
    scoringConfig: {
      basePoints: 100,
      bonusMultiplier: 1,
      penaltyPerHint: 5,
      penaltyPerWrong: request.gameType === "MCQ" ? 10 : 0,
      timeBonusFormula: TimeBonusFormula.LINEAR,
      timeBonusMultiplier: 1,
    },
    uiConfig: {
      theme: "system",
      primaryColor: "#0f766e",
      secondaryColor: request.gameType === "MATH" ? "#f59e0b" : "#f97316",
      iconSet: "lucide",
      layout: request.gameType === "BOARD" ? "fullscreen" : "centered",
      showTimer: true,
      showScore: true,
      showProgress: true,
      smartboard: {
        enabled: request.gameType === "BOARD" || request.gameType === "PLATFORMER",
        allowFullscreen: true,
        autoScaleBoard: true,
        emphasizeControls: request.gameType === "BOARD" || request.gameType === "PLATFORMER",
      },
    },
    metadata: {
      author: "AI Builder",
      createdAt: now,
      updatedAt: now,
      tags: [
        "ai-authored",
        request.gameType.toLowerCase(),
        request.targetSkill.toLowerCase().replace(/\s+/g, "-"),
        ...extractThemeTokens(request.prompt),
      ].slice(0, 6),
      targetSkill: request.targetSkill,
      estimatedPlayTime: 8,
    },
    apiConfig: {
      leaderboardEndpoint: `/api/leaderboard/${gameId}`,
      scoreSubmitEndpoint: "/api/score",
    },
    adaptiveConfig: {
      enabled: true,
      supportThreshold: 0.55,
      challengeThreshold: 0.9,
      timerAdjustmentSeconds: 12,
      multiplierAdjustment: 0.2,
      maxTimerAdjustmentSeconds: 30,
      minimumMultiplier: 0.75,
      maximumMultiplier: 2,
      adaptContent: true,
      adaptTimer: true,
      adaptScoring: true,
      adaptPenalties: true,
    },
    aiConfig: {
      enabled: true,
      provider: request.aiProvider ?? "local-template",
      fallbackToLocal: true,
      model:
        request.aiProvider === "google-genai"
          ? runtimeConfig.googleGenAiModel || undefined
          : runtimeConfig.aiModel || undefined,
      prompt: request.prompt,
      seed: sanitizeGameId(request.prompt).slice(0, 32),
    },
    interactionConfig: {
      inputMode: "hybrid",
      autoFocus: true,
      pointer: {
        dragEnabled: true,
        touchEnabled: true,
      },
      accessibility: {
        keyboardDragDrop: true,
        announceCommands: true,
      },
    },
  };
}

function createLevelsForGame(request: DraftGameRequest) {
  if (request.gameType === "BOARD") {
    const levels: BoardLevelConfig[] = [];
    for (let levelNumber = 1; levelNumber <= MIN_DRAFT_LEVELS; levelNumber += 1) {
      levels.push(createBoardLevel(levelNumber, request.difficulty, request.prompt, levels.at(-1)));
    }
    return levels;
  }

  if (request.gameType === "PLATFORMER") {
    const levels: CustomLevelConfig[] = [];
    for (let levelNumber = 1; levelNumber <= MIN_DRAFT_LEVELS; levelNumber += 1) {
      levels.push(createPlatformerLevel(levelNumber, request.prompt, request.difficulty, levels.at(-1)));
    }
    return levels;
  }

  if (request.gameType === "MATH") {
    return Array.from({ length: MIN_DRAFT_LEVELS }, (_, index) => createMathLevel(index + 1, request.prompt, request.difficulty));
  }

  if (request.gameType === "MCQ") {
    return Array.from({ length: MIN_DRAFT_LEVELS }, (_, index) => createMcqLevel(index + 1, request.prompt, request.difficulty));
  }

  if (request.gameType === "WORD") {
    return Array.from({ length: MIN_DRAFT_LEVELS }, (_, index) => createWordLevel(index + 1, request.prompt, request.difficulty));
  }

  if (request.gameType === "GRID") {
    return Array.from({ length: MIN_DRAFT_LEVELS }, (_, index) => createGridLevel(index + 1));
  }

  if (request.gameType === "DRAG_DROP") {
    return Array.from({ length: MIN_DRAFT_LEVELS }, (_, index) => createDragDropLevel(index + 1, request.prompt));
  }

  return [createScenarioLevel(1, request.prompt)];
}

function createLocalDraftGame(request: DraftGameRequest): AnyGameConfig {
  return parseGameConfig({
    ...createBaseConfig(request),
    levels: createLevelsForGame(request),
  });
}

function getCustomRendererKind(level: CustomLevelConfig | undefined): CustomRendererKind {
  if (level?.renderer?.kind) {
    return level.renderer.kind;
  }

  if (level?.prompts?.length) {
    return "math";
  }

  if (level?.board?.length) {
    return "platformer";
  }

  return "scenario";
}

function createLocalContinuationLevel(
  config: AnyGameConfig,
  levelNumber: number,
  prompt: string,
): AnyGameConfig["levels"][number] {
  const effectivePrompt = prompt || config.title;

  if (config.gameType === "BOARD") {
    const previousLevel = config.levels.at(-1) as BoardLevelConfig | undefined;
    return createBoardLevel(levelNumber, config.difficulty, effectivePrompt, previousLevel);
  }

  if (config.gameType === "PLATFORMER") {
    const previousLevel = config.levels.at(-1) as CustomLevelConfig | undefined;
    return createPlatformerLevel(levelNumber, effectivePrompt, config.difficulty, previousLevel);
  }

  if (config.gameType === "MATH") {
    return createMathLevel(levelNumber, effectivePrompt, config.difficulty);
  }

  if (config.gameType === "MCQ") {
    return createMcqLevel(levelNumber, effectivePrompt, config.difficulty);
  }

  if (config.gameType === "WORD") {
    return createWordLevel(levelNumber, effectivePrompt, config.difficulty);
  }

  if (config.gameType === "GRID") {
    return createGridLevel(levelNumber);
  }

  if (config.gameType === "DRAG_DROP") {
    return createDragDropLevel(levelNumber, effectivePrompt);
  }

  return createScenarioLevel(levelNumber, effectivePrompt);
}

function expandLocalLevels(request: ExpandLevelsRequest): AnyGameConfig {
  const nextConfig = clone(request.config);
  const lastLevelNumber = nextConfig.levels.at(-1)?.levelNumber ?? 0;
  const count = clamp(request.count, 1, MAX_EXPAND_LEVELS);
  const nextLevels: Array<AnyGameConfig["levels"][number]> = [];
  const workingConfig = clone(nextConfig);

  for (let index = 0; index < count; index += 1) {
    const nextLevel = createLocalContinuationLevel(workingConfig, lastLevelNumber + index + 1, request.prompt);
    nextLevels.push(nextLevel as AnyGameConfig["levels"][number]);
    workingConfig.levels = [...workingConfig.levels, nextLevel] as typeof workingConfig.levels;
  }

  nextConfig.levels = [...nextConfig.levels, ...nextLevels] as typeof nextConfig.levels;
  if (nextConfig.metadata) {
    nextConfig.metadata.updatedAt = new Date().toISOString();
    nextConfig.metadata.tags = Array.from(new Set([...(nextConfig.metadata.tags ?? []), "ai-expanded"]));
  }

  return parseGameConfig(nextConfig);
}

function summarizeLevel(level: AnyGameConfig["levels"][number]): string {
  if ("board" in level && !("objective" in level)) {
    return `BOARD L${level.levelNumber}: ${level.board.length}x${level.board[0]?.length ?? 0}, tasks ${level.tasks?.length ?? 0}, checkpoints ${level.checkpoints?.length ?? 0}, enemies ${level.enemies?.length ?? 0}`;
  }

  if ("objective" in level) {
    if (level.prompts?.length) {
      return `MATH L${level.levelNumber}: prompts ${level.prompts.length}, passing ${level.passingScore ?? 70}%`;
    }

    if (level.board?.length) {
      return `PLATFORMER L${level.levelNumber}: ${level.board.length}x${level.board[0]?.length ?? 0}, tasks ${level.boardTasks?.length ?? 0}, checkpoints ${level.boardCheckpoints?.length ?? 0}, enemies ${level.enemies?.length ?? 0}`;
    }

    return `OBJECTIVE L${level.levelNumber}`;
  }

  if ("questions" in level) {
    return `MCQ L${level.levelNumber}: questions ${level.questions.length}`;
  }

  if ("validWords" in level) {
    return `WORD L${level.levelNumber}: valid words ${level.validWords.length}`;
  }

  if ("solution" in level) {
    return `GRID L${level.levelNumber}: grid ${level.gridSize}x${level.gridSize}`;
  }

  if ("items" in level) {
    return `DRAG_DROP L${level.levelNumber}: items ${level.items.length}, targets ${level.targets.length}`;
  }

  return "Level";
}

function summarizeExistingLevels(config: AnyGameConfig): string {
  return config.levels.map((level) => summarizeLevel(level)).join("\n");
}

function getProviderModel(provider: SupportedAiProvider): string | undefined {
  return provider === "google-genai" ? runtimeConfig.googleGenAiModel : runtimeConfig.aiModel;
}

function buildDraftRequirements(request: DraftGameRequest): string {
  return [
    "Requirements:",
    "1. Return schemaVersion 2 game JSON only.",
    `2. The gameType must be exactly ${request.gameType}.`,
    request.gameType === "CUSTOM" && request.customRendererKind
      ? `3. Every level must use renderer.kind = "${request.customRendererKind}" and the structure must match that renderer.`
      : "3. Preserve the requested genre exactly.",
    `4. Every level must target the learning outcome "${request.targetSkill}".`,
    "5. No placeholder or sample text. The game should feel production-ready.",
    "6. Levels must escalate in a meaningful way instead of repeating the same structure.",
    "7. For BOARD and platformer levels: include readable routes, meaningful blockages, required checkpoints, collectibles, and enemy pressure on medium/hard.",
    "8. For math levels: produce short rapid-fire prompts with answer options and strong distractors for a fast-paced question UI.",
    "9. Keep titles, objectives, and instructions aligned with the user's exact theme request.",
  ].filter(Boolean).join("\n");
}

function buildExpansionRequirements(request: ExpandLevelsRequest): string {
  return [
    "Requirements:",
    `1. Append exactly ${clamp(request.count, 1, MAX_EXPAND_LEVELS)} new levels.`,
    "2. Do not rewrite, delete, reorder, or renumber any existing level.",
    "3. Preserve the existing game identity, gameId, title, renderer strategy, and scoring setup.",
    "4. Continue the mechanical arc from the current levels instead of starting over.",
    "5. For BOARD and platformer levels, increase board pressure with better routing, checkpoints, and enemies where appropriate.",
    "6. For math levels, increase pace, variety, and distractor quality while keeping prompts short and answerable quickly.",
  ].join("\n");
}

function promoteToSchemaVersion2(config: AnyGameConfig): AnyGameConfig {
  if ("schemaVersion" in config && config.schemaVersion === 2) {
    return config;
  }

  return parseGameConfig({
    ...clone(config),
    schemaVersion: 2,
  });
}

function draftMatchesRequest(config: AnyGameConfig, request: DraftGameRequest): boolean {
  if (config.gameType !== request.gameType) {
    return false;
  }

  return true;
}

function finalizeDraftConfig(config: AnyGameConfig, request: DraftGameRequest): AnyGameConfig {
  const nextConfig = clone(promoteToSchemaVersion2(config));
  nextConfig.gameId = ensureUniqueGameId(nextConfig.gameId);
  nextConfig.aiConfig = {
    ...(nextConfig.aiConfig ?? {}),
    enabled: true,
    provider: request.aiProvider ?? nextConfig.aiConfig?.provider ?? "local-template",
    fallbackToLocal: true,
    model: request.aiProvider === "google-genai" ? runtimeConfig.googleGenAiModel || undefined : runtimeConfig.aiModel || undefined,
    prompt: request.prompt,
  };

  nextConfig.metadata = {
    ...(nextConfig.metadata ?? {
      author: "AI Builder",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["ai-authored"],
      targetSkill: request.targetSkill,
      estimatedPlayTime: 8,
    }),
    updatedAt: new Date().toISOString(),
    targetSkill: request.targetSkill,
    tags: Array.from(new Set([...(nextConfig.metadata?.tags ?? []), request.targetSkill.toLowerCase().replace(/\s+/g, "-"), "ai-authored"])),
  };

  let parsed = parseGameConfig(nextConfig);
  if (parsed.levels.length < MIN_DRAFT_LEVELS) {
    parsed = expandLocalLevels({
      config: parsed,
      prompt: request.prompt,
      count: MIN_DRAFT_LEVELS - parsed.levels.length,
      aiProvider: "local-template",
    });
  }

  return parsed;
}

function finalizeExpansionConfig(candidate: AnyGameConfig, request: ExpandLevelsRequest): AnyGameConfig | null {
  if (candidate.gameType !== request.config.gameType) {
    return null;
  }

  const needed = clamp(request.count, 1, MAX_EXPAND_LEVELS);
  const appendedLevels = candidate.levels.slice(request.config.levels.length);
  if (appendedLevels.length < needed) {
    return null;
  }

  const nextConfig = clone(promoteToSchemaVersion2(request.config));
  const renumbered = appendedLevels.slice(0, needed).map((level, index) => ({
    ...clone(level),
    levelNumber: nextConfig.levels.length + index + 1,
  }));
  nextConfig.levels = [...nextConfig.levels, ...renumbered] as typeof nextConfig.levels;

  nextConfig.metadata = {
    ...(nextConfig.metadata ?? {
      author: "AI Builder",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ["ai-expanded"],
      targetSkill: "problem solving",
      estimatedPlayTime: 8,
    }),
    updatedAt: new Date().toISOString(),
    tags: Array.from(new Set([...(nextConfig.metadata?.tags ?? []), "ai-expanded"])),
  };

  nextConfig.aiConfig = {
    ...(nextConfig.aiConfig ?? {}),
    enabled: true,
    provider: request.aiProvider ?? nextConfig.aiConfig?.provider ?? "local-template",
    fallbackToLocal: true,
    model: request.aiProvider === "google-genai" ? runtimeConfig.googleGenAiModel || undefined : runtimeConfig.aiModel || undefined,
    prompt: request.prompt,
  };

  return parseGameConfig(nextConfig);
}

async function repairConfigFromProvider(options: {
  provider: SupportedAiProvider;
  prompt: string;
  invalidText: string;
  parseError: unknown;
}): Promise<AnyGameConfig | null> {
  const repairedText = await requestJsonFromProvider({
    provider: options.provider,
    prompt: [
      options.prompt,
      "The previous JSON did not validate. Repair it and return only the corrected full JSON config.",
      `Validation issue: ${options.parseError instanceof Error ? options.parseError.message : String(options.parseError)}`,
      `Broken response:\n${extractJsonPayload(options.invalidText) ?? options.invalidText}`,
    ].join("\n\n"),
    model: getProviderModel(options.provider),
    endpoint: runtimeConfig.aiBaseUrl,
  });

  const repairedPayload = repairedText ? extractJsonPayload(repairedText) : null;
  if (!repairedPayload) {
    return null;
  }

  return parseGameConfig(JSON.parse(repairedPayload));
}

async function tryExternalDraftGame(request: DraftGameRequest): Promise<AnyGameConfig | null> {
  if (!request.aiProvider || request.aiProvider === "local-template") {
    return null;
  }

  const provider = request.aiProvider as SupportedAiProvider;
  const localSkeleton = createLocalDraftGame(request);
  const planPrompt = [
    "Design a TaPTaP game plan and return JSON only.",
    `Creative brief: ${request.prompt}`,
    `Game type: ${request.gameType}`,
    `Difficulty: ${request.difficulty}`,
    `Target skill: ${request.targetSkill}`,
    request.customRendererKind ? `Renderer kind: ${request.customRendererKind}` : "",
    buildDraftRequirements(request),
    `Base skeleton summary:\n${summarizeExistingLevels(localSkeleton)}`,
    "Return an object with title, description, tone, mechanics, and levelPlans.",
  ].filter(Boolean).join("\n\n");

  const planText = await requestJsonFromProvider({
    provider,
    prompt: planPrompt,
    model: getProviderModel(provider),
    endpoint: runtimeConfig.aiBaseUrl,
  });

  const finalPrompt = [
    "Return a full TaPTaP game config as JSON only.",
    `User brief: ${request.prompt}`,
    buildDraftRequirements(request),
    "Use the following base config as the schema-safe starting point, then improve it to match the plan exactly.",
    `Base config:\n${JSON.stringify(localSkeleton, null, 2)}`,
    planText ? `Design plan:\n${extractJsonPayload(planText) ?? planText}` : "",
    "Keep the requested gameType and renderer exact. Do not swap the genre.",
  ].filter(Boolean).join("\n\n");

  const finalText = await requestJsonFromProvider({
    provider,
    prompt: finalPrompt,
    model: getProviderModel(provider),
    endpoint: runtimeConfig.aiBaseUrl,
  });

  const payload = finalText ? extractJsonPayload(finalText) : null;
  if (!payload) {
    return null;
  }

  try {
    const parsed = parseGameConfig(JSON.parse(payload));
    if (!draftMatchesRequest(parsed, request)) {
      return null;
    }

    return finalizeDraftConfig(parsed, request);
  } catch (error) {
    const repaired = finalText
      ? await repairConfigFromProvider({
        provider,
        prompt: finalPrompt,
        invalidText: finalText,
        parseError: error,
      })
      : null;

    if (!repaired || !draftMatchesRequest(repaired, request)) {
      return null;
    }

    return finalizeDraftConfig(repaired, request);
  }
}

async function tryExternalLevelExpansion(request: ExpandLevelsRequest): Promise<AnyGameConfig | null> {
  if (!request.aiProvider || request.aiProvider === "local-template") {
    return null;
  }

  const provider = request.aiProvider as SupportedAiProvider;
  const localProposal = expandLocalLevels({
    ...request,
    aiProvider: "local-template",
  });
  const planPrompt = [
    "Plan appended TaPTaP levels and return JSON only.",
    `Creative brief: ${request.prompt}`,
    buildExpansionRequirements(request),
    `Current levels:\n${summarizeExistingLevels(request.config)}`,
    "Return an object with newLevels where each entry explains the added mechanic, pressure, and learning-outcome focus.",
  ].join("\n\n");

  const planText = await requestJsonFromProvider({
    provider,
    prompt: planPrompt,
    model: getProviderModel(provider),
    endpoint: runtimeConfig.aiBaseUrl,
  });

  const finalPrompt = [
    "Return the full TaPTaP game config as JSON only after appending the new levels.",
    buildExpansionRequirements(request),
    `User append brief: ${request.prompt}`,
    `Current config:\n${JSON.stringify(request.config, null, 2)}`,
    `Local continuation proposal:\n${JSON.stringify(localProposal, null, 2)}`,
    planText ? `Append plan:\n${extractJsonPayload(planText) ?? planText}` : "",
    "Existing levels must stay unchanged and only new levels should be appended at the end.",
  ].join("\n\n");

  const finalText = await requestJsonFromProvider({
    provider,
    prompt: finalPrompt,
    model: getProviderModel(provider),
    endpoint: runtimeConfig.aiBaseUrl,
  });

  const payload = finalText ? extractJsonPayload(finalText) : null;
  if (!payload) {
    return null;
  }

  try {
    const parsed = parseGameConfig(JSON.parse(payload));
    return finalizeExpansionConfig(parsed, request);
  } catch (error) {
    const repaired = finalText
      ? await repairConfigFromProvider({
        provider,
        prompt: finalPrompt,
        invalidText: finalText,
        parseError: error,
      })
      : null;

    return repaired ? finalizeExpansionConfig(repaired, request) : null;
  }
}

export async function draftGameWithAi(request: DraftGameRequest): Promise<AnyGameConfig> {
  try {
    const external = await tryExternalDraftGame(request);
    if (external) {
      return external;
    }
  } catch (error) {
    if (request.aiProvider && request.aiProvider !== "local-template") {
      console.warn("[ai-authoring] external draft failed, falling back to local template", error);
    }
  }

  return createLocalDraftGame(request);
}

export async function expandLevelsWithAi(request: ExpandLevelsRequest): Promise<AnyGameConfig> {
  try {
    const external = await tryExternalLevelExpansion(request);
    if (external) {
      return external;
    }
  } catch (error) {
    if (request.aiProvider && request.aiProvider !== "local-template") {
      console.warn("[ai-authoring] external level expansion failed, falling back to local template", error);
    }
  }

  return expandLocalLevels(request);
}
