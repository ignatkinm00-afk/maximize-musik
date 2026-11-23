import { create } from 'zustand';
import { api } from '../lib/api';

interface NotificationsState {
  unread: number;
  refresh: () => Promise<void>;
  setUnread: (value: number) => void;
}

export const useNotifications = create<NotificationsState>((set) => ({
  unread: 0,
  refresh: async () => {
    try {
      const { count } = await api.unreadCount();
      set({ unread: count });
    } catch {
      // неавторизован — просто нет бейджа
    }
  },
  setUnread: (value) => set({ unread: Math.max(0, value) }),
}));
