import type { SessionGenerationEntry, SkillAnalyticsSkill, SkillAnalyticsSnapshot } from "@/core/types";
import { formatDuration } from "@/lib/utils";

interface SkillAnalyticsPanelProps {
  title: string;
  analytics: SkillAnalyticsSnapshot | null;
  loading: boolean;
  error: string | null;
  highlightSkill?: string;
  generationLog?: SessionGenerationEntry[];
  compact?: boolean;
}

function metricLabel(skill: SkillAnalyticsSkill): string {
  if (skill.mastery === "strong") {
    return "Challenge-ready";
  }
  if (skill.mastery === "growing") {
    return "Building consistency";
  }
  return "Needs reinforcement";
}

export function SkillAnalyticsPanel({
  title,
  analytics,
  loading,
  error,
  highlightSkill,
  generationLog = [],
  compact = false,
}: SkillAnalyticsPanelProps) {
  const featuredSkill =
    analytics?.skills.find((skill) => skill.skill === highlightSkill) ??
    analytics?.skills[0] ??
    null;
  const visibleSkills = compact ? analytics?.skills.slice(0, 3) ?? [] : analytics?.skills.slice(0, 4) ?? [];
  const recentSessions = compact
    ? []
    : (analytics?.recentSessions ?? [])
      .filter((session) => !highlightSkill || session.skill === highlightSkill)
      .slice(0, 3);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          <p className="text-xs text-ink-faint">
            {analytics
              ? `${analytics.totalSessions} runs tracked across ${analytics.trackedSkills} skills`
              : "Adaptive sessions roll up into long-term skill history here."}
          </p>
        </div>
        {analytics?.strongestSkill ? (
          <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-700">
            Strongest: {analytics.strongestSkill}
          </span>
        ) : null}
      </div>

      {loading ? <p className="text-sm text-ink-muted">Loading skill analytics...</p> : null}
      {error ? <p className="text-sm text-amber-600">{error}</p> : null}

      {!loading && !error && featuredSkill ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gray-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Highlighted Skill</p>
                <h4 className="font-display text-xl font-bold text-ink">{featuredSkill.skill}</h4>
                <p className="mt-1 text-sm text-ink-muted">{metricLabel(featuredSkill)}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-ink">
                {Math.round(featuredSkill.recentAccuracy * 100)}% recent accuracy
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Runs</p>
                <p className="text-sm font-bold text-ink">{featuredSkill.sessionsPlayed}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Avg Score</p>
                <p className="text-sm font-bold text-ink">{featuredSkill.averageScore.toLocaleString()}</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Trend</p>
                <p className={`text-sm font-bold ${featuredSkill.accuracyDelta >= 0 ? "text-teal-700" : "text-amber-700"}`}>
                  {featuredSkill.accuracyDelta >= 0 ? "+" : ""}
                  {Math.round(featuredSkill.accuracyDelta * 100)} pts
                </p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">Challenge Calls</p>
                <p className="text-sm font-bold text-ink">{featuredSkill.challengeMoments}</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-ink-muted">{featuredSkill.recommendedFocus}</p>

            {generationLog.length > 0 ? (
              <p className="mt-3 text-xs text-ink-faint">
                This run generated {generationLog.length} procedural level{generationLog.length === 1 ? "" : "s"} in-session.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            {visibleSkills.map((skill) => (
              <div key={skill.skill} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{skill.skill}</p>
                  <p className="text-xs text-ink-muted">{metricLabel(skill)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink">{Math.round(skill.averageAccuracy * 100)}%</p>
                  <p className="text-xs text-ink-faint">{skill.sessionsPlayed} runs</p>
                </div>
              </div>
            ))}
          </div>

          {recentSessions.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-faint">Recent Sessions</p>
              {recentSessions.map((session) => (
                <div key={`${session.gameId}-${session.submittedAt}`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{session.gameId}</p>
                    <p className="text-xs text-ink-muted">
                      {Math.round(session.accuracy * 100)}% accuracy in {formatDuration(session.timeTaken)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink">{session.score.toLocaleString()}</p>
                    <p className="text-xs text-ink-faint">{session.generatedLevels} generated</p>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !error && !featuredSkill ? (
        <p className="text-sm text-ink-muted">Play a few adaptive runs to start building persistent skill history.</p>
      ) : null}
    </div>
  );
}
