import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

export function Toast() {
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 3500),
    );

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [dismissToast, toasts]);

  if (toasts.length === 0) return null;

  const levelIcon = (level: string) => {
    if (level === "success") return "✅";
    if (level === "error") return "❌";
    if (level === "warning") return "⚠️";
    return "ℹ️";
  };

  return (
    <div
      aria-live="polite"
      className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 w-[min(360px,calc(100vw-32px))]"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.level}`}>
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0">{levelIcon(toast.level)}</span>
            <span className="text-sm text-ink leading-snug">{toast.message}</span>
          </div>
          <button
            type="button"
            className="text-ink-faint hover:text-ink shrink-0 text-lg leading-none px-1"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
