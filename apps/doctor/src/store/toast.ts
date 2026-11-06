import { create } from 'zustand';

interface ToastOptions { actionLabel?: string; onAction?: () => void }
interface ToastState {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
  show: (message: string, options?: ToastOptions) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  actionLabel: undefined,
  onAction: undefined,
  show: (message, options) => set({ message, actionLabel: options?.actionLabel, onAction: options?.onAction }),
  hide: () => set({ message: null, actionLabel: undefined, onAction: undefined }),
}));
