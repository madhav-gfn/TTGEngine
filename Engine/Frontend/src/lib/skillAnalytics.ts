import type { SkillAnalyticsSnapshot } from "@/core/types";
import { getJson } from "./api";
import { API_ENDPOINTS } from "./constants";

interface ApiSuccess<T> {
  success: true;
  data: T;
}

export async function fetchSkillAnalytics(
  userId: string,
  options?: { limit?: number; gameId?: string },
): Promise<SkillAnalyticsSnapshot> {
  const query = new URLSearchParams();
  if (options?.limit) {
    query.set("limit", String(options.limit));
  }
  if (options?.gameId) {
    query.set("gameId", options.gameId);
  }

  const response = await getJson<ApiSuccess<SkillAnalyticsSnapshot>>(
    `${API_ENDPOINTS.analytics}/skills/${encodeURIComponent(userId)}?${query.toString()}`,
  );

  return response.data;
}
