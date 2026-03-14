import { useGameStore } from "@/store/gameStore";

export function useScore() {
  return useGameStore((state) => state.scoreState);
}
