import { ErrorBoundary } from "@/ui/ErrorBoundary";
import { Shell } from "@/ui/Shell";

export default function App() {
  return (
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  );
}
