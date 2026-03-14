import type { PropsWithChildren } from "react";

interface ModalProps extends PropsWithChildren {
  open: boolean;
  title: string;
  onClose: () => void;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="button button-ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
