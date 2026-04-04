import { deleteJson, getJson, postJson, putJson } from "./api";
import { ADMIN_API_KEY, API_ENDPOINTS } from "./constants";
import type { Difficulty, GameType, LeaderboardEntry } from "@/core/types";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface AdminGameOverview {
  gameId: string;
  title: string;
  description: string;
  gameType: GameType;
  difficulty: Difficulty;
  version: string;
  estimatedPlayTime?: number;
  tags: string[];
  directory: string;
  submissions: number;
  validSubmissions: number;
  players: number;
  highScore: number | null;
  averageScore: number | null;
  lastSubmissionAt: string | null;
  leaderboardPreview: LeaderboardEntry[];
}

export interface AdminOverview {
  generatedAt: string;
  overall: {
    totalGames: number;
    submissions: number;
    validSubmissions: number;
    players: number;
  };
  games: AdminGameOverview[];
}

function withAdminHeaders(init?: RequestInit): RequestInit {
  return {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(ADMIN_API_KEY ? { "x-admin-key": ADMIN_API_KEY } : {}),
    },
  };
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const response = await getJson<ApiSuccess<AdminOverview>>(`${API_ENDPOINTS.admin}/overview`, withAdminHeaders());
  return response.data;
}

export async function getAdminGame(gameId: string): Promise<unknown> {
  const response = await getJson<ApiSuccess<unknown>>(`${API_ENDPOINTS.admin}/games/${encodeURIComponent(gameId)}`, withAdminHeaders());
  return response.data;
}

export async function createAdminGame(config: unknown, directoryName?: string): Promise<void> {
  await postJson<ApiSuccess<unknown>>(
    `${API_ENDPOINTS.admin}/games`,
    {
      config,
      directoryName,
    },
    withAdminHeaders(),
  );
}

export async function updateAdminGame(gameId: string, config: unknown): Promise<void> {
  await putJson<ApiSuccess<unknown>>(
    `${API_ENDPOINTS.admin}/games/${encodeURIComponent(gameId)}`,
    {
      config,
    },
    withAdminHeaders(),
  );
}

export async function deleteAdminGame(gameId: string): Promise<void> {
  await deleteJson<ApiSuccess<unknown>>(`${API_ENDPOINTS.admin}/games/${encodeURIComponent(gameId)}`, withAdminHeaders());
}
