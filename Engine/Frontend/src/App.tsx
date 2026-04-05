import { Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { Shell } from "@/ui/Shell";
import { PlayerHub } from "@/ui/PlayerHub";
import { GamePage } from "@/ui/GamePage";
import { AdminDashboard } from "@/ui/AdminDashboard";

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<PlayerHub />} />
          <Route path="game/:gameId" element={<GamePage />} />
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
