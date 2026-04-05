import {
  parseGameConfig,
  type AdaptiveBand,
  type AnyGameConfig,
  type BoardEnemy,
  type BoardLevelConfig,
  type GameConfigV1,
  type GameConfigV2,
} from "./gameSchema.js";
import { runtimeConfig } from "./runtimeConfig.js";

export interface VariantRequest {
  band?: AdaptiveBand;
  seed?: string;
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

function getEmptyBoardCells(level: BoardLevelConfig): Array<{ row: number; col: number }> {
  const cells: Array<{ row: number; col: number }> = [];
  const occupiedTasks = new Set((level.tasks ?? []).map((task) => `${task.row}:${task.col}`));
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

function applyLocalVariant(config: AnyGameConfig, request: VariantRequest): AnyGameConfig {
  const seed = request.seed ?? `${config.gameId}-${Date.now()}`;
  const random = createRandom(seed);
  const band = request.band ?? "standard";
  const nextConfig = cloneConfig(config) as GameConfigV1 | GameConfigV2;

  nextConfig.metadata = nextConfig.metadata
    ? {
      ...nextConfig.metadata,
      updatedAt: new Date().toISOString(),
      tags: Array.from(new Set([...(nextConfig.metadata.tags ?? []), "ai-variant", `band-${band}`])),
    }
    : nextConfig.metadata;

  if (nextConfig.gameType === "MCQ") {
    nextConfig.levels = nextConfig.levels.map((level) => ({
      ...level,
      questions: sortByBand(level.questions, band, random).map((question) => ({
        ...question,
        options: shuffle(question.options, random),
      })),
      shuffleQuestions: true,
      shuffleOptions: true,
    }));
  }

  if (nextConfig.gameType === "WORD") {
    nextConfig.levels = nextConfig.levels.map((level) => ({
      ...level,
      validWords: sortByBand(level.validWords, band, random),
      bonusWords: band === "challenge" ? [] : level.bonusWords,
      availableLetters: shuffle(level.availableLetters, random),
    }));
  }

  if (nextConfig.gameType === "GRID") {
    nextConfig.levels = nextConfig.levels.map((level) => {
      const solutionCells = level.solution.flatMap((row, rowIndex) =>
        row.map((value, colIndex) => ({ row: rowIndex, col: colIndex, value })),
      );
      const randomizedCells = shuffle(solutionCells, random);
      const currentCount = level.preFilledCells.length;
      const nextCount = band === "support"
        ? Math.min(solutionCells.length - 1, currentCount + 2)
        : band === "challenge"
          ? Math.max(1, currentCount - 1)
          : currentCount;

      return {
        ...level,
        preFilledCells: randomizedCells.slice(0, nextCount),
        hints: randomizedCells.slice(nextCount, nextCount + 2),
      };
    });
  }

  if (nextConfig.gameType === "DRAG_DROP") {
    nextConfig.levels = nextConfig.levels.map((level) => ({
      ...level,
      items: shuffle(level.items, random),
      targets: [
        ...shuffle(level.targets, random),
        ...(band === "challenge"
          ? [{
            id: `decoy-${level.levelNumber}`,
            label: `${level.targets[0]?.label ?? "Extra"} decoy`,
            acceptsMultiple: false,
          }]
          : []),
      ],
    }));
  }

  if (nextConfig.gameType === "BOARD") {
    nextConfig.levels = nextConfig.levels.map((level) => {
      const nextLevel = cloneConfig(level);
      const emptyCells = shuffle(getEmptyBoardCells(nextLevel), random);
      const tasks = [...(nextLevel.tasks ?? [])];

      if (band === "challenge" && emptyCells[0]) {
        tasks.push({
          id: `generated-task-${tasks.length + 1}`,
          row: emptyCells[0].row,
          col: emptyCells[0].col,
          label: `Generated Task ${tasks.length + 1}`,
        });
      }

      if (band === "support" && tasks.length > 1) {
        tasks.pop();
      }

      const nextEnemies = [...(nextLevel.enemies ?? [])];
      if (band === "challenge") {
        const generatedEnemy = nextEnemies.length === 0 ? findHorizontalEnemyLane(nextLevel) : null;
        if (generatedEnemy) {
          nextEnemies.push(generatedEnemy);
        }
      }

      return {
        ...nextLevel,
        tasks,
        enemies: band === "support" && nextEnemies.length > 1 ? nextEnemies.slice(0, nextEnemies.length - 1) : nextEnemies,
      };
    });
  }

  if (nextConfig.gameType === "CUSTOM") {
    nextConfig.levels = nextConfig.levels.map((level) => ({
      ...level,
      instruction:
        band === "support"
          ? `${level.instruction} Break the task into smaller wins.`
          : band === "challenge"
            ? `${level.instruction} Complete it under challenge conditions.`
            : level.instruction,
      checkpoints:
        band === "challenge"
          ? [...(level.checkpoints ?? [level.objective]), "Perform a final self-check"]
          : level.checkpoints ?? [level.objective],
    }));
  }

  return parseGameConfig(nextConfig);
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

async function attemptOpenAiCompatibleVariant(
  config: AnyGameConfig,
  request: VariantRequest,
): Promise<AnyGameConfig | null> {
  const endpoint = config.aiConfig?.endpoint || runtimeConfig.aiBaseUrl;
  const apiKey = runtimeConfig.aiApiKey;
  const model = config.aiConfig?.model || runtimeConfig.aiModel;

  if (!endpoint || !apiKey || !model) {
    return null;
  }

  const prompt = [
    "Generate a valid TaPTaP game config variant as JSON only.",
    `Target band: ${request.band ?? "standard"}.`,
    config.aiConfig?.prompt ?? "Keep the structure compatible with the original config and preserve game identity.",
    `Original config:\n${JSON.stringify(config, null, 2)}`,
  ].join("\n\n");

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
          content: "Return only valid JSON for a TaPTaP game config variant.",
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
  const jsonPayload = content ? extractJsonPayload(content) : null;
  if (!jsonPayload) {
    throw new Error("AI variant response did not contain JSON.");
  }

  return parseGameConfig(JSON.parse(jsonPayload));
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
