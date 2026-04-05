import type { PropsWithChildren } from "react";

interface ModalProps {
  title?: string;
  open: boolean;
  onClose: () => void;
}

export function Modal({ title, open, onClose, children }: PropsWithChildren<ModalProps>) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="font-display font-bold text-lg text-ink">{title}</h2>
            <button
              type="button"
              className="w-8 h-8 rounded-lg text-ink-muted hover:bg-gray-100 transition-colors flex items-center justify-center text-xl"
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
