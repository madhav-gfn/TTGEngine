import type { Difficulty } from "./gameSchema.js";
import type { UserScoreHistoryRow } from "../db/queries.js";
import type { SkillAnalyticsPayload, SkillAnalyticsSession, SkillAnalyticsSkill } from "../types/api.js";

type SessionMetadata = {
  accuracy?: number;
  targetSkill?: string;
  adaptiveInsights?: Array<{
    bandApplied?: string;
    recommendedNextBand?: string;
  }>;
  generationLog?: unknown[];
  levelBreakdown?: unknown[];
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampAccuracy(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function parseMetadata(raw: string | null): SessionMetadata {
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as SessionMetadata;
  } catch {
    return {};
  }
}

function getMoments(
  insights: SessionMetadata["adaptiveInsights"],
): Pick<SkillAnalyticsSession, "supportMoments" | "challengeMoments" | "standardMoments"> {
  const summary = {
    supportMoments: 0,
    challengeMoments: 0,
    standardMoments: 0,
  };

  (insights ?? []).forEach((insight) => {
    const nextBand = insight.recommendedNextBand ?? insight.bandApplied ?? "standard";
    if (nextBand === "support") {
      summary.supportMoments += 1;
      return;
    }
    if (nextBand === "challenge") {
      summary.challengeMoments += 1;
      return;
    }
    summary.standardMoments += 1;
  });

  return summary;
}

function summarizeMastery(skill: SkillAnalyticsSkill): SkillAnalyticsSkill["mastery"] {
  if (skill.averageAccuracy >= 0.82 && skill.challengeMoments >= skill.supportMoments) {
    return "strong";
  }

  if (skill.averageAccuracy >= 0.58) {
    return "growing";
  }

  return "emerging";
}

function recommendedFocus(skill: SkillAnalyticsSkill): string {
  if (skill.mastery === "strong") {
    return "Keep pushing challenge rounds and maintain consistency under pressure.";
  }

  if (skill.supportMoments > skill.challengeMoments) {
    return "Spend a few more runs in support mode and aim for clean fundamentals before scaling up.";
  }

  if (skill.accuracyDelta > 0.05) {
    return "Momentum is trending up. Stay with balanced runs and convert accuracy into speed.";
  }

  return "Focus on repeat accuracy and error control so the adaptive engine can graduate you into harder rounds.";
}

function toDifficulty(value: string): Difficulty {
  if (value === "easy" || value === "medium" || value === "hard") {
    return value;
  }

  return "medium";
}

export function buildSkillAnalytics(userId: string, rows: UserScoreHistoryRow[]): SkillAnalyticsPayload {
  const sessions: SkillAnalyticsSession[] = rows.map((row) => {
    const metadata = parseMetadata(row.metadata);
    const moments = getMoments(metadata.adaptiveInsights);

    return {
      gameId: row.gameId,
      skill: metadata.targetSkill?.trim() || "General",
      score: row.score,
      accuracy: clampAccuracy(metadata.accuracy),
      difficulty: toDifficulty(row.difficulty),
      submittedAt: row.submittedAt,
      timeTaken: row.timeTaken,
      levelCount:
        Array.isArray(metadata.levelBreakdown) && metadata.levelBreakdown.length > 0
          ? metadata.levelBreakdown.length
          : row.level,
      supportMoments: moments.supportMoments,
      challengeMoments: moments.challengeMoments,
      standardMoments: moments.standardMoments,
      generatedLevels: Array.isArray(metadata.generationLog) ? metadata.generationLog.length : 0,
    };
  });

  const skills = new Map<string, SkillAnalyticsSession[]>();
  sessions.forEach((session) => {
    const bucket = skills.get(session.skill) ?? [];
    bucket.push(session);
    skills.set(session.skill, bucket);
  });

  const summaries = Array.from(skills.entries()).map(([skill, entries]) => {
    const chronological = [...entries].sort(
      (left, right) => new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime(),
    );
    const recentEntries = chronological.slice(-3);
    const previousEntries = chronological.slice(Math.max(0, chronological.length - 6), Math.max(0, chronological.length - 3));
    const averageScore = entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;
    const averageAccuracy = entries.reduce((sum, entry) => sum + entry.accuracy, 0) / entries.length;
    const recentAccuracy = recentEntries.reduce((sum, entry) => sum + entry.accuracy, 0) / recentEntries.length;
    const previousAccuracy =
      previousEntries.length > 0
        ? previousEntries.reduce((sum, entry) => sum + entry.accuracy, 0) / previousEntries.length
        : averageAccuracy;
    const bestSession = entries.reduce((best, entry) => (entry.score > best.score ? entry : best), entries[0]);
    const supportMoments = entries.reduce((sum, entry) => sum + entry.supportMoments, 0);
    const challengeMoments = entries.reduce((sum, entry) => sum + entry.challengeMoments, 0);

    const summary: SkillAnalyticsSkill = {
      skill,
      sessionsPlayed: entries.length,
      averageScore: round(averageScore, 0),
      bestScore: bestSession.score,
      averageAccuracy: round(averageAccuracy),
      recentAccuracy: round(recentAccuracy),
      accuracyDelta: round(recentAccuracy - previousAccuracy),
      supportMoments,
      challengeMoments,
      mastery: "emerging",
      strongestGameId: bestSession.gameId,
      lastPlayedAt: entries[0]?.submittedAt ?? null,
      recommendedFocus: "",
    };

    summary.mastery = summarizeMastery(summary);
    summary.recommendedFocus = recommendedFocus(summary);
    return summary;
  }).sort((left, right) => {
    if (right.averageAccuracy !== left.averageAccuracy) {
      return right.averageAccuracy - left.averageAccuracy;
    }

    return right.sessionsPlayed - left.sessionsPlayed;
  });

  const strongestSkill = summaries[0]?.skill ?? null;
  const focusSkill =
    [...summaries].sort((left, right) => {
      if (left.mastery !== right.mastery) {
        const order = { emerging: 0, growing: 1, strong: 2 } as const;
        return order[left.mastery] - order[right.mastery];
      }

      if (left.recentAccuracy !== right.recentAccuracy) {
        return left.recentAccuracy - right.recentAccuracy;
      }

      return right.supportMoments - left.supportMoments;
    })[0]?.skill ?? null;

  return {
    userId,
    updatedAt: new Date().toISOString(),
    totalSessions: sessions.length,
    trackedSkills: summaries.length,
    strongestSkill,
    focusSkill,
    skills: summaries,
    recentSessions: sessions.slice(0, 6),
  };
}
