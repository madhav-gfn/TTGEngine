# DELIVERABLE 2: JSON CONFIGURATION SCHEMA

## TaPTaP Game Engine - Configuration Schema Specification

**Version:** 1.0.0  
**Date:** March 7, 2026  
**Status:** Blueprint - Checkpoint 1

---

## Index

| # | Section | Description |
|---|---------|-------------|
| A | [Master Game Schema](#a-master-game-schema---typescript-type-definitions) | Full TypeScript type definitions for GameConfig, enums, level configs, timer, scoring, UI, and metadata interfaces |
| B | [Sample JSON - Sudoku Game](#b-sample-json---sudoku-game) | Complete multi-level (4x4, 6x6, 9x9) Sudoku config with solutions, hints, scoring, and UI settings |
| C | [Sample JSON - Word Builder Game](#c-sample-json---word-builder-game) | 3-level vocabulary game config with word banks, bonus words, and difficulty progression |
| D | [Sample JSON - Aptitude Blitz Game](#d-sample-json---aptitude-blitz-game-bonus) | Timed MCQ aptitude game with shuffle, negative marking, and question explanations |
| E | [Zod Validation Schema](#e-zod-validation-schema) | Production Zod schema with enum validation, range checks, custom error messages, cross-field validation, and validateGameConfig() utility |
| F | [Config Extension Guide](#f-config-extension-guide---adding-logic-grid-to-the-engine) | Step-by-step walkthrough for adding a new game type ("Logic Grid") with zero engine changes |

---

## A. Master Game Schema - TypeScript Type Definitions

```typescript
// ============================================================
// ENUMS
// ============================================================

enum GameType {
  GRID = "GRID",
  WORD = "WORD",
  MCQ = "MCQ",
  DRAG_DROP = "DRAG_DROP",
  CUSTOM = "CUSTOM",
}

enum Difficulty {
  EASY = "easy",
  MEDIUM = "medium",
  HARD = "hard",
}

enum TimerType {
  COUNTDOWN = "countdown",
  COUNTUP = "countup",
}

enum TimeBonusFormula {
  LINEAR = "linear",           // bonus = remainingSeconds × multiplier
  EXPONENTIAL = "exponential", // bonus = multiplier ^ (remainingSeconds / duration)
  NONE = "none",               // no time bonus
}

// ============================================================
// CONFIGURATION INTERFACES
// ============================================================

interface TimerConfig {
  type: TimerType;
  duration: number;           // seconds (for countdown)
  warningAt: number[];        // seconds remaining to trigger warnings, e.g. [30, 10, 5]
}

interface ScoringConfig {
  basePoints: number;         // points per correct action
  bonusMultiplier: number;    // streak/combo multiplier
  penaltyPerHint: number;     // points deducted per hint used
  penaltyPerWrong: number;    // points deducted per wrong answer (MCQ negative marking)
  timeBonusFormula: TimeBonusFormula;
  timeBonusMultiplier: number; // used in time bonus calculation
}

interface UIConfig {
  theme: "light" | "dark" | "system";
  primaryColor: string;       // hex color, e.g. "#6366F1"
  secondaryColor: string;
  iconSet: string;            // icon pack identifier
  layout: "centered" | "fullscreen" | "sidebar";
  showTimer: boolean;
  showScore: boolean;
  showProgress: boolean;
}

interface Metadata {
  author: string;
  createdAt: string;          // ISO 8601
  updatedAt: string;
  tags: string[];             // e.g. ["logic", "reasoning", "pattern"]
  targetSkill: string;        // primary skill this game develops
  estimatedPlayTime: number;  // minutes
}

interface APIConfig {
  leaderboardEndpoint: string;  // GET endpoint
  scoreSubmitEndpoint: string;  // POST endpoint
}

// ============================================================
// LEVEL CONFIGURATIONS (per game type)
// ============================================================

interface BaseLevelConfig {
  levelNumber: number;
  timeLimit?: number;         // override timer duration for this level (seconds)
  bonusMultiplier?: number;   // override scoring multiplier for this level
}

interface GridLevelConfig extends BaseLevelConfig {
  gridSize: number;           // NxN (e.g. 4, 6, 9)
  preFilledCells: GridCell[];
  solution: number[][];       // complete solution grid
  hints?: GridCell[];         // cells revealed on hint request
}

interface GridCell {
  row: number;
  col: number;
  value: number;
}

interface WordLevelConfig extends BaseLevelConfig {
  availableLetters: string[];
  validWords: WordEntry[];
  bonusWords?: WordEntry[];   // extra credit words
  minWordLength: number;
  maxWordLength: number;
}

interface WordEntry {
  word: string;
  points: number;
  difficulty: Difficulty;
}

interface MCQLevelConfig extends BaseLevelConfig {
  questions: MCQQuestion[];
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  negativeMarking: boolean;
}

interface MCQQuestion {
  id: string;
  question: string;
  options: MCQOption[];
  correctOptionId: string;
  explanation?: string;
  category?: string;
  difficulty: Difficulty;
}

interface MCQOption {
  id: string;
  text: string;
}

interface DragDropLevelConfig extends BaseLevelConfig {
  items: DragItem[];
  targets: DropTarget[];
  correctMapping: Record<string, string>; // itemId → targetId
}

interface DragItem {
  id: string;
  label: string;
  category?: string;
}

interface DropTarget {
  id: string;
  label: string;
  acceptsMultiple: boolean;
}

// ============================================================
// MASTER GAME CONFIG
// ============================================================

type LevelConfig = GridLevelConfig | WordLevelConfig | MCQLevelConfig | DragDropLevelConfig;

interface GameConfig {
  gameId: string;
  gameType: GameType;
  title: string;
  description: string;
  version: string;            // semver
  difficulty: Difficulty;
  levels: LevelConfig[];
  timerConfig: TimerConfig;
  scoringConfig: ScoringConfig;
  uiConfig?: UIConfig;
  metadata?: Metadata;
  apiConfig?: APIConfig;
}
```

---

## B. Sample JSON - Sudoku Game

```json
{
  "gameId": "sudoku-classic-v1",
  "gameType": "GRID",
  "title": "Sudoku Classic",
  "description": "Fill the grid so every row, column, and box contains all digits. Train your logical reasoning skills.",
  "version": "1.0.0",
  "difficulty": "medium",
  "levels": [
    {
      "levelNumber": 1,
      "gridSize": 4,
      "timeLimit": 120,
      "bonusMultiplier": 1.0,
      "preFilledCells": [
        { "row": 0, "col": 0, "value": 1 },
        { "row": 0, "col": 2, "value": 3 },
        { "row": 1, "col": 1, "value": 4 },
        { "row": 1, "col": 3, "value": 1 },
        { "row": 2, "col": 0, "value": 4 },
        { "row": 2, "col": 2, "value": 1 },
        { "row": 3, "col": 1, "value": 3 },
        { "row": 3, "col": 3, "value": 2 }
      ],
      "solution": [
        [1, 2, 3, 4],
        [3, 4, 2, 1],
        [4, 3, 1, 2],
        [2, 1, 4, 3]
      ],
      "hints": [
        { "row": 0, "col": 1, "value": 2 },
        { "row": 1, "col": 0, "value": 3 }
      ]
    },
    {
      "levelNumber": 2,
      "gridSize": 6,
      "timeLimit": 240,
      "bonusMultiplier": 1.5,
      "preFilledCells": [
        { "row": 0, "col": 0, "value": 1 }, { "row": 0, "col": 3, "value": 4 },
        { "row": 1, "col": 1, "value": 5 }, { "row": 1, "col": 4, "value": 2 },
        { "row": 2, "col": 2, "value": 3 }, { "row": 2, "col": 5, "value": 6 },
        { "row": 3, "col": 0, "value": 6 }, { "row": 3, "col": 3, "value": 5 },
        { "row": 4, "col": 1, "value": 2 }, { "row": 4, "col": 4, "value": 1 },
        { "row": 5, "col": 2, "value": 4 }, { "row": 5, "col": 5, "value": 3 }
      ],
      "solution": [
        [1, 3, 6, 4, 5, 2],
        [4, 5, 2, 6, 3, 1],
        [5, 4, 3, 1, 2, 6],
        [6, 1, 5, 2, 4, 3],
        [3, 2, 4, 5, 1, 6],  
        [2, 6, 1, 3, 6, 5]
      ],
      "hints": [
        { "row": 0, "col": 1, "value": 3 }
      ]
    },
    {
      "levelNumber": 3,
      "gridSize": 9,
      "timeLimit": 600,
      "bonusMultiplier": 2.0,
      "preFilledCells": [
        { "row": 0, "col": 0, "value": 5 }, { "row": 0, "col": 1, "value": 3 },
        { "row": 0, "col": 4, "value": 7 }, { "row": 1, "col": 0, "value": 6 },
        { "row": 1, "col": 3, "value": 1 }, { "row": 1, "col": 4, "value": 9 },
        { "row": 1, "col": 5, "value": 5 }, { "row": 2, "col": 1, "value": 9 },
        { "row": 2, "col": 2, "value": 8 }, { "row": 2, "col": 7, "value": 6 },
        { "row": 3, "col": 0, "value": 8 }, { "row": 3, "col": 4, "value": 6 },
        { "row": 3, "col": 8, "value": 3 }, { "row": 4, "col": 0, "value": 4 },
        { "row": 4, "col": 3, "value": 8 }, { "row": 4, "col": 5, "value": 3 },
        { "row": 4, "col": 8, "value": 1 }, { "row": 5, "col": 0, "value": 7 },
        { "row": 5, "col": 4, "value": 2 }, { "row": 5, "col": 8, "value": 6 },
        { "row": 6, "col": 1, "value": 6 }, { "row": 6, "col": 6, "value": 2 },
        { "row": 6, "col": 7, "value": 8 }, { "row": 7, "col": 3, "value": 4 },
        { "row": 7, "col": 4, "value": 1 }, { "row": 7, "col": 5, "value": 9 },
        { "row": 7, "col": 8, "value": 5 }, { "row": 8, "col": 4, "value": 8 },
        { "row": 8, "col": 7, "value": 7 }, { "row": 8, "col": 8, "value": 9 }
      ],
      "solution": [
        [5,3,4,6,7,8,9,1,2],
        [6,7,2,1,9,5,3,4,8],
        [1,9,8,3,4,2,5,6,7],
        [8,5,9,7,6,1,4,2,3],
        [4,2,6,8,5,3,7,9,1],
        [7,1,3,9,2,4,8,5,6],
        [9,6,1,5,3,7,2,8,4],
        [2,8,7,4,1,9,6,3,5],
        [3,4,5,2,8,6,1,7,9]
      ],
      "hints": [
        { "row": 0, "col": 2, "value": 4 },
        { "row": 0, "col": 3, "value": 6 }
      ]
    }
  ],
  "timerConfig": {
    "type": "countdown",
    "duration": 120,
    "warningAt": [30, 10, 5]
  },
  "scoringConfig": {
    "basePoints": 10,
    "bonusMultiplier": 1.5,
    "penaltyPerHint": 50,
    "penaltyPerWrong": 5,
    "timeBonusFormula": "linear",
    "timeBonusMultiplier": 2
  },
  "uiConfig": {
    "theme": "light",
    "primaryColor": "#6366F1",
    "secondaryColor": "#818CF8",
    "iconSet": "lucide",
    "layout": "centered",
    "showTimer": true,
    "showScore": true,
    "showProgress": true
  },
  "metadata": {
    "author": "TaPTaP Engine Team",
    "createdAt": "2026-03-07T00:00:00Z",
    "updatedAt": "2026-03-07T00:00:00Z",
    "tags": ["logic", "reasoning", "numbers", "grid"],
    "targetSkill": "Logical Reasoning",
    "estimatedPlayTime": 15
  },
  "apiConfig": {
    "leaderboardEndpoint": "/api/leaderboard/sudoku-classic-v1",
    "scoreSubmitEndpoint": "/api/score"
  }
}
```

---

## C. Sample JSON - Word Builder Game

```json
{
  "gameId": "word-builder-v1",
  "gameType": "WORD",
  "title": "Word Builder",
  "description": "Create as many valid words as you can from the given letters. Build your vocabulary and verbal reasoning.",
  "version": "1.0.0",
  "difficulty": "medium",
  "levels": [
    {
      "levelNumber": 1,
      "timeLimit": 90,
      "bonusMultiplier": 1.0,
      "availableLetters": ["T", "A", "P", "E", "R", "S"],
      "validWords": [
        { "word": "TAPE", "points": 10, "difficulty": "easy" },
        { "word": "RATE", "points": 10, "difficulty": "easy" },
        { "word": "STEP", "points": 10, "difficulty": "easy" },
        { "word": "PEAR", "points": 10, "difficulty": "easy" },
        { "word": "TAPES", "points": 20, "difficulty": "medium" },
        { "word": "RATES", "points": 20, "difficulty": "medium" },
        { "word": "PASTER", "points": 40, "difficulty": "hard" },
        { "word": "REPAST", "points": 40, "difficulty": "hard" }
      ],
      "bonusWords": [
        { "word": "TAPERS", "points": 50, "difficulty": "hard" },
        { "word": "TRAPES", "points": 50, "difficulty": "hard" }
      ],
      "minWordLength": 3,
      "maxWordLength": 6
    },
    {
      "levelNumber": 2,
      "timeLimit": 120,
      "bonusMultiplier": 1.5,
      "availableLetters": ["B", "R", "A", "I", "N", "S", "T", "O"],
      "validWords": [
        { "word": "BRAIN", "points": 20, "difficulty": "easy" },
        { "word": "TRAIN", "points": 20, "difficulty": "easy" },
        { "word": "SAINT", "points": 20, "difficulty": "easy" },
        { "word": "ORBIT", "points": 25, "difficulty": "medium" },
        { "word": "STRAIN", "points": 30, "difficulty": "medium" },
        { "word": "RATION", "points": 30, "difficulty": "medium" },
        { "word": "OBTAINS", "points": 50, "difficulty": "hard" }
      ],
      "bonusWords": [
        { "word": "RATIOBNS", "points": 60, "difficulty": "hard" }
      ],
      "minWordLength": 4,
      "maxWordLength": 8
    },
    {
      "levelNumber": 3,
      "timeLimit": 150,
      "bonusMultiplier": 2.0,
      "availableLetters": ["C", "O", "M", "P", "U", "T", "E", "R", "S"],
      "validWords": [
        { "word": "COMPUTE", "points": 35, "difficulty": "medium" },
        { "word": "COMETS", "points": 30, "difficulty": "medium" },
        { "word": "SCOPE", "points": 20, "difficulty": "easy" },
        { "word": "TEMPO", "points": 20, "difficulty": "easy" },
        { "word": "STUMP", "points": 20, "difficulty": "easy" },
        { "word": "SPROUT", "points": 25, "difficulty": "medium" },
        { "word": "COMPUTER", "points": 60, "difficulty": "hard" },
        { "word": "COMPUTERS", "points": 80, "difficulty": "hard" }
      ],
      "bonusWords": [
        { "word": "COMPUTES", "points": 70, "difficulty": "hard" }
      ],
      "minWordLength": 4,
      "maxWordLength": 9
    }
  ],
  "timerConfig": {
    "type": "countdown",
    "duration": 90,
    "warningAt": [20, 10, 5]
  },
  "scoringConfig": {
    "basePoints": 10,
    "bonusMultiplier": 1.5,
    "penaltyPerHint": 30,
    "penaltyPerWrong": 0,
    "timeBonusFormula": "linear",
    "timeBonusMultiplier": 1
  },
  "metadata": {
    "author": "TaPTaP Engine Team",
    "createdAt": "2026-03-07T00:00:00Z",
    "updatedAt": "2026-03-07T00:00:00Z",
    "tags": ["vocabulary", "english", "words", "verbal"],
    "targetSkill": "Verbal Ability",
    "estimatedPlayTime": 10
  },
  "apiConfig": {
    "leaderboardEndpoint": "/api/leaderboard/word-builder-v1",
    "scoreSubmitEndpoint": "/api/score"
  }
}
```

---

## D. Sample JSON - Aptitude Blitz Game (Bonus)

```json
{
  "gameId": "aptitude-blitz-v1",
  "gameType": "MCQ",
  "title": "Aptitude Blitz",
  "description": "Race against the clock to solve quantitative and logical reasoning questions. Negative marking applies!",
  "version": "1.0.0",
  "difficulty": "medium",
  "levels": [
    {
      "levelNumber": 1,
      "timeLimit": 120,
      "bonusMultiplier": 1.0,
      "shuffleQuestions": true,
      "shuffleOptions": true,
      "negativeMarking": true,
      "questions": [
        {
          "id": "q1",
          "question": "If a train travels 360 km in 4 hours, what is its speed in km/h?",
          "options": [
            { "id": "a", "text": "80 km/h" },
            { "id": "b", "text": "90 km/h" },
            { "id": "c", "text": "100 km/h" },
            { "id": "d", "text": "70 km/h" }
          ],
          "correctOptionId": "b",
          "explanation": "Speed = Distance / Time = 360 / 4 = 90 km/h",
          "category": "arithmetic",
          "difficulty": "easy"
        },
        {
          "id": "q2",
          "question": "What comes next in the series: 2, 6, 18, 54, ?",
          "options": [
            { "id": "a", "text": "108" },
            { "id": "b", "text": "162" },
            { "id": "c", "text": "148" },
            { "id": "d", "text": "216" }
          ],
          "correctOptionId": "b",
          "explanation": "Each number is multiplied by 3: 54 × 3 = 162",
          "category": "series",
          "difficulty": "easy"
        },
        {
          "id": "q3",
          "question": "A shopkeeper gives a 20% discount and still makes a 25% profit. If the cost price is ₹400, what is the marked price?",
          "options": [
            { "id": "a", "text": "₹500" },
            { "id": "b", "text": "₹600" },
            { "id": "c", "text": "₹625" },
            { "id": "d", "text": "₹650" }
          ],
          "correctOptionId": "c",
          "explanation": "SP = 400 × 1.25 = 500. MP × 0.8 = 500 → MP = 625",
          "category": "profit-loss",
          "difficulty": "medium"
        }
      ]
    }
  ],
  "timerConfig": {
    "type": "countdown",
    "duration": 120,
    "warningAt": [30, 10, 5]
  },
  "scoringConfig": {
    "basePoints": 50,
    "bonusMultiplier": 1.0,
    "penaltyPerHint": 0,
    "penaltyPerWrong": 15,
    "timeBonusFormula": "linear",
    "timeBonusMultiplier": 1
  },
  "metadata": {
    "author": "TaPTaP Engine Team",
    "createdAt": "2026-03-07T00:00:00Z",
    "updatedAt": "2026-03-07T00:00:00Z",
    "tags": ["aptitude", "quantitative", "reasoning", "MCQ"],
    "targetSkill": "Quantitative Aptitude",
    "estimatedPlayTime": 8
  },
  "apiConfig": {
    "leaderboardEndpoint": "/api/leaderboard/aptitude-blitz-v1",
    "scoreSubmitEndpoint": "/api/score"
  }
}
```

---

## E. Zod Validation Schema

```typescript
import { z } from "zod";

// ============================================================
// ENUM SCHEMAS
// ============================================================

const GameTypeSchema = z.enum(["GRID", "WORD", "MCQ", "DRAG_DROP", "CUSTOM"], {
  errorMap: () => ({
    message: "gameType must be one of: GRID, WORD, MCQ, DRAG_DROP, CUSTOM",
  }),
});

const DifficultySchema = z.enum(["easy", "medium", "hard"], {
  errorMap: () => ({
    message: "difficulty must be one of: easy, medium, hard",
  }),
});

const TimerTypeSchema = z.enum(["countdown", "countup"], {
  errorMap: () => ({
    message: "timer type must be either 'countdown' or 'countup'",
  }),
});

const TimeBonusFormulaSchema = z.enum(["linear", "exponential", "none"], {
  errorMap: () => ({
    message: "timeBonusFormula must be one of: linear, exponential, none",
  }),
});

// ============================================================
// SUB-SCHEMAS
// ============================================================

const TimerConfigSchema = z.object({
  type: TimerTypeSchema,
  duration: z
    .number({ required_error: "Timer duration is required" })
    .int("Timer duration must be a whole number")
    .min(10, "Timer duration must be at least 10 seconds")
    .max(3600, "Timer duration cannot exceed 3600 seconds (1 hour)"),
  warningAt: z
    .array(z.number().int().min(1).max(3600))
    .min(1, "At least one warning threshold is required")
    .default([30, 10, 5]),
});

const ScoringConfigSchema = z.object({
  basePoints: z
    .number({ required_error: "basePoints is required" })
    .int("basePoints must be a whole number")
    .min(1, "basePoints must be at least 1")
    .max(10000, "basePoints cannot exceed 10000"),
  bonusMultiplier: z
    .number()
    .min(0.1, "bonusMultiplier must be at least 0.1")
    .max(100, "bonusMultiplier cannot exceed 100")
    .default(1.0),
  penaltyPerHint: z
    .number()
    .int()
    .min(0, "penaltyPerHint cannot be negative")
    .max(1000, "penaltyPerHint cannot exceed 1000")
    .default(0),
  penaltyPerWrong: z
    .number()
    .int()
    .min(0, "penaltyPerWrong cannot be negative")
    .max(1000, "penaltyPerWrong cannot exceed 1000")
    .default(0),
  timeBonusFormula: TimeBonusFormulaSchema.default("none"),
  timeBonusMultiplier: z.number().min(0).max(100).default(1),
});

const UIConfigSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "primaryColor must be a valid hex color (e.g. #6366F1)"),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "secondaryColor must be a valid hex color")
    .optional(),
  iconSet: z.string().default("lucide"),
  layout: z.enum(["centered", "fullscreen", "sidebar"]).default("centered"),
  showTimer: z.boolean().default(true),
  showScore: z.boolean().default(true),
  showProgress: z.boolean().default(true),
}).optional();

const MetadataSchema = z.object({
  author: z.string().min(1, "Author name is required"),
  createdAt: z.string().datetime("createdAt must be a valid ISO 8601 datetime"),
  updatedAt: z.string().datetime("updatedAt must be a valid ISO 8601 datetime"),
  tags: z.array(z.string()).min(1, "At least one tag is required").default([]),
  targetSkill: z.string().min(1, "targetSkill is required"),
  estimatedPlayTime: z
    .number()
    .int()
    .min(1, "estimatedPlayTime must be at least 1 minute")
    .max(120, "estimatedPlayTime cannot exceed 120 minutes"),
}).optional();

const APIConfigSchema = z.object({
  leaderboardEndpoint: z.string().min(1),
  scoreSubmitEndpoint: z.string().min(1),
}).optional();

// ============================================================
// LEVEL SCHEMAS (game-type-specific)
// ============================================================

const GridCellSchema = z.object({
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  value: z.number().int().min(1).max(9),
});

const GridLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  gridSize: z.number().int().min(2).max(16, "Grid size cannot exceed 16×16"),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
  preFilledCells: z.array(GridCellSchema).min(1, "At least one pre-filled cell required"),
  solution: z.array(z.array(z.number().int())),
  hints: z.array(GridCellSchema).optional(),
});

const WordEntrySchema = z.object({
  word: z.string().min(1).toUpperCase(),
  points: z.number().int().min(1).max(1000),
  difficulty: DifficultySchema,
});

const WordLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
  availableLetters: z.array(z.string().length(1)).min(3, "At least 3 letters required"),
  validWords: z.array(WordEntrySchema).min(1, "At least one valid word required"),
  bonusWords: z.array(WordEntrySchema).optional(),
  minWordLength: z.number().int().min(2).max(20),
  maxWordLength: z.number().int().min(2).max(20),
});

const MCQOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1, "Option text cannot be empty"),
});

const MCQQuestionSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1, "Question text cannot be empty"),
  options: z
    .array(MCQOptionSchema)
    .min(2, "Each question must have at least 2 options")
    .max(6, "Each question can have at most 6 options"),
  correctOptionId: z.string().min(1),
  explanation: z.string().optional(),
  category: z.string().optional(),
  difficulty: DifficultySchema,
});

const MCQLevelSchema = z.object({
  levelNumber: z.number().int().min(1),
  timeLimit: z.number().int().min(10).max(3600).optional(),
  bonusMultiplier: z.number().min(0.1).max(100).optional(),
  questions: z.array(MCQQuestionSchema).min(1, "At least one question required"),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  negativeMarking: z.boolean().default(false),
});

// ============================================================
// MASTER GAME CONFIG SCHEMA
// ============================================================

export const GameConfigSchema = z
  .object({
    gameId: z
      .string({ required_error: "gameId is required" })
      .min(3, "gameId must be at least 3 characters")
      .max(64, "gameId cannot exceed 64 characters")
      .regex(
        /^[a-z0-9-]+$/,
        "gameId must contain only lowercase letters, numbers, and hyphens"
      ),
    gameType: GameTypeSchema,
    title: z
      .string({ required_error: "title is required" })
      .min(2, "title must be at least 2 characters")
      .max(100, "title cannot exceed 100 characters"),
    description: z
      .string({ required_error: "description is required" })
      .min(10, "description must be at least 10 characters")
      .max(500, "description cannot exceed 500 characters"),
    version: z
      .string()
      .regex(
        /^\d+\.\d+\.\d+$/,
        "version must follow semver format (e.g. 1.0.0)"
      ),
    difficulty: DifficultySchema,
    levels: z.array(z.any()).min(1, "At least one level is required"),
    timerConfig: TimerConfigSchema,
    scoringConfig: ScoringConfigSchema,
    uiConfig: UIConfigSchema,
    metadata: MetadataSchema,
    apiConfig: APIConfigSchema,
  })
  .superRefine((data, ctx) => {
    // Game-type-specific level validation
    const levelSchema = {
      GRID: GridLevelSchema,
      WORD: WordLevelSchema,
      MCQ: MCQLevelSchema,
    }[data.gameType];

    if (levelSchema) {
      data.levels.forEach((level: unknown, index: number) => {
        const result = levelSchema.safeParse(level);
        if (!result.success) {
          result.error.issues.forEach((issue) => {
            ctx.addIssue({
              ...issue,
              path: ["levels", index, ...issue.path],
            });
          });
        }
      });
    }

    // Validate MCQ: correctOptionId must exist in options
    if (data.gameType === "MCQ") {
      data.levels.forEach((level: any, li: number) => {
        level.questions?.forEach((q: any, qi: number) => {
          const optionIds = q.options?.map((o: any) => o.id) ?? [];
          if (!optionIds.includes(q.correctOptionId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `correctOptionId "${q.correctOptionId}" does not match any option id`,
              path: ["levels", li, "questions", qi, "correctOptionId"],
            });
          }
        });
      });
    }

    // Validate Grid: preFilledCells within gridSize bounds
    if (data.gameType === "GRID") {
      data.levels.forEach((level: any, li: number) => {
        level.preFilledCells?.forEach((cell: any, ci: number) => {
          if (cell.row >= level.gridSize || cell.col >= level.gridSize) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Cell (${cell.row},${cell.col}) is outside ${level.gridSize}×${level.gridSize} grid`,
              path: ["levels", li, "preFilledCells", ci],
            });
          }
        });
      });
    }
  });

// ============================================================
// TYPE INFERENCE
// ============================================================

export type GameConfig = z.infer<typeof GameConfigSchema>;

// ============================================================
// VALIDATE UTILITY FUNCTION
// ============================================================

export interface ValidationSuccess {
  success: true;
  data: GameConfig;
}

export interface ValidationFailure {
  success: false;
  errors: {
    path: string;
    code: string;
    message: string;
    received?: unknown;
  }[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validateGameConfig(raw: unknown): ValidationResult {
  const result = GameConfigSchema.safeParse(raw);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
      received: "received" in issue ? (issue as any).received : undefined,
    })),
  };
}

// ============================================================
// USAGE EXAMPLE
// ============================================================

/*
import { validateGameConfig } from "./schemas/validate";
import rawConfig from "../games/sudoku/config.json";

const result = validateGameConfig(rawConfig);

if (result.success) {
  console.log("Valid config:", result.data.title);
  // result.data is fully typed as GameConfig
} else {
  console.error("Invalid config:");
  result.errors.forEach((err) => {
    console.error(`  [${err.path}] ${err.message}`);
  });
}
*/
```

---

## F. Config Extension Guide - Adding "Logic Grid" to the Engine

### Step 1: Define the Game JSON Config

Create the file `/games/logic-grid/config.json`:

```json
{
  "gameId": "logic-grid-v1",
  "gameType": "GRID",
  "title": "Logic Grid",
  "description": "Use clues to determine the correct placement in the grid.",
  "version": "1.0.0",
  "difficulty": "hard",
  "levels": [ /* level data conforming to GridLevelConfig */ ],
  "timerConfig": { "type": "countdown", "duration": 300, "warningAt": [60, 30] },
  "scoringConfig": { "basePoints": 25, "bonusMultiplier": 2, "penaltyPerHint": 50, "penaltyPerWrong": 10, "timeBonusFormula": "linear", "timeBonusMultiplier": 3 }
}
```

If `GRID` type fits the game, **you are done. No further steps needed.** The engine auto-discovers and renders it.

### Step 2: (Only if needed) Register a New GameType Enum

If Logic Grid requires a fundamentally new renderer, add to the `GameType` enum:

```typescript
// src/core/types.ts
enum GameType {
  GRID = "GRID",
  WORD = "WORD",
  MCQ = "MCQ",
  DRAG_DROP = "DRAG_DROP",
  LOGIC_GRID = "LOGIC_GRID",  // ← new
  CUSTOM = "CUSTOM",
}
```

### Step 3: (Only if needed) Create a Custom Renderer

```typescript
// games/logic-grid/LogicGridRenderer.tsx
import type { GameRendererProps } from "../../src/core/types";

export const LogicGridRenderer: React.FC<GameRendererProps> = ({
  config, level, onAction, onComplete, isPaused
}) => {
  // Custom rendering logic for Logic Grid
  return <div className="logic-grid">/* Grid UI */</div>;
};
```

### Step 4: (Only if needed) Register the Custom Renderer

```typescript
// games/logic-grid/index.ts
import { GameRegistry } from "../../src/core/GameRegistry";
import { LogicGridRenderer } from "./LogicGridRenderer";

GameRegistry.registerRenderer("LOGIC_GRID", LogicGridRenderer);
```

### Step 5: Validate and Test

Run the validation utility against your config:

```bash
npx tsx scripts/validate-config.ts games/logic-grid/config.json
```

If validation passes, the game is live. Launch the dev server and the game appears in the game selector automatically.

### Summary: What Changes Where?

| Step | File Changed | Engine Core Modified? |
|------|-------------|----------------------|
| Create config.json | `/games/logic-grid/config.json` | ❌ No |
| Add GameType enum (if new type) | `/src/core/types.ts` | ⚠️ One line only |
| Custom renderer (if needed) | `/games/logic-grid/LogicGridRenderer.tsx` | ❌ No |
| Register renderer (if needed) | `/games/logic-grid/index.ts` | ❌ No |

**For games that fit existing types (GRID, WORD, MCQ, DRAG_DROP), the answer is: zero engine changes. Drop the JSON. Ship it.**

---

*This schema specification provides the complete contract for building games on the TaPTaP Game Engine. Every game config is validated at load time, ensuring malformed data never reaches the renderer. The schema is designed to be extended - new game types add to the system without breaking existing games.*
