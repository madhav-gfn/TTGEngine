import type { ScoreState, TimerTick, UIConfig } from "@/core/types";

const LOCAL_BACKEND_PORT = "8787";
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const PLACEHOLDER_API_BASE_PATTERNS = [
  /^https?:\/\/your-[^/]+$/i,
  /your-render-backend\.onrender\.com/i,
  /your-vercel-frontend\.vercel\.app/i,
] as const;

function sanitizeApiBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "";
  }

  const isPlaceholder = PLACEHOLDER_API_BASE_PATTERNS.some((pattern) => pattern.test(trimmed));
  return isPlaceholder ? "" : trimmed;
}

function getLocalApiBaseUrl(locationLike: Pick<Location, "hostname" | "protocol"> | undefined): string {
  if (!locationLike || !LOCAL_HOSTNAMES.has(locationLike.hostname)) {
    return "";
  }

  const protocol = locationLike.protocol === "https:" ? "https:" : "http:";
  return `${protocol}//${locationLike.hostname}:${LOCAL_BACKEND_PORT}`;
}

export function resolveApiBaseUrl(
  configuredBaseUrl: string | undefined,
  locationLike: Pick<Location, "hostname" | "protocol"> | undefined =
    typeof window === "undefined" ? undefined : window.location,
): string {
  return sanitizeApiBaseUrl(configuredBaseUrl) || getLocalApiBaseUrl(locationLike);
}

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
export const ADMIN_API_KEY = (import.meta.env.VITE_ADMIN_KEY ?? "").trim();

function buildApiEndpoint(pathname: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${pathname}` : pathname;
}

export const API_ENDPOINTS = {
  health: buildApiEndpoint("/api/health"),
  games: buildApiEndpoint("/api/games"),
  score: buildApiEndpoint("/api/score"),
  leaderboard: buildApiEndpoint("/api/leaderboard"),
  admin: buildApiEndpoint("/api/admin"),
} as const;

export const STORAGE_KEYS = {
  userId: "taptap-engine:user-id",
  pendingScores: "taptap-engine:pending-scores",
} as const;

export const EMPTY_TIMER_TICK: TimerTick = {
  elapsed: 0,
  remaining: 0,
  isWarning: false,
  progress: 0,
  frame: 0,
};

export const EMPTY_SCORE_STATE: ScoreState = {
  currentLevel: 1,
  totalScore: 0,
  correctActions: 0,
  wrongActions: 0,
  hintsUsed: 0,
  totalActions: 0,
  currentLevelBase: 0,
  currentLevelMultiplier: 1,
  levelScores: [],
  accuracy: 0,
};

export const DEFAULT_UI_CONFIG: UIConfig = {
  theme: "system",
  primaryColor: "#0f766e",
  secondaryColor: "#f59e0b",
  iconSet: "lucide",
  layout: "centered",
  showTimer: true,
  showScore: true,
  showProgress: true,
};

export const APP_THEME = {
  mode: "light",
  primaryColor: "#0f766e",
  secondaryColor: "#f59e0b",
} as const;
