import { useEffect, useState } from 'react';
import {
  activeThemeId,
  useActiveTheme,
  useTheme,
} from '../store/theme';
import { applyTheme, THEME_MAP } from '../lib/themes';

/** Применяет тему и следит за автосезонностью. */
export function ThemeRuntime() {
  const themeId = useTheme((state) => state.themeId);
  const mode = useTheme((state) => state.mode);
  const accent = useTheme((state) => state.accent);
  const wallpaper = useTheme((state) => state.wallpaper);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const resolved = activeThemeId(themeId, mode, now);
  const theme = THEME_MAP[resolved];

  useEffect(() => {
    applyTheme(theme, accent, wallpaper);
  }, [theme, accent, wallpaper]);

  return null;
}

const PARTICLE_COUNT = 34;

export function ThemeParticles() {
  const theme = useActiveTheme();
  const enabled = useTheme((state) => state.particles);
  const kind = theme.particle;

  const dots = useState(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      left: (index * 37 + 11) % 100,
      delay: -((index * 0.73) % 14),
      duration: 7 + (index % 8) * 1.7,
      size: 3 + (index % 4) * 2,
      drift: -30 + ((index * 17) % 60),
    })),
  )[0];

  if (!enabled || kind === 'none') return null;

  return (
    <div className={`theme-particles theme-particles-${kind}`} aria-hidden="true">
      {dots.map((dot, index) => (
        <span
          key={index}
          style={{
            left: `${dot.left}%`,
            animationDelay: `${dot.delay}s`,
            animationDuration: `${dot.duration}s`,
            width: `${dot.size}px`,
            height: `${kind === 'neon' ? dot.size * 6 : dot.size}px`,
            ['--drift' as string]: `${dot.drift}px`,
          }}
        />
      ))}
    </div>
  );
}
