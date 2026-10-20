import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'> & { id?: string }) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = toast.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const duration = toast.duration ?? 5000;

    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, duration }],
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }

    return id;
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}));

export const toast = {
  info: (message: string, options?: { title?: string; duration?: number }) =>
    useToastStore.getState().addToast({ type: 'info', message, ...options }),
  success: (message: string, options?: { title?: string; duration?: number }) =>
    useToastStore.getState().addToast({ type: 'success', message, ...options }),
  error: (message: string, options?: { title?: string; duration?: number }) =>
    useToastStore.getState().addToast({ type: 'error', message, ...options }),
  warning: (message: string, options?: { title?: string; duration?: number }) =>
    useToastStore.getState().addToast({ type: 'warning', message, ...options }),
};
