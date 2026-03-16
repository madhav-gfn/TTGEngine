import { useCallback } from "react";
import { leaderboardConnector } from "@/core/LeaderboardConnector";
import type { GameConfig, LeaderboardEntry, LeaderboardQuery } from "@/core/types";
import { useLeaderboardStore } from "@/store/leaderboardStore";

function serializeLeaderboardKey(gameId: string, options?: LeaderboardQuery): string {
  const query = new URLSearchParams();
  Object.entries(options ?? {}).forEach(([key, value]) => {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  });

  return `${gameId}?${query.toString()}`;
}

export function useLeaderboard() {
  const cache = useLeaderboardStore((state) => state.cache);
  const setLeaderboard = useLeaderboardStore((state) => state.setLeaderboard);

  const loadLeaderboard = useCallback(async (
    gameId: string,
    options?: LeaderboardQuery,
    config?: Pick<GameConfig, "apiConfig">,
  ): Promise<LeaderboardEntry[]> => {
    const cacheKey = serializeLeaderboardKey(gameId, options);
    if (cache[cacheKey]) {
      return cache[cacheKey];
    }

    const entries = await leaderboardConnector.getLeaderboard(gameId, options, config);
    setLeaderboard(cacheKey, entries);
    return entries;
  }, [cache, setLeaderboard]);

  return {
    cache,
    loadLeaderboard,
    serializeLeaderboardKey,
  };
}
