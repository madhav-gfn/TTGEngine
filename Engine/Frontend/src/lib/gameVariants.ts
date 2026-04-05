import type { AdaptiveBand, GameConfig } from "@/core/types";
import { API_ENDPOINTS } from "./constants";
import { postJson } from "./api";
import { validateGameConfig } from "@/schemas/validate";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function generateGameVariant(
  gameId: string,
  options?: { band?: AdaptiveBand; seed?: string },
): Promise<GameConfig> {
  const response = await postJson<ApiSuccess<unknown>>(
    `${API_ENDPOINTS.games}/${encodeURIComponent(gameId)}/variant`,
    options ?? {},
  );

  const result = validateGameConfig(response.data);
  if (!result.success) {
    throw new Error(result.errors.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
  }

  return result.data;
}
