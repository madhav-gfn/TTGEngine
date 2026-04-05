import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Engine boundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-surface-muted">
          <div className="text-center max-w-sm space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-3xl mx-auto">💥</div>
            <h2 className="font-display font-bold text-xl text-ink">Renderer Crashed</h2>
            <p className="text-sm text-ink-muted">The engine caught a runtime error before it could break the shell.</p>
            {this.state.errorMessage && (
              <code className="block text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 font-mono">
                {this.state.errorMessage}
              </code>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => this.setState({ hasError: false })}
            >
              Try to Recover
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
