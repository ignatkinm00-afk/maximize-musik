import { motion } from 'framer-motion';
import {
  Check,
  ImagePlus,
  Lock,
  Palette,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useState } from 'react';
import { seasonalTheme, THEMES, type Theme } from '../lib/themes';
import { useActiveTheme, useTheme } from '../store/theme';
import { useUi } from '../store/ui';
import { Modal } from '../components/ui';

export function ThemesPage() {
  const active = useActiveTheme();
  const themeId = useTheme((state) => state.themeId);
  const mode = useTheme((state) => state.mode);
  const accent = useTheme((state) => state.accent);
  const wallpaper = useTheme((state) => state.wallpaper);
  const particles = useTheme((state) => state.particles);
  const unlocked = useTheme((state) => state.unlocked);
  const xp = useTheme((state) => state.xp);
  const setTheme = useTheme((state) => state.setTheme);
  const setMode = useTheme((state) => state.setMode);
  const setAccent = useTheme((state) => state.setAccent);
  const setWallpaper = useTheme((state) => state.setWallpaper);
  const setParticles = useTheme((state) => state.setParticles);
  const unlock = useTheme((state) => state.unlock);
  const pushToast = useUi((state) => state.pushToast);

  const [preview, setPreview] = useState<Theme | null>(null);
  const [wallpaperBusy, setWallpaperBusy] = useState(false);

  const isUnlocked = (theme: Theme) => unlocked.includes(theme.id) || theme.price === 0;

  const apply = (theme: Theme) => {
    if (!isUnlocked(theme)) {
      if (!unlock(theme.id)) {
        pushToast(`Не хватает ${theme.price - xp} XP. Слушай музыку, чтобы открыть тему.`, 'error');
        return;
      }
      pushToast(`Тема «${theme.name}» открыта`, 'success');
    } else {
      setTheme(theme.id);
    }
    setPreview(null);
  };

  const pickWallpaper = async (file: File | null) => {
    if (!file) return;
    if (file.size > 1.6 * 1024 * 1024) {
      pushToast('Картинка должна быть меньше 1.5 МБ', 'error');
      return;
    }
    setWallpaperBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setWallpaper(String(reader.result ?? ''));
      pushToast('Обои обновлены', 'success');
      setWallpaperBusy(false);
    };
    reader.onerror = () => {
      pushToast('Не удалось прочитать картинку', 'error');
      setWallpaperBusy(false);
    };
    reader.readAsDataURL(file);
  };

  const seasonal = seasonalTheme();

  return (
    <div className="page themes-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Palette size={14} /> оформление
          </p>
          <h1>Темы и стиль</h1>
          <p className="page-subtitle">
            8 тем, автосезонность, анимированные фоны и свой акцент. Всё сохраняется на
            устройстве.
          </p>
        </div>
        <div className="theme-xp">
          <Sparkles size={16} />
          <strong>{xp} XP</strong>
        </div>
      </header>

      <section className="theme-mode">
        <div>
          <strong>Как выбирать тему</strong>
          <p className="hint">
            {mode === 'auto'
              ? `Авто: сейчас действует «${
                  seasonal ? THEMES.find((item) => item.id === seasonal)?.name : 'Maximize'
                }»`
              : `Вручную: «${active.name}»`}
          </p>
        </div>
        <div className="segmented">
          <button className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>
            <Wand2 size={15} /> Авто
          </button>
          <button
            className={mode === 'manual' ? 'active' : ''}
            onClick={() => setMode('manual')}
          >
            <Palette size={15} /> Вручную
          </button>
        </div>
      </section>

      <div className="theme-grid">
        {THEMES.map((theme) => {
          const unlockedTheme = isUnlocked(theme);
          const selected = active.id === theme.id;
          return (
            <motion.button
              key={theme.id}
              className={`theme-card ${selected ? 'active' : ''} ${unlockedTheme ? '' : 'locked'}`}
              style={{ ['--theme-preview' as string]: theme.gradient }}
              onClick={() => setPreview(theme)}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.985 }}
            >
              <div className="theme-card-art">
                <span className="theme-orb" />
                <span className="theme-pill" />
                <span className="theme-bar" />
                {!unlockedTheme ? (
                  <span className="theme-lock">
                    <Lock size={13} /> {theme.price} XP
                  </span>
                ) : selected ? (
                  <span className="theme-check">
                    <Check size={13} /> выбрана
                  </span>
                ) : null}
              </div>
              <div className="theme-card-meta">
                <strong>{theme.name}</strong>
                <span>{theme.tagline}</span>
              </div>
            </motion.button>
          );
        })}
      </div>

      <section className="theme-custom">
        <header>
          <h2>
            <Sparkles size={18} /> Свой стиль
          </h2>
          <button
            className="btn btn-ghost"
            onClick={() => {
              setAccent('');
              setWallpaper('');
              setParticles(true);
              pushToast('Кастомизация сброшена');
            }}
          >
            <RotateCcw size={15} /> Сбросить
          </button>
        </header>

        <div className="theme-custom-grid">
          <label className="field">
            <span>Акцентный цвет</span>
            <div className="accent-row">
              <input
                type="color"
                value={accent || active.colors.violet}
                onChange={(event) => setAccent(event.target.value)}
              />
              <code>{accent || active.colors.violet}</code>
              {accent ? (
                <button className="btn btn-ghost btn-sm" onClick={() => setAccent('')}>
                  Сбросить
                </button>
              ) : null}
            </div>
          </label>

          <label className="field">
            <span>Обои на фон</span>
            <div className="wallpaper-row">
              <label className="btn btn-ghost btn-sm">
                <ImagePlus size={15} />
                {wallpaperBusy ? 'Загрузка…' : wallpaper ? 'Заменить' : 'Выбрать'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => void pickWallpaper(event.target.files?.[0] ?? null)}
                />
              </label>
              {wallpaper ? (
                <>
                  <img src={wallpaper} alt="Обои" className="wallpaper-preview" />
                  <button className="btn btn-ghost btn-sm" onClick={() => setWallpaper('')}>
                    Убрать
                  </button>
                </>
              ) : (
                <span className="hint">PNG/JPG до 1.5 МБ</span>
              )}
            </div>
          </label>

          <div className="field">
            <span>Анимации темы</span>
            <div className="theme-toggle-row">
              <p className="hint">
                Снег, лепестки, неон и туман. Отключи, если хочется спокойнее.
              </p>
              <button
                className={`switch ${particles ? 'on' : ''}`}
                onClick={() => setParticles(!particles)}
                aria-pressed={particles}
              >
                <span />
              </button>
            </div>
          </div>
        </div>
      </section>

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview ? `Тема «${preview.name}»` : 'Тема'}
        width={560}
      >
        {preview ? (
          <>
            <div
              className="theme-preview"
              style={{ background: preview.atmosphere, borderColor: preview.colors.lineStrong }}
            >
              <div className="theme-preview-top" style={{ background: preview.colors.panel }}>
                <span style={{ background: preview.gradient }} />
                <span style={{ background: preview.colors.panelStrong }} />
                <span style={{ background: preview.colors.panelStrong }} />
              </div>
              <div className="theme-preview-body">
                <div
                  className="theme-preview-cover"
                  style={{ background: preview.gradient }}
                />
                <div>
                  <strong style={{ color: preview.colors.text }}>{preview.name}</strong>
                  <p style={{ color: preview.colors.muted }}>{preview.tagline}</p>
                  <div className="theme-swatches">
                    {[preview.colors.violet, preview.colors.fuchsia, preview.colors.cyan].map(
                      (color) => (
                        <span key={color} style={{ background: color }} />
                      ),
                    )}
                  </div>
                </div>
              </div>
              <div className="theme-preview-player" style={{ background: preview.colors.panel }}>
                <span style={{ background: preview.gradient }} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>
                Закрыть
              </button>
              <button className="btn btn-primary" onClick={() => apply(preview)}>
                {isUnlocked(preview) ? (
                  <>
                    <Check size={16} /> Применить
                  </>
                ) : (
                  <>
                    <Lock size={16} /> Открыть за {preview.price} XP
                  </>
                )}
              </button>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
