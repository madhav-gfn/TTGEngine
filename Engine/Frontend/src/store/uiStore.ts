import { create } from "zustand";

export type ToastLevel = "info" | "success" | "error";

export interface ToastMessage {
  id: string;
  message: string;
  level: ToastLevel;
}

type UIStore = {
  toasts: ToastMessage[];
  pushToast: (message: string, level?: ToastLevel) => void;
  dismissToast: (id: string) => void;
};

export const useUIStore = create<UIStore>((set) => ({
  toasts: [],
  pushToast: (message, level = "info") =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, message, level },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}));
