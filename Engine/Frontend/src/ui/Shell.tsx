import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useGameLifecycle } from "@/hooks/useGameLifecycle";
import { useGameStore } from "@/store/gameStore";
import { GameLifecycleContext } from "@/core/GameLifecycleContext";
import { Toast } from "./shared/Toast";

export function Shell() {
  const actions = useGameLifecycle();
  const backendStatus = useGameStore((s) => s.backendStatus);
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = location.pathname.startsWith("/admin");

  function handleAdminToggle() {
    if (isAdmin) {
      navigate("/");
    } else {
      navigate("/admin");
    }
  }

  return (
    <GameLifecycleContext.Provider value={actions}>
      <div className="min-h-screen bg-surface-muted flex flex-col">
        {/* ── Top Navigation ── */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
            {/* Logo */}
            <NavLink to="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center shadow-sm">
                <span className="text-white font-black text-[10px]">T²</span>
              </div>
              <span className="font-display font-bold text-sm text-ink tracking-tight">
                TaPTaP <span className="text-teal-700">Engine</span>
              </span>
            </NavLink>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              {/* Backend status indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    backendStatus.state === "online"
                      ? "bg-green-500"
                      : backendStatus.state === "offline"
                        ? "bg-red-400"
                        : "bg-amber-400 animate-pulse"
                  }`}
                />
                <span className="text-[10px] font-semibold text-ink-muted capitalize">
                  {backendStatus.state === "checking" ? "Connecting" : backendStatus.state}
                </span>
              </div>

              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-teal-50 text-teal-700"
                      : "text-ink-muted hover:text-ink hover:bg-gray-100"
                  }`
                }
              >
                Game Hub
              </NavLink>

              <button
                type="button"
                onClick={handleAdminToggle}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  isAdmin
                    ? "bg-teal-50 text-teal-700"
                    : "text-ink-muted hover:text-ink hover:bg-gray-100"
                }`}
              >
                {isAdmin ? "← Player View" : "Admin"}
              </button>

              {/* Profile avatar */}
              <div
                className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-teal-700 flex items-center justify-center text-white text-[10px] font-bold cursor-pointer select-none"
                title="Player profile"
              >
                P
              </div>
            </div>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main className="flex-1 w-full">
          <Outlet />
        </main>

        {/* ── Global Toast Notifications ── */}
        <Toast />
      </div>
    </GameLifecycleContext.Provider>
  );
}
