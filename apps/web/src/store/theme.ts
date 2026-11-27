import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  seasonalTheme,
  THEME_MAP,
  type Theme,
  type ThemeId,
} from '../lib/themes';

interface ThemeState {
  themeId: ThemeId;
  mode: 'auto' | 'manual';
  accent: string;
  wallpaper: string;
  particles: boolean;
  unlocked: ThemeId[];
  xp: number;

  setTheme: (id: ThemeId) => void;
  setMode: (mode: 'auto' | 'manual') => void;
  setAccent: (accent: string) => void;
  setWallpaper: (wallpaper: string) => void;
  setParticles: (enabled: boolean) => void;
  unlock: (id: ThemeId) => boolean;
  addXp: (amount: number) => void;
}

const FREE: ThemeId[] = ['default', 'vice', 'newyear', 'halloween'];

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      themeId: 'default',
      mode: 'auto',
      accent: '',
      wallpaper: '',
      particles: true,
      unlocked: FREE,
      xp: 250,

      setTheme: (id) => {
        if (!get().unlocked.includes(id)) return;
        set({ themeId: id, mode: 'manual' });
      },
      setMode: (mode) => set({ mode }),
      setAccent: (accent) => set({ accent }),
      setWallpaper: (wallpaper) => set({ wallpaper }),
      setParticles: (particles) => set({ particles }),

      unlock: (id) => {
        const state = get();
        if (state.unlocked.includes(id)) {
          set({ themeId: id, mode: 'manual' });
          return true;
        }
        const theme = THEME_MAP[id];
        if (!theme || state.xp < theme.price) return false;
        set({
          unlocked: [...state.unlocked, id],
          xp: state.xp - theme.price,
          themeId: id,
          mode: 'manual',
        });
        return true;
      },

      addXp: (amount) => set({ xp: Math.max(0, get().xp + Math.round(amount)) }),
    }),
    {
      name: 'mm-theme',
      partialize: (state) => ({
        themeId: state.themeId,
        mode: state.mode,
        accent: state.accent,
        wallpaper: state.wallpaper,
        particles: state.particles,
        unlocked: state.unlocked,
        xp: state.xp,
      }),
    },
  ),
);

export function activeThemeId(
  themeId: ThemeId,
  mode: 'auto' | 'manual',
  date = new Date(),
): ThemeId {
  if (mode === 'manual') return themeId;
  return seasonalTheme(date) ?? 'default';
}

export function useActiveTheme(): Theme {
  const themeId = useTheme((state) => state.themeId);
  const mode = useTheme((state) => state.mode);
  return THEME_MAP[activeThemeId(themeId, mode)];
}
