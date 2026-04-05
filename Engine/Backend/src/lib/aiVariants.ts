import {
  parseGameConfig,
  type AdaptiveBand,
  type AnyGameConfig,
  type BaseLevelConfig,
  type BoardEnemy,
  type BoardLevelConfig,
  type CustomLevelConfig,
  type DragDropLevelConfig,
  type GameConfigV1,
  type GameConfigV2,
  type GridLevelConfig,
  type LevelConfig,
  type MCQLevelConfig,
  type MCQQuestion,
  type WordLevelConfig,
} from "./gameSchema.js";
import { runtimeConfig } from "./runtimeConfig.js";
import type { GeneratedLevelPayload, GenerationSource } from "../types/api.js";

export interface VariantRequest {
  band?: AdaptiveBand;
  seed?: string;
}

export interface SessionLevelRequest extends VariantRequest {
  levelIndex: number;
  recentAccuracies?: number[];
  completedLevels?: number;
}

function cloneConfig<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hashSeed(seed: string): number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash || 1;
}

function createRandom(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function difficultyRank(value: "easy" | "medium" | "hard"): number {
  return value === "easy" ? 0 : value === "medium" ? 1 : 2;
}

function sortByBand<T extends { difficulty: "easy" | "medium" | "hard" }>(
  entries: T[],
  band: AdaptiveBand,
  random: () => number,
): T[] {
  const shuffled = shuffle(entries, random);
  return shuffled.sort((left, right) => {
    const delta = difficultyRank(left.difficulty) - difficultyRank(right.difficulty);
    return band === "challenge" ? -delta : delta;
  });
}

function getSessionBias(recentAccuracies: number[] | undefined): -1 | 0 | 1 {
  if (!recentAccuracies?.length) {
    return 0;
  }

  const average = recentAccuracies.reduce((sum, value) => sum + value, 0) / recentAccuracies.length;
  if (average >= 0.88) {
    return 1;
  }
  if (average <= 0.55) {
    return -1;
  }
  return 0;
}

function resolveBand(requestBand: AdaptiveBand | undefined): AdaptiveBand {
  return requestBand ?? "standard";
}

function withBaseLevelMeta<T extends BaseLevelConfig>(baseLevel: BaseLevelConfig, level: T): T {
  return {
    ...level,
    levelNumber: baseLevel.levelNumber,
    timeLimit: baseLevel.timeLimit ?? level.timeLimit,
    bonusMultiplier: baseLevel.bonusMultiplier ?? level.bonusMultiplier,
  };
}

function getTargetLevel<TLevel extends LevelConfig>(levels: TLevel[], levelIndex: number): TLevel {
  const level = levels[levelIndex];
  if (!level) {
    throw new Error(`Level index ${levelIndex} is out of range.`);
  }
  return level;
}

function pickCount(baseCount: number, poolSize: number, band: AdaptiveBand, bias: -1 | 0 | 1, minimum = 1): number {
  const bandAdjustment = band === "support" ? -1 : band === "challenge" ? 1 : 0;
  return Math.max(minimum, Math.min(poolSize, baseCount + bandAdjustment + bias));
}

function getBoardTasks(level: BoardLevelConfig): BoardLevelConfig["tasks"] {
  if (level.tasks?.length) {
    return level.tasks;
  }

  const tasks: NonNullable<BoardLevelConfig["tasks"]> = [];
  level.board.forEach((row, rowIndex) => {
    row.split("").forEach((tile, colIndex) => {
      if (tile === "T") {
        tasks.push({
          id: `task-${rowIndex}-${colIndex}`,
          row: rowIndex,
          col: colIndex,
          label: `Task ${tasks.length + 1}`,
        });
      }
    });
  });
  return tasks;
}

function getEmptyBoardCells(level: BoardLevelConfig): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  const occupiedTasks = new Set((getBoardTasks(level) ?? []).map((task) => `${task.row}:${task.col}`));
  level.board.forEach((row, rowIndex) => {
    row.split("").forEach((tile, colIndex) => {
      if (tile === "." && !occupiedTasks.has(`${rowIndex}:${colIndex}`)) {
        cells.push({ row: rowIndex, col: colIndex });
      }
    });
  });
  return cells;
}

function findHorizontalEnemyLane(level: BoardLevelConfig): BoardEnemy | null {
  for (let rowIndex = 0; rowIndex < level.board.length; rowIndex += 1) {
    let segmentStart = -1;
    for (let colIndex = 0; colIndex <= level.board[rowIndex].length; colIndex += 1) {
      const tile = level.board[rowIndex][colIndex];
      const isWalkable = tile && tile !== "#" && tile !== "S" && tile !== "G";
      if (isWalkable && segmentStart === -1) {
        segmentStart = colIndex;
      }
      if ((!isWalkable || colIndex === level.board[rowIndex].length) && segmentStart !== -1) {
        const end = colIndex - 1;
        if (end - segmentStart >= 2) {
          return {
            id: `enemy-${rowIndex + 1}-${segmentStart + 1}`,
            row: rowIndex,
            col: segmentStart,
            movement: "horizontal",
            min: segmentStart,
            max: end,
            speed: 2,
            direction: "forward",
          };
        }
        segmentStart = -1;
      }
    }
  }

  return null;
}

function findVerticalEnemyLane(level: BoardLevelConfig): BoardEnemy | null {
  const width = level.board[0]?.length ?? 0;
  for (let colIndex = 0; colIndex < width; colIndex += 1) {
    let segmentStart = -1;
    for (let rowIndex = 0; rowIndex <= level.board.length; rowIndex += 1) {
      const tile = level.board[rowIndex]?.[colIndex];
      const isWalkable = tile && tile !== "#" && tile !== "S" && tile !== "G";
      if (isWalkable && segmentStart === -1) {
        segmentStart = rowIndex;
      }
      if ((!isWalkable || rowIndex === level.board.length) && segmentStart !== -1) {
        const end = rowIndex - 1;
        if (end - segmentStart >= 2) {
          return {
            id: `enemy-${segmentStart + 1}-${colIndex + 1}`,
            row: segmentStart,
            col: colIndex,
            movement: "vertical",
            min: segmentStart,
            max: end,
            speed: 2,
            direction: "forward",
          };
        }
        segmentStart = -1;
      }
    }
  }

  return null;
}

function buildLetterRack(words: string[], random: () => number): string[] {
  const letterCounts = new Map<string, number>();

  words.forEach((word) => {
    const counts = new Map<string, number>();
    word.split("").forEach((letter) => counts.set(letter, (counts.get(letter) ?? 0) + 1));
    counts.forEach((count, letter) => {
      letterCounts.set(letter, Math.max(letterCounts.get(letter) ?? 0, count));
    });
  });

  const rack: string[] = [];
  letterCounts.forEach((count, letter) => {
    for (let index = 0; index < count; index += 1) {
      rack.push(letter);
    }
  });

  return shuffle(rack, random);
}

function summarizeStrategy(gameType: AnyGameConfig["gameType"]): string {
  if (gameType === "MCQ") {
    return "rebalanced question mix";
  }
  if (gameType === "WORD") {
    return "remixed word bank";
  }
  if (gameType === "GRID") {
    return "reseeded clue layout";
  }
  if (gameType === "DRAG_DROP") {
    return "remapped sorting puzzle";
  }
  if (gameType === "BOARD") {
    return "fresh task and patrol pattern";
  }
  return "custom objective remix";
}

function summarizeGeneration(gameType: AnyGameConfig["gameType"], band: AdaptiveBand): string {
  const bandLabel = band === "support" ? "support" : band === "challenge" ? "challenge" : "balanced";
  return `Generated a ${bandLabel} ${summarizeStrategy(gameType)} from session performance cues.`;
}

function generateGridLevel(
  config: Extract<AnyGameConfig, { gameType: "GRID" }>,
  request: SessionLevelRequest,
  random: () => number,
): GridLevelConfig {
  const baseLevel = getTargetLevel(config.levels, request.levelIndex);
  const template = cloneConfig(shuffle(config.levels, random)[0] ?? baseLevel);
  const band = resolveBand(request.band);
  const bias = getSessionBias(request.recentAccuracies);
  const solutionCells = template.solution.flatMap((row, rowIndex) =>
    row.map((value, colIndex) => ({ row: rowIndex, col: colIndex, value })),
  );
  const randomizedCells = shuffle(solutionCells, random);
  const currentCount = template.preFilledCells.length;
  const nextCount = pickCount(currentCount, solutionCells.length - 1, band, bias, 1);
  const hintsCount = band === "support" ? 3 : band === "challenge" ? 1 : 2;

  return withBaseLevelMeta(baseLevel, {
    ...template,
    preFilledCells: randomizedCells.slice(0, nextCount),
    hints: randomizedCells.slice(nextCount, nextCount + hintsCount),
  });
}

function generateMCQLevel(
  config: Extract<AnyGameConfig, { gameType: "MCQ" }>,
  request: SessionLevelRequest,
  random: () => number,
): MCQLevelConfig {
  const baseLevel = getTargetLevel(config.levels, request.levelIndex);
  const template = cloneConfig(shuffle(config.levels, random)[0] ?? baseLevel);
  const band = resolveBand(request.band);
  const bias = getSessionBias(request.recentAccuracies);
  const pool = sortByBand(
    uniqueBy(
      config.levels.flatMap((level) => level.questions),
      (question) => question.id,
    ),
    band,
    random,
  );
  const questionCount = pickCount(template.questions.length, pool.length, band, bias, 2);
  const questions = pool.slice(0, questionCount).map<MCQQuestion>((question) => ({
    ...question,
    options: shuffle(question.options, random),
  }));

  return withBaseLevelMeta(baseLevel, {
    ...template,
    questions,
    shuffleQuestions: true,
    shuffleOptions: true,
    negativeMarking: band === "support" ? false : template.negativeMarking,
  });
}

function generateWordLevel(
  config: Extract<AnyGameConfig, { gameType: "WORD" }>,
  request: SessionLevelRequest,
  random: () => number,
): WordLevelConfig {
  const baseLevel = getTargetLevel(config.levels, request.levelIndex);
  const template = cloneConfig(shuffle(config.levels, random)[0] ?? baseLevel);
  const band = resolveBand(request.band);
  const bias = getSessionBias(request.recentAccuracies);
  const pool = sortByBand(
    uniqueBy(
      config.levels.flatMap((level) => [...level.validWords, ...(level.bonusWords ?? [])]),
      (entry) => entry.word,
    ),
    band,
    random,
  );
  const validCount = pickCount(template.validWords.length, pool.length, band, bias, 1);
  const validWords = pool.slice(0, validCount);
  const bonusWords = band === "challenge"
    ? []
    : pool.slice(validCount, validCount + (band === "support" ? 2 : 1));
  const rackSource = [...validWords, ...bonusWords].map((entry) => entry.word);
  const lengths = validWords.map((entry) => entry.word.length);

  return withBaseLevelMeta(baseLevel, {
    ...template,
    availableLetters: buildLetterRack(rackSource, random),
    validWords,
    bonusWords: bonusWords.length ? bonusWords : undefined,
    minWordLength: Math.max(2, Math.min(...lengths)),
    maxWordLength: Math.max(...lengths),
  });
}

function generateDragDropLevel(
  config: Extract<AnyGameConfig, { gameType: "DRAG_DROP" }>,
  request: SessionLevelRequest,
  random: () => number,
): DragDropLevelConfig {
  const baseLevel = getTargetLevel(config.levels, request.levelIndex);
  const template = cloneConfig(shuffle(config.levels, random)[0] ?? baseLevel);
  const band = resolveBand(request.band);
  const bias = getSessionBias(request.recentAccuracies);
  const items = uniqueBy(
    config.levels.flatMap((level) => level.items),
    (item) => item.id,
  );
  const targets = new Map(
    uniqueBy(
      config.levels.flatMap((level) => level.targets),
      (target) => target.id,
    ).map((target) => [target.id, target]),
  );
  const mappings = config.levels.reduce<Record<string, string>>((accumulator, level) => ({
    ...accumulator,
    ...level.correctMapping,
  }), {});
  const usableItems = shuffle(
    items.filter((item) => Boolean(mappings[item.id]) && targets.has(mappings[item.id])),
    random,
  );
  const itemCount = pickCount(template.items.length, usableItems.length, band, bias, 2);
  const nextItems = usableItems.slice(0, itemCount);
  const requiredTargets = Array.from(new Set(nextItems.map((item) => mappings[item.id])))
    .map((targetId) => targets.get(targetId))
    .filter((target): target is NonNullable<typeof target> => Boolean(target));

  const nextTargets = band === "challenge"
    ? [
      ...requiredTargets,
      {
        id: `decoy-${baseLevel.levelNumber}`,
        label: `${requiredTargets[0]?.label ?? "Extra"} decoy`,
        acceptsMultiple: false,
      },
    ]
    : requiredTargets;

  return withBaseLevelMeta(baseLevel, {
    ...template,
    items: nextItems,
    targets: nextTargets,
    correctMapping: nextItems.reduce<Record<string, string>>((mapping, item) => {
      mapping[item.id] = mappings[item.id];
      return mapping;
    }, {}),
  });
}

function generateBoardLevel(
  config: Extract<AnyGameConfig, { gameType: "BOARD" }>,
  request: SessionLevelRequest,
  random: () => number,
): BoardLevelConfig {
  const baseLevel = getTargetLevel(config.levels, request.levelIndex);
  const template = cloneConfig(shuffle(config.levels, random)[0] ?? baseLevel);
  const band = resolveBand(request.band);
  const tasks = shuffle([...(getBoardTasks(template) ?? [])], random);
  const emptyCells = shuffle(getEmptyBoardCells(template), random);
  const nextTasks = band === "support" && tasks.length > 1
    ? tasks.slice(0, tasks.length - 1)
    : [...tasks];

  if (band === "challenge" && emptyCells[0]) {
    nextTasks.push({
      id: `generated-task-${baseLevel.levelNumber}-${nextTasks.length + 1}`,
      row: emptyCells[0].row,
      col: emptyCells[0].col,
      label: `Generated Task ${nextTasks.length + 1}`,
    });
  }

  const nextEnemies = [...(template.enemies ?? [])];
  if (band === "support" && nextEnemies.length > 1) {
    nextEnemies.pop();
  }

  if (band === "challenge" && nextEnemies.length === 0) {
    const generatedEnemy = findHorizontalEnemyLane(template) ?? findVerticalEnemyLane(template);
    if (generatedEnemy) {
      nextEnemies.push(generatedEnemy);
    }
  }

  return withBaseLevelMeta(baseLevel, {
    ...template,
    tasks: nextTasks,
    enemies: nextEnemies,
    enemyCollisionPenalty:
      band === "support"
        ? Math.max(0, (template.enemyCollisionPenalty ?? 0) - 10)
        : band === "challenge"
          ? (template.enemyCollisionPenalty ?? 0) + 10
          : template.enemyCollisionPenalty,
  });
}

function generateCustomLevel(
  config: Extract<AnyGameConfig, { gameType: "CUSTOM" }>,
  request: SessionLevelRequest,
  random: () => number,
): CustomLevelConfig {
  const baseLevel = getTargetLevel(config.levels, request.levelIndex);
  const template = cloneConfig(shuffle(config.levels, random)[0] ?? baseLevel);
  const band = resolveBand(request.band);
  const bias = getSessionBias(request.recentAccuracies);
  const checkpointPool = uniqueBy(
    config.levels.flatMap((level) => level.checkpoints ?? [level.objective]),
    (entry) => entry,
  );
  const checkpointCount = pickCount(
    (template.checkpoints ?? [template.objective]).length,
    checkpointPool.length,
    band,
    bias,
    1,
  );
  const checkpoints = shuffle(checkpointPool, random).slice(0, checkpointCount);

  return withBaseLevelMeta(baseLevel, {
    ...template,
    objective:
      band === "challenge"
        ? `${template.objective} Finish it under challenge pressure.`
        : template.objective,
    instruction:
      band === "support"
        ? `${template.instruction} Break the task into smaller wins.`
        : band === "challenge"
          ? `${template.instruction} Complete it cleanly and quickly.`
          : template.instruction,
    successText:
      band === "support"
        ? `${template.successText} You stabilized the fundamentals.`
        : band === "challenge"
          ? `${template.successText} Challenge pacing unlocked.`
          : template.successText,
    checkpoints,
  });
}

function generateLocalLevel(config: AnyGameConfig, request: SessionLevelRequest): LevelConfig {
  const seed = request.seed ?? `${config.gameId}:${request.levelIndex}:${resolveBand(request.band)}`;
  const random = createRandom(seed);

  if (config.gameType === "GRID") {
    return generateGridLevel(config, request, random);
  }
  if (config.gameType === "MCQ") {
    return generateMCQLevel(config, request, random);
  }
  if (config.gameType === "WORD") {
    return generateWordLevel(config, request, random);
  }
  if (config.gameType === "DRAG_DROP") {
    return generateDragDropLevel(config, request, random);
  }
  if (config.gameType === "BOARD") {
    return generateBoardLevel(config, request, random);
  }
  return generateCustomLevel(config, request, random);
}

function extractJsonPayload(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const fenced = trimmed.match(/```json\s*([\s\S]+?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  return firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : null;
}

async function requestOpenAiCompatibleJson(config: AnyGameConfig, prompt: string, systemContent: string): Promise<string | null> {
  const endpoint = config.aiConfig?.endpoint || runtimeConfig.aiBaseUrl;
  const apiKey = runtimeConfig.aiApiKey;
  const model = config.aiConfig?.model || runtimeConfig.aiModel;

  if (!endpoint || !apiKey || !model) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: systemContent,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI variant request failed (${response.status}).`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  return content ? extractJsonPayload(content) : null;
}

async function attemptOpenAiCompatibleVariant(
  config: AnyGameConfig,
  request: VariantRequest,
): Promise<AnyGameConfig | null> {
  const prompt = [
    "Generate a valid TaPTaP game config variant as JSON only.",
    `Target band: ${resolveBand(request.band)}.`,
    config.aiConfig?.prompt ?? "Keep the structure compatible with the original config and preserve game identity.",
    `Original config:\n${JSON.stringify(config, null, 2)}`,
  ].join("\n\n");

  const jsonPayload = await requestOpenAiCompatibleJson(
    config,
    prompt,
    "Return only valid JSON for a TaPTaP game config variant.",
  );

  return jsonPayload ? parseGameConfig(JSON.parse(jsonPayload)) : null;
}

async function attemptOpenAiCompatibleLevel(
  config: AnyGameConfig,
  request: SessionLevelRequest,
): Promise<GeneratedLevelPayload | null> {
  const baseLevel = config.levels[request.levelIndex];
  if (!baseLevel) {
    throw new Error(`Level index ${request.levelIndex} is out of range.`);
  }
  const seed = request.seed ?? `${config.gameId}:${request.levelIndex}:${Date.now()}`;
  const prompt = [
    "Generate one valid TaPTaP level as JSON only.",
    `Game type: ${config.gameType}.`,
    `Target band: ${resolveBand(request.band)}.`,
    `Target level number: ${baseLevel.levelNumber}.`,
    `Recent accuracies: ${(request.recentAccuracies ?? []).join(", ") || "none"}.`,
    config.aiConfig?.prompt ?? "Preserve the game's learning objective while refreshing the level content.",
    `Original config:\n${JSON.stringify(config, null, 2)}`,
  ].join("\n\n");

  const jsonPayload = await requestOpenAiCompatibleJson(
    config,
    prompt,
    "Return only valid JSON for one TaPTaP level. Do not wrap it in prose.",
  );

  if (!jsonPayload) {
    return null;
  }

  const nextConfig = cloneConfig(config) as GameConfigV1 | GameConfigV2;
  nextConfig.levels = nextConfig.levels.map((level, levelIndex) =>
    levelIndex === request.levelIndex ? JSON.parse(jsonPayload) : level,
  ) as typeof nextConfig.levels;
  const parsed = parseGameConfig(nextConfig);

  return {
    levelIndex: request.levelIndex,
    level: parsed.levels[request.levelIndex],
    band: resolveBand(request.band),
    source: "openai-compatible",
    summary: summarizeGeneration(config.gameType, resolveBand(request.band)),
    generatedAt: new Date().toISOString(),
    seed,
    strategy: summarizeStrategy(config.gameType),
  };
}

function applyLocalVariant(config: AnyGameConfig, request: VariantRequest): AnyGameConfig {
  const seed = request.seed ?? `${config.gameId}-${Date.now()}`;
  const nextConfig = cloneConfig(config) as GameConfigV1 | GameConfigV2;
  const band = resolveBand(request.band);

  nextConfig.metadata = nextConfig.metadata
    ? {
      ...nextConfig.metadata,
      updatedAt: new Date().toISOString(),
      tags: Array.from(new Set([...(nextConfig.metadata.tags ?? []), "ai-variant", `band-${band}`])),
    }
    : nextConfig.metadata;

  nextConfig.levels = nextConfig.levels.map((_, levelIndex) =>
    generateLocalLevel(nextConfig, {
      band,
      seed: `${seed}:${levelIndex}`,
      levelIndex,
    }),
  ) as typeof nextConfig.levels;

  return parseGameConfig(nextConfig);
}

export async function generateVariantForConfig(
  config: AnyGameConfig,
  request: VariantRequest = {},
): Promise<AnyGameConfig> {
  const aiEnabled = config.aiConfig?.enabled;
  const prefersExternal = aiEnabled && config.aiConfig?.provider === "openai-compatible";

  if (prefersExternal) {
    try {
      const generated = await attemptOpenAiCompatibleVariant(config, request);
      if (generated) {
        return generated;
      }
    } catch (error) {
      if (!config.aiConfig?.fallbackToLocal) {
        throw error;
      }
    }
  }

  return applyLocalVariant(config, request);
}

export async function generateLevelForConfig(
  config: AnyGameConfig,
  request: SessionLevelRequest,
): Promise<GeneratedLevelPayload> {
  const aiEnabled = config.aiConfig?.enabled;
  const prefersExternal = aiEnabled && config.aiConfig?.provider === "openai-compatible";
  const seed = request.seed ?? `${config.gameId}:${request.levelIndex}:${Date.now()}`;
  const band = resolveBand(request.band);

  if (prefersExternal) {
    try {
      const generated = await attemptOpenAiCompatibleLevel(config, {
        ...request,
        seed,
      });
      if (generated) {
        return generated;
      }
    } catch (error) {
      if (!config.aiConfig?.fallbackToLocal) {
        throw error;
      }
    }
  }

  const localLevel = generateLocalLevel(config, {
    ...request,
    seed,
  });
  const nextConfig = cloneConfig(config) as GameConfigV1 | GameConfigV2;
  nextConfig.levels = nextConfig.levels.map((level, levelIndex) =>
    levelIndex === request.levelIndex ? localLevel : level,
  ) as typeof nextConfig.levels;
  const parsed = parseGameConfig(nextConfig);

  return {
    levelIndex: request.levelIndex,
    level: parsed.levels[request.levelIndex],
    band,
    source: "local-template" satisfies GenerationSource,
    summary: summarizeGeneration(config.gameType, band),
    generatedAt: new Date().toISOString(),
    seed,
    strategy: summarizeStrategy(config.gameType),
  };
}
