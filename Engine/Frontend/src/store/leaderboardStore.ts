import { create } from "zustand";
import type { LeaderboardEntry } from "@/core/types";

type LeaderboardStore = {
  cache: Record<string, LeaderboardEntry[]>;
  setLeaderboard: (gameId: string, entries: LeaderboardEntry[]) => void;
  clearLeaderboard: (gameId: string) => void;
};

export const useLeaderboardStore = create<LeaderboardStore>((set) => ({
  cache: {},
  setLeaderboard: (gameId, entries) =>
    set((state) => ({
      cache: { ...state.cache, [gameId]: entries },
    })),
  clearLeaderboard: (gameId) =>
    set((state) => {
      const next = { ...state.cache };
      delete next[gameId];
      return { cache: next };
    }),
}));
