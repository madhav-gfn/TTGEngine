import { useEffect, useState } from "react";
import type { SkillAnalyticsSnapshot } from "@/core/types";
import { fetchSkillAnalytics } from "@/lib/skillAnalytics";

interface SkillAnalyticsState {
  analytics: SkillAnalyticsSnapshot | null;
  loading: boolean;
  error: string | null;
}

export function useSkillAnalytics(
  userId: string | null,
  options?: { limit?: number; gameId?: string },
): SkillAnalyticsState {
  const [state, setState] = useState<SkillAnalyticsState>({
    analytics: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!userId) {
      setState({
        analytics: null,
        loading: false,
        error: null,
      });
      return;
    }

    let cancelled = false;
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void fetchSkillAnalytics(userId, options)
      .then((analytics) => {
        if (!cancelled) {
          setState({
            analytics,
            loading: false,
            error: null,
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            analytics: null,
            loading: false,
            error: error instanceof Error ? error.message : "Failed to load skill analytics.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [options?.gameId, options?.limit, userId]);

  return state;
}
