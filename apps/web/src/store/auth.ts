import { create } from 'zustand';
import { api, clearSession, getToken, setSessionTokens } from '../lib/api';
import type { User } from '../types';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: User | null;
  ready: boolean;
  init: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  setUser: (user: User) => void;
  logout: () => void;
  logoutAll: () => Promise<void>;
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

  setSession: ({ accessToken, refreshToken, user }) => {
    setSessionTokens(accessToken, refreshToken);
    set({ user, ready: true });
  },

  setUser: (user) => set({ user }),

  logout: () => {
    void api.logout();
    clearSession();
    set({ user: null });
  },

  logoutAll: async () => {
    try {
      await api.logoutAll();
    } catch {
      // даже если сервер недоступен — локально выходим
    }
    clearSession();
    set({ user: null });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('mm:unauthorized', () => {
    useAuth.setState({ user: null });
  });
}
