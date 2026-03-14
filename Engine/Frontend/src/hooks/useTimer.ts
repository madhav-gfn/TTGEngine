import { useGameStore } from "@/store/gameStore";
import { formatDuration } from "@/lib/utils";

export function useTimer() {
  const timerTick = useGameStore((state) => state.timerTick);

  return {
    ...timerTick,
    label: formatDuration(timerTick.remaining || timerTick.elapsed),
  };
}
