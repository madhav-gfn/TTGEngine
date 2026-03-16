import { create } from "zustand";
import type { LeaderboardEntry } from "@/core/types";

type LeaderboardStore = {
  cache: Record<string, LeaderboardEntry[]>;
  setLeaderboard: (cacheKey: string, entries: LeaderboardEntry[]) => void;
  clearLeaderboard: (cacheKey: string) => void;
};

export const useLeaderboardStore = create<LeaderboardStore>((set) => ({
  cache: {},
  setLeaderboard: (cacheKey, entries) =>
    set((state) => ({
      cache: { ...state.cache, [cacheKey]: entries },
    })),
  clearLeaderboard: (cacheKey) =>
    set((state) => {
      const next = { ...state.cache };
      delete next[cacheKey];
      return { cache: next };
    }),
}));
