import { leaderboardConnector } from "@/core/LeaderboardConnector";
import type { LeaderboardEntry, LeaderboardQuery } from "@/core/types";
import { useLeaderboardStore } from "@/store/leaderboardStore";

export function useLeaderboard() {
  const cache = useLeaderboardStore((state) => state.cache);
  const setLeaderboard = useLeaderboardStore((state) => state.setLeaderboard);

  async function loadLeaderboard(
    gameId: string,
    options?: LeaderboardQuery,
  ): Promise<LeaderboardEntry[]> {
    if (cache[gameId]) {
      return cache[gameId];
    }

    const entries = await leaderboardConnector.getLeaderboard(gameId, options);
    setLeaderboard(gameId, entries);
    return entries;
  }

  return {
    cache,
    loadLeaderboard,
  };
}
