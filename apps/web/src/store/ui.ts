import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}

interface UiState {
  toasts: Toast[];
  pushToast: (text: string, tone?: ToastTone) => void;
  dismissToast: (id: number) => void;
  installPrompt: (() => Promise<void>) | null;
  setInstallPrompt: (handler: (() => Promise<void>) | null) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  eqOpen: boolean;
  setEqOpen: (open: boolean) => void;
}

let toastId = 0;

export const useUi = create<UiState>((set, get) => ({
  toasts: [],
  pushToast: (text, tone = 'info') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-2), { id, text, tone }] });
    window.setTimeout(() => get().dismissToast(id), 3800);
  },
  dismissToast: (id) =>
    set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
  installPrompt: null,
  setInstallPrompt: (handler) => set({ installPrompt: handler }),
  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open }),
  eqOpen: false,
  setEqOpen: (open) => set({ eqOpen: open }),
}));
