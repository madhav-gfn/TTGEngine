import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { runtimeConfig } from "../lib/runtimeConfig.js";

const databasePath = runtimeConfig.databasePath;
const dataDirectory = path.dirname(databasePath);

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS scores (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT UNIQUE NOT NULL,
    user_id       TEXT NOT NULL,
    game_id       TEXT NOT NULL,
    score         INTEGER NOT NULL,
    time_taken    INTEGER NOT NULL,
    level         INTEGER NOT NULL,
    difficulty    TEXT NOT NULL DEFAULT 'medium',
    metadata      TEXT,
    submitted_at  TEXT NOT NULL,
    is_valid      INTEGER NOT NULL DEFAULT 1,
    UNIQUE(user_id, game_id, submitted_at)
);
CREATE INDEX IF NOT EXISTS idx_leaderboard ON scores(game_id, score DESC, time_taken ASC, submitted_at ASC);
CREATE INDEX IF NOT EXISTS idx_user_scores ON scores(user_id, game_id);
CREATE INDEX IF NOT EXISTS idx_submitted_at ON scores(submitted_at);
`;

fs.mkdirSync(dataDirectory, { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.exec(SCHEMA_SQL);
