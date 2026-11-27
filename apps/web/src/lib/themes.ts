export type ThemeId =
  | 'default'
  | 'vice'
  | 'newyear'
  | 'halloween'
  | 'cyberpunk'
  | 'minecraft'
  | 'cs2'
  | 'ussr'
  | 'sakura';

export type ParticleKind = 'snow' | 'petals' | 'neon' | 'fog' | 'blocks' | 'none';

export interface ThemeColors {
  bg: string;
  bg1: string;
  bg2: string;
  panel: string;
  panelStrong: string;
  line: string;
  lineStrong: string;
  text: string;
  muted: string;
  muted2: string;
  violet: string;
  fuchsia: string;
  cyan: string;
  lime: string;
  danger: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  tagline: string;
  price: number;
  gradient: string;
  colors: ThemeColors;
  atmosphere: string;
  particle: ParticleKind;
  font?: string;
  seasonal?: boolean;
}

export const THEMES: Theme[] = [
  {
    id: 'default',
    name: 'Maximize',
    tagline: 'Фирменный тёмный стиль',
    price: 0,
    gradient: 'linear-gradient(120deg, #8b5cf6 0%, #d946ef 48%, #22d3ee 100%)',
    colors: {
      bg: '#06060a',
      bg1: '#0a0a11',
      bg2: '#10101a',
      panel: 'rgba(255,255,255,0.035)',
      panelStrong: 'rgba(255,255,255,0.06)',
      line: 'rgba(255,255,255,0.075)',
      lineStrong: 'rgba(255,255,255,0.14)',
      text: '#f5f4fb',
      muted: '#a09db2',
      muted2: '#74718a',
      violet: '#8b5cf6',
      fuchsia: '#d946ef',
      cyan: '#22d3ee',
      lime: '#b8f24a',
      danger: '#fb7185',
    },
    atmosphere:
      'radial-gradient(900px 520px at 8% -12%, rgba(139,92,246,0.22), transparent 62%), radial-gradient(760px 460px at 96% -6%, rgba(34,211,238,0.12), transparent 60%), radial-gradient(900px 620px at 50% 118%, rgba(217,70,239,0.12), transparent 62%)',
    particle: 'none',
  },
  {
    id: 'vice',
    name: 'Vice Neon',
    tagline: 'Закат, пальмы и неон в духе GTA',
    price: 0,
    gradient: 'linear-gradient(120deg, #ff2e88 0%, #ff8a3d 52%, #35e0ff 100%)',
    colors: {
      bg: '#07040f',
      bg1: '#100720',
      bg2: '#1a0b2f',
      panel: 'rgba(255,46,136,0.07)',
      panelStrong: 'rgba(53,224,255,0.11)',
      line: 'rgba(255,86,171,0.18)',
      lineStrong: 'rgba(53,224,255,0.32)',
      text: '#fff2fb',
      muted: '#d0a7c9',
      muted2: '#9c739b',
      violet: '#ff2e88',
      fuchsia: '#ff8a3d',
      cyan: '#35e0ff',
      lime: '#b8f24a',
      danger: '#ff4d6d',
    },
    atmosphere:
      'radial-gradient(800px 500px at 12% 0%, rgba(255,46,136,0.35), transparent 60%), radial-gradient(900px 520px at 92% 10%, rgba(53,224,255,0.22), transparent 62%), linear-gradient(180deg, rgba(255,138,61,0.08), transparent 45%)',
    particle: 'neon',
  },
  {
    id: 'newyear',
    name: 'New Year',
    tagline: 'Снег, гирлянды и обратный отсчёт',
    price: 0,
    gradient: 'linear-gradient(120deg, #ff4d6d 0%, #ffd166 52%, #9be7ff 100%)',
    colors: {
      bg: '#030a14',
      bg1: '#061426',
      bg2: '#0a2038',
      panel: 'rgba(155,231,255,0.06)',
      panelStrong: 'rgba(255,209,102,0.1)',
      line: 'rgba(155,231,255,0.16)',
      lineStrong: 'rgba(255,209,102,0.3)',
      text: '#f4fbff',
      muted: '#a8c6db',
      muted2: '#7c9bb3',
      violet: '#4cc9f0',
      fuchsia: '#ff4d6d',
      cyan: '#9be7ff',
      lime: '#d9f99d',
      danger: '#ff6b6b',
    },
    atmosphere:
      'radial-gradient(760px 480px at 10% -10%, rgba(76,201,240,0.26), transparent 62%), radial-gradient(700px 460px at 92% 4%, rgba(255,77,109,0.18), transparent 60%), radial-gradient(900px 600px at 50% 120%, rgba(255,209,102,0.1), transparent 65%)',
    particle: 'snow',
    seasonal: true,
  },
  {
    id: 'halloween',
    name: 'Halloween',
    tagline: 'Тыквы, туман и летучие мыши',
    price: 0,
    gradient: 'linear-gradient(120deg, #ff7a18 0%, #a855f7 55%, #7cf5d5 100%)',
    colors: {
      bg: '#080503',
      bg1: '#120a06',
      bg2: '#1d1008',
      panel: 'rgba(255,122,24,0.07)',
      panelStrong: 'rgba(168,85,247,0.12)',
      line: 'rgba(255,122,24,0.18)',
      lineStrong: 'rgba(168,85,247,0.32)',
      text: '#fff2e8',
      muted: '#d4b39d',
      muted2: '#9c7b66',
      violet: '#ff7a18',
      fuchsia: '#a855f7',
      cyan: '#7cf5d5',
      lime: '#b8f24a',
      danger: '#f43f5e',
    },
    atmosphere:
      'radial-gradient(800px 520px at 10% -8%, rgba(255,122,24,0.24), transparent 60%), radial-gradient(760px 500px at 92% 8%, rgba(168,85,247,0.18), transparent 62%), linear-gradient(180deg, transparent, rgba(124,245,213,0.05))',
    particle: 'fog',
    seasonal: true,
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    tagline: 'Жёлтый неон и глитч',
    price: 180,
    gradient: 'linear-gradient(120deg, #fcee0a 0%, #00f0ff 55%, #ff2a6d 100%)',
    colors: {
      bg: '#040406',
      bg1: '#09090d',
      bg2: '#101016',
      panel: 'rgba(252,238,10,0.06)',
      panelStrong: 'rgba(0,240,255,0.1)',
      line: 'rgba(252,238,10,0.16)',
      lineStrong: 'rgba(0,240,255,0.3)',
      text: '#f5ff00',
      muted: '#b7c9c9',
      muted2: '#7e9393',
      violet: '#fcee0a',
      fuchsia: '#ff2a6d',
      cyan: '#00f0ff',
      lime: '#d4ff00',
      danger: '#ff2a6d',
    },
    atmosphere:
      'linear-gradient(180deg, rgba(252,238,10,0.08), transparent 32%), radial-gradient(900px 500px at 92% 0%, rgba(0,240,255,0.18), transparent 62%), radial-gradient(800px 600px at 0% 100%, rgba(255,42,109,0.16), transparent 62%)',
    particle: 'none',
  },
  {
    id: 'minecraft',
    name: 'Minecraft',
    tagline: 'Пиксели, блоки и трава',
    price: 220,
    gradient: 'linear-gradient(120deg, #7cbd4b 0%, #59c2ff 55%, #8b5a2b 100%)',
    colors: {
      bg: '#0b0906',
      bg1: '#141009',
      bg2: '#1c160d',
      panel: 'rgba(124,189,75,0.08)',
      panelStrong: 'rgba(139,90,43,0.16)',
      line: 'rgba(124,189,75,0.2)',
      lineStrong: 'rgba(89,194,255,0.3)',
      text: '#f1f7e8',
      muted: '#b7c9a6',
      muted2: '#7f9170',
      violet: '#7cbd4b',
      fuchsia: '#8b5a2b',
      cyan: '#59c2ff',
      lime: '#b8f24a',
      danger: '#ff5555',
    },
    atmosphere:
      'linear-gradient(180deg, rgba(89,194,255,0.12), transparent 40%), radial-gradient(800px 500px at 10% 100%, rgba(124,189,75,0.18), transparent 60%)',
    particle: 'blocks',
    font: "'Courier New', monospace",
  },
  {
    id: 'cs2',
    name: 'CS2',
    tagline: 'Тактический тёмный и оранжевый',
    price: 260,
    gradient: 'linear-gradient(120deg, #f59e0b 0%, #22d3ee 55%, #f97316 100%)',
    colors: {
      bg: '#06090b',
      bg1: '#0a1014',
      bg2: '#101820',
      panel: 'rgba(245,158,11,0.06)',
      panelStrong: 'rgba(34,211,238,0.08)',
      line: 'rgba(245,158,11,0.16)',
      lineStrong: 'rgba(34,211,238,0.26)',
      text: '#eaf2f6',
      muted: '#9fb1bd',
      muted2: '#6c7f8b',
      violet: '#f59e0b',
      fuchsia: '#f97316',
      cyan: '#22d3ee',
      lime: '#a3e635',
      danger: '#ef4444',
    },
    atmosphere:
      'radial-gradient(800px 480px at 8% -10%, rgba(245,158,11,0.18), transparent 60%), radial-gradient(760px 500px at 94% 6%, rgba(34,211,238,0.14), transparent 62%)',
    particle: 'none',
  },
  {
    id: 'ussr',
    name: 'USSR Retro',
    tagline: 'Плакаты, красный и бежевый',
    price: 300,
    gradient: 'linear-gradient(120deg, #d62828 0%, #e9c46a 55%, #f4a261 100%)',
    colors: {
      bg: '#160c08',
      bg1: '#21120b',
      bg2: '#2d190f',
      panel: 'rgba(233,196,106,0.07)',
      panelStrong: 'rgba(214,40,40,0.12)',
      line: 'rgba(233,196,106,0.18)',
      lineStrong: 'rgba(214,40,40,0.32)',
      text: '#f6ead7',
      muted: '#cbb496',
      muted2: '#9a8266',
      violet: '#d62828',
      fuchsia: '#e9c46a',
      cyan: '#f4a261',
      lime: '#b8f24a',
      danger: '#d62828',
    },
    atmosphere:
      'radial-gradient(800px 520px at 6% -8%, rgba(214,40,40,0.26), transparent 62%), radial-gradient(760px 480px at 94% 4%, rgba(233,196,106,0.16), transparent 60%)',
    particle: 'none',
    font: "Georgia, 'Times New Roman', serif",
  },
  {
    id: 'sakura',
    name: 'Sakura Anime',
    tagline: 'Сакура, лепестки и пастель',
    price: 200,
    gradient: 'linear-gradient(120deg, #ff8fb8 0%, #ffc2d1 52%, #c084fc 100%)',
    colors: {
      bg: '#0f0610',
      bg1: '#1a0a18',
      bg2: '#250f22',
      panel: 'rgba(255,143,184,0.07)',
      panelStrong: 'rgba(192,132,252,0.1)',
      line: 'rgba(255,143,184,0.18)',
      lineStrong: 'rgba(192,132,252,0.3)',
      text: '#fff0f6',
      muted: '#d8aec2',
      muted2: '#a87f96',
      violet: '#ff8fb8',
      fuchsia: '#c084fc',
      cyan: '#ffc2d1',
      lime: '#f9a8d4',
      danger: '#fb7185',
    },
    atmosphere:
      'radial-gradient(800px 520px at 10% -10%, rgba(255,143,184,0.24), transparent 60%), radial-gradient(760px 500px at 92% 6%, rgba(192,132,252,0.18), transparent 62%), linear-gradient(180deg, transparent, rgba(255,194,209,0.05))',
    particle: 'petals',
  },
];

export const THEME_MAP: Record<ThemeId, Theme> = Object.fromEntries(
  THEMES.map((theme) => [theme.id, theme]),
) as Record<ThemeId, Theme>;

export function seasonalTheme(date = new Date()): ThemeId | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month === 12 && day >= 20) || (month === 1 && day <= 14)) return 'newyear';
  if ((month === 10 && day >= 25) || (month === 11 && day <= 3)) return 'halloween';
  return null;
}

function rgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  if (value.length !== 6) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function backgroundImage(url: string): string {
  const safe = url.replace(/"/g, '\\"');
  return `linear-gradient(180deg, rgba(4,4,8,0.62), rgba(4,4,8,0.82)), url("${safe}")`;
}

/** Применяет тему к документу: CSS-переменные, фон, шрифт. */
export function applyTheme(theme: Theme, accent = '', wallpaper = ''): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const colors = { ...theme.colors };

  if (/^#[0-9a-fA-F]{6}$/.test(accent)) {
    colors.violet = accent;
    colors.fuchsia = accent;
    colors.lineStrong = rgba(accent, 0.34);
    colors.panelStrong = rgba(accent, 0.12);
  }

  root.dataset.theme = theme.id;
  root.style.setProperty('--bg', colors.bg);
  root.style.setProperty('--bg-1', colors.bg1);
  root.style.setProperty('--bg-2', colors.bg2);
  root.style.setProperty('--panel', colors.panel);
  root.style.setProperty('--panel-strong', colors.panelStrong);
  root.style.setProperty('--line', colors.line);
  root.style.setProperty('--line-strong', colors.lineStrong);
  root.style.setProperty('--text', colors.text);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-2', colors.muted2);
  root.style.setProperty('--violet', colors.violet);
  root.style.setProperty('--fuchsia', colors.fuchsia);
  root.style.setProperty('--cyan', colors.cyan);
  root.style.setProperty('--lime', colors.lime);
  root.style.setProperty('--danger', colors.danger);
  root.style.setProperty(
    '--grad',
    accent
      ? `linear-gradient(120deg, ${accent} 0%, ${colors.fuchsia} 48%, ${colors.cyan} 100%)`
      : theme.gradient,
  );
  root.style.setProperty(
    '--grad-soft',
    `linear-gradient(135deg, ${rgba(colors.violet, 0.24)}, ${rgba(colors.cyan, 0.08)})`,
  );
  root.style.setProperty('--atmosphere', theme.atmosphere);
  root.style.setProperty(
    '--font-display',
    theme.font ?? "'Unbounded Variable', 'Unbounded', system-ui, sans-serif",
  );

  if (wallpaper) {
    root.style.setProperty('--wallpaper-image', backgroundImage(wallpaper));
    root.classList.add('has-wallpaper');
  } else {
    root.style.removeProperty('--wallpaper-image');
    root.classList.remove('has-wallpaper');
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', colors.bg);
}
