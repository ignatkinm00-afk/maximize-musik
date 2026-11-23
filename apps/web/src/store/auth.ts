import { create } from 'zustand';
import { api, getToken, setToken } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  ready: boolean;
  init: () => Promise<void>;
  setSession: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,

  init: async () => {
    if (!getToken()) {
      set({ ready: true });
      return;
    }
    try {
      const { user } = await api.me();
      set({ user, ready: true });
    } catch {
      set({ user: null, ready: true });
    }
  },

  setSession: (token, user) => {
    setToken(token);
    set({ user, ready: true });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    setToken('');
    set({ user: null });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('mm:unauthorized', () => {
    useAuth.setState({ user: null });
  });
}
