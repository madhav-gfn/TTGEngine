import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";

export function Toast() {
  const toasts = useUIStore((state) => state.toasts);
  const dismissToast = useUIStore((state) => state.dismissToast);

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        dismissToast(toast.id);
      }, 3500),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [dismissToast, toasts]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card toast-${toast.level}`}>
          <span>{toast.message}</span>
          <button className="button button-ghost" type="button" onClick={() => dismissToast(toast.id)}>
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
