import { create } from 'zustand';

interface ToastOptions { actionLabel?: string; onAction?: () => void }
export interface ToastItem { id: number; message: string; actionLabel?: string; onAction?: () => void }
interface ToastState {
  toasts: ToastItem[];
  show: (message: string, options?: ToastOptions) => void;
  hide: (id: number) => void;
}

const MAX_VISIBLE_TOASTS = 4;
let nextId = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (message, options) => set((state) => ({
    toasts: [...state.toasts, { id: ++nextId, message, actionLabel: options?.actionLabel, onAction: options?.onAction }].slice(-MAX_VISIBLE_TOASTS),
  })),
  hide: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
