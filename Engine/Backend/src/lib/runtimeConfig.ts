import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolvePathFromCwd(rawPath: string): string {
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}

function firstExistingDirectory(candidates: string[]): string | null {
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function resolveGamesRoot(): string {
  if (process.env.GAMES_ROOT) {
    return resolvePathFromCwd(process.env.GAMES_ROOT);
  }

  const discoveredRoot = firstExistingDirectory([
    path.resolve(process.cwd(), "Games"),
    path.resolve(process.cwd(), "../../Games"),
    path.resolve(moduleDirectory, "../../../../Games"),
    path.resolve(moduleDirectory, "../../../../../../Games"),
  ]);

  return discoveredRoot ?? path.resolve(process.cwd(), "Games");
}

function resolveDatabasePath(): string {
  if (process.env.DATABASE_PATH) {
    return resolvePathFromCwd(process.env.DATABASE_PATH);
  }

  const dataDirectory = firstExistingDirectory([
    path.resolve(process.cwd(), "data"),
    path.resolve(process.cwd(), "Engine/Backend/data"),
    path.resolve(moduleDirectory, "../../data"),
    path.resolve(moduleDirectory, "../../../../data"),
  ]);

  const targetDirectory = dataDirectory ?? path.resolve(process.cwd(), "data");
  return path.join(targetDirectory, "leaderboard.db");
}

export const runtimeConfig = {
  port: parsePort(process.env.PORT, 8787),
  allowedOrigins: parseOrigins(process.env.CORS_ORIGIN),
  databasePath: resolveDatabasePath(),
  gamesRoot: resolveGamesRoot(),
  adminKey: (process.env.ADMIN_API_KEY ?? "").trim(),
};
