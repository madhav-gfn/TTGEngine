import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/store/gameStore";
import { useGameActions } from "@/core/GameLifecycleContext";
import type { GameSummary } from "@/core/types";

const GAME_TYPE_COLORS: Record<string, string> = {
  MCQ: "bg-purple-100 text-purple-700",
  WORD: "bg-blue-100 text-blue-700",
  GRID: "bg-teal-100 text-teal-700",
  DRAG_DROP: "bg-orange-100 text-orange-700",
  BOARD: "bg-pink-100 text-pink-700",
  CUSTOM: "bg-gray-100 text-gray-700",
};

const FILTER_OPTIONS = [
  { key: "all", label: "All Games" },
  { key: "MCQ", label: "Quizzes" },
  { key: "WORD", label: "Word" },
  { key: "GRID", label: "Grid" },
  { key: "DRAG_DROP", label: "Drag & Drop" },
  { key: "BOARD", label: "Board" },
];

function DifficultyBadge({ difficulty }: { difficulty?: string }) {
  if (!difficulty) return null;
  const cls =
    difficulty === "easy"
      ? "badge-easy"
      : difficulty === "hard"
        ? "badge-hard"
        : "badge-medium";
  return <span className={cls}>{difficulty}</span>;
}

function GameCard({ game, onSelect }: { game: GameSummary; onSelect: () => void }) {
  const typeColor = GAME_TYPE_COLORS[game.gameType] ?? GAME_TYPE_COLORS.CUSTOM;

  return (
    <article
      className="bg-white rounded-2xl border border-gray-100 shadow-card p-5
                 flex flex-col gap-4 transition-all duration-200
                 hover:shadow-card-hover hover:-translate-y-1 cursor-pointer group"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      {/* Game type icon area */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold ${typeColor}`}>
        {game.gameType === "MCQ" ? "?" : game.gameType === "WORD" ? "A" : game.gameType === "GRID" ? "#" : game.gameType === "DRAG_DROP" ? "↕" : "◉"}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-display font-bold text-ink text-base leading-tight line-clamp-2">{game.title}</h3>
          <DifficultyBadge difficulty={game.difficulty} />
        </div>
        <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">{game.description}</p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${typeColor}`}>
            {game.gameType.replace("_", " ")}
          </span>
          {game.estimatedPlayTime ? (
            <span className="text-[10px] text-ink-faint font-medium">{game.estimatedPlayTime}m</span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn-primary btn-sm shrink-0 group-hover:bg-teal-800"
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          Play
        </button>
      </div>
    </article>
  );
}

function HeroCard({ game, onSelect }: { game: GameSummary; onSelect: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-800 to-teal-900 p-8 text-white shadow-card-lg">
      {/* Decorative circles */}
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/5" />
      <div className="absolute -bottom-16 -right-4 w-64 h-64 rounded-full bg-teal-600/30" />

      <div className="relative z-10 max-w-xl">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
            ⭐ Featured Game
          </span>
          <DifficultyBadge difficulty={game.difficulty} />
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3 leading-tight">{game.title}</h2>
        <p className="text-teal-100 text-sm leading-relaxed mb-6 max-w-md">{game.description}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={onSelect}
            className="px-6 py-3 bg-white text-teal-800 rounded-full font-bold text-sm
                       hover:bg-teal-50 transition-colors shadow-lg active:scale-95"
          >
            Play Now →
          </button>
          {game.estimatedPlayTime ? (
            <span className="text-sm text-teal-200">~{game.estimatedPlayTime} min</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ backendMessage }: { backendMessage: string }) {
  return (
    <div className="empty-state">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl mb-4">
        🎮
      </div>
      <h3 className="font-display font-bold text-ink text-lg mb-2">No games found</h3>
      <p className="text-sm text-ink-muted max-w-xs">
        {backendMessage.toLowerCase().includes("offline")
          ? "The backend is offline. Check your server and refresh."
          : "No game configurations were loaded. Check the JSON configs or backend API."}
      </p>
      <p className="text-xs text-ink-faint mt-3 font-mono bg-gray-100 px-3 py-1 rounded-lg">{backendMessage}</p>
    </div>
  );
}

export function PlayerHub() {
  const availableGames = useGameStore((s) => s.availableGames);
  const backendStatus = useGameStore((s) => s.backendStatus);
  const lifecycleState = useGameStore((s) => s.lifecycleState);
  const { selectGame } = useGameActions();
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("all");
  const [isSelecting, setIsSelecting] = useState(false);

  const featuredGame = availableGames[0] ?? null;

  const filtered =
    activeFilter === "all"
      ? availableGames
      : availableGames.filter((g) => g.gameType === activeFilter);

  async function handleSelect(gameId: string) {
    if (isSelecting || lifecycleState === "LOADING") return;
    setIsSelecting(true);
    try {
      await selectGame(gameId);
      navigate(`/game/${gameId}`);
    } finally {
      setIsSelecting(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* ── Hero section ── */}
      {featuredGame ? (
        <HeroCard game={featuredGame} onSelect={() => void handleSelect(featuredGame.gameId)} />
      ) : null}

      {/* ── Content split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

        {/* Left: Game Grid */}
        <div className="space-y-5">
          {/* Header + filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display font-bold text-xl text-ink">
                Game Library
                {availableGames.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-ink-muted">
                    {availableGames.length} available
                  </span>
                )}
              </h2>
            </div>
            {/* Filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_OPTIONS.filter(
                (opt) => opt.key === "all" || availableGames.some((g) => g.gameType === opt.key)
              ).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`filter-pill ${activeFilter === opt.key ? "active" : ""}`}
                  onClick={() => setActiveFilter(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading state */}
          {backendStatus.state === "checking" && availableGames.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState backendMessage={backendStatus.message} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((game) => (
                <GameCard
                  key={game.gameId}
                  game={game}
                  onSelect={() => void handleSelect(game.gameId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Leaderboard sidebar */}
        <aside className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-ink">🏆 Top Players</h3>
              <span className="text-xs text-ink-faint">Global</span>
            </div>
            <PlaceholderLeaderboard />
          </div>

          {/* Quick Stats (cosmetic) */}
          <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-2xl border border-teal-200 p-5">
            <p className="eyebrow mb-3">Platform Stats</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-ink-muted">Total Games</span>
                <span className="text-sm font-bold text-ink">{availableGames.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-ink-muted">Backend</span>
                <span className={`text-xs font-semibold capitalize ${backendStatus.state === "online" ? "text-green-600" : backendStatus.state === "offline" ? "text-red-500" : "text-amber-600"}`}>
                  {backendStatus.state}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Selection overlay */}
      {isSelecting && (
        <div className="fixed inset-0 z-50 bg-white/60 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-ink-muted">Loading game…</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cosmetic leaderboard shown on the hub */
function PlaceholderLeaderboard() {
  const entries = [
    { rank: 1, name: "AlexM", score: "5,200" },
    { rank: 2, name: "Priya_S", score: "4,850" },
    { rank: 3, name: "RK_Boss", score: "4,400" },
    { rank: 4, name: "CodeLion", score: "4,100" },
    { rank: 5, name: "GamePlay3r", score: "3,900" },
  ];

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div
          key={e.rank}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
            e.rank === 1 ? "bg-amber-50 border border-amber-200" : "hover:bg-gray-50"
          }`}
        >
          <span className="text-base w-5 shrink-0 text-center">
            {medals[e.rank - 1] ?? <span className="font-bold text-ink-faint text-xs">#{e.rank}</span>}
          </span>
          <span className="flex-1 font-medium text-ink truncate">{e.name}</span>
          <span className="font-bold text-teal-700 tabular-nums">{e.score}</span>
        </div>
      ))}
      <p className="text-[10px] text-ink-faint text-center pt-1">Your rank: —</p>
    </div>
  );
}
