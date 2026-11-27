import { motion } from 'framer-motion';
import {
  Check,
  Download,
  HardDrive,
  KeyRound,
  LogOut,
  Send,
  Server,
  Shield,
  SlidersHorizontal,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiBase, setApiBase } from '../lib/api';
import { formatDate } from '../lib/format';
import { isTelegram, telegram } from '../lib/telegram';
import { useAuth } from '../store/auth';
import { useUi } from '../store/ui';
import { Avatar, Spinner } from '../components/ui';

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e', '#a3e635'];

export function SettingsPage() {
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const logout = useAuth((state) => state.logout);
  const logoutAll = useAuth((state) => state.logoutAll);
  const pushToast = useUi((state) => state.pushToast);
  const setEqOpen = useUi((state) => state.setEqOpen);
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [color, setColor] = useState(user?.avatarColor ?? '#8b5cf6');
  const [savingProfile, setSavingProfile] = useState(false);
  const [serverUrl, setServerUrl] = useState(apiBase() || window.location.origin);
  const [testing, setTesting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changing, setChanging] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<(() => Promise<void>) | null>(null);
  const [bot, setBot] = useState<{ enabled: boolean; username: string | null } | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as Event & { prompt: () => Promise<void> };
      setInstallPrompt(() => () => promptEvent.prompt());
    };
    window.addEventListener('beforeinstallprompt', handler);
    api
      .health()
      .catch(() => undefined);
    fetch(`${apiBase()}/api/config`)
      .then((response) => response.json())
      .then((data: { telegram?: { enabled: boolean; username: string | null } }) => setBot(data.telegram ?? null))
      .catch(() => undefined);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!user) {
    return null;
  }

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const data = await api.updateMe({ displayName: displayName.trim(), avatarColor: color });
      setUser(data.user);
      pushToast('Профиль обновлён', 'success');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const testServer = async () => {
    setTesting(true);
    try {
      const response = await fetch(`${serverUrl.replace(/\/$/, '')}/api/health`);
      if (!response.ok) throw new Error(`Сервер ответил ${response.status}`);
      const data = (await response.json()) as { ok: boolean; tracks: number; db: string };
      pushToast(`Сервер доступен: ${data.tracks} треков, база ${data.db}`, 'success');
    } catch (error) {
      pushToast(`Не удалось подключиться: ${(error as Error).message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const saveServer = () => {
    setApiBase(serverUrl);
    pushToast('Адрес сервера сохранён, перезагружаю…', 'success');
    window.setTimeout(() => window.location.reload(), 700);
  };

  const changePassword = async () => {
    if (newPassword.length < 10) {
      pushToast('Новый пароль минимум 10 символов', 'error');
      return;
    }
    if (!/[A-Za-zА-Яа-я]/.test(newPassword) || !/\d/.test(newPassword)) {
      pushToast('Пароль должен содержать буквы и цифры', 'error');
      return;
    }
    setChanging(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      pushToast('Пароль обновлён. Войди заново.', 'success');
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setChanging(false);
    }
  };

  const install = async () => {
    if (installPrompt) {
      await installPrompt();
      setInstallPrompt(null);
    } else {
      pushToast('Открой меню браузера → «Установить приложение» / «На главный экран»');
    }
  };

  return (
    <motion.div className="page settings-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p>Профиль, приложение и подключения</p>
        </div>
      </div>

      <section className="settings-card profile-card">
        <div className="settings-profile">
          <Avatar name={displayName || user.displayName} color={color} size={72} />
          <div>
            <h2>{user.displayName}</h2>
            <p>
              {user.email ?? 'Telegram-аккаунт'} · с {formatDate(user.createdAt)}
            </p>
            {user.role === 'admin' ? (
              <span className="pill pill-admin">
                <Shield size={11} /> администратор
              </span>
            ) : null}
          </div>
        </div>

        <div className="form-grid two">
          <label className="field">
            <span>
              <UserRound size={13} /> Отображаемое имя
            </span>
            <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <div className="field">
            <span>Цвет аватара</span>
            <div className="color-row">
              {COLORS.map((entry) => (
                <button
                  key={entry}
                  className={`color-dot ${color === entry ? 'active' : ''}`}
                  style={{ background: entry }}
                  onClick={() => setColor(entry)}
                  aria-label={`Цвет ${entry}`}
                >
                  {color === entry ? <Check size={12} /> : null}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="settings-actions">
          <button
            className="btn btn-primary"
            onClick={() => void saveProfile()}
            disabled={savingProfile || !displayName.trim()}
          >
            {savingProfile ? <Spinner size={16} /> : null} Сохранить профиль
          </button>
          {user.role === 'admin' ? (
            <Link className="btn btn-ghost" to="/admin">
              <Shield size={16} /> В админ-панель
            </Link>
          ) : null}
        </div>
      </section>

      <section className="settings-card">
        <h2>
          <Download size={18} /> Приложение
        </h2>
        <p className="muted">
          На телефоне установи PWA — иконка появится на главном экране, плеер будет работать в
          отдельном окне. На Windows используй установщик из релизов GitHub.
        </p>
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={() => void install()}>
            <Download size={16} /> Установить приложение
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h2>
          <SlidersHorizontal size={18} /> Звук
        </h2>
        <p className="muted">
          Пятиполосный эквалайзер с пресетами и усиление громкости до 200% с лимитером.
          Настройки сохраняются на этом устройстве.
        </p>
        <div className="settings-actions">
          <button className="btn btn-ghost" onClick={() => setEqOpen(true)}>
            <SlidersHorizontal size={16} /> Открыть эквалайзер
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h2>
          <HardDrive size={18} /> Офлайн-музыка
        </h2>
        <p className="muted">
          Треки из папки <code>music/</code> в репозитории играют прямо с GitHub Pages — без
          API, Supabase и VPN. Добавить свои файлы: <code>npm run music:add -- "C:\Music"</code>.
        </p>
        <div className="settings-actions">
          <Link className="btn btn-ghost" to="/local">
            <HardDrive size={16} /> Открыть офлайн-музыку
          </Link>
        </div>
      </section>

      <section className="settings-card">
        <h2>
          <Server size={18} /> Сервер API
        </h2>
        <p className="muted">
          Нужно, если backend развёрнут отдельно (Render / Vercel / свой сервер). Адрес хранится
          локально в этом браузере.
        </p>
        <div className="inline-field">
          <input className="input" value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} />
          <button className="btn btn-ghost" onClick={() => void testServer()} disabled={testing}>
            {testing ? <Spinner size={16} /> : null} Проверить
          </button>
          <button className="btn btn-primary" onClick={saveServer}>
            Сохранить
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h2>
          <Send size={18} /> Telegram
        </h2>
        {isTelegram ? (
          <p className="muted">
            Ты открыл приложение внутри Telegram — аккаунт уже связан, уведомления приходят в чат с
            ботом.
          </p>
        ) : bot?.enabled ? (
          <>
            <p className="muted">
              Открой бота и нажми «Открыть Maximize Musik» — аккаунт свяжется автоматически, а
              уведомления будут приходить в Telegram.
            </p>
            {bot.username ? (
              <a className="btn btn-primary" href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer">
                <Send size={16} /> Открыть @{bot.username}
              </a>
            ) : null}
          </>
        ) : (
          <p className="muted">
            Бот пока не настроен на сервере. Добавь TELEGRAM_BOT_TOKEN в переменные окружения API —
            и Mini App появится здесь.
          </p>
        )}
        {telegram ? (
          <p className="hint">Платформа Telegram WebApp обнаружена.</p>
        ) : null}
      </section>

      {user.email ? (
        <section className="settings-card">
          <h2>
            <KeyRound size={18} /> Пароль
          </h2>
          <div className="form-grid two">
            <label className="field">
              <span>Текущий пароль</span>
              <input
                className="input"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <label className="field">
              <span>Новый пароль</span>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className="settings-actions">
            <button
              className="btn btn-primary"
              onClick={() => void changePassword()}
              disabled={changing || !currentPassword || !newPassword}
            >
              {changing ? <Spinner size={16} /> : null} Сменить пароль
            </button>
          </div>
        </section>
      ) : null}

      <section className="settings-card danger-zone">
        <h2>Сессии и выход</h2>
        <p className="muted">
          «Выйти со всех устройств» завершит все сессии и отзовёт токены — полезно, если
          телефон потерян или пароль мог утечь.
        </p>
        <div className="settings-actions">
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await logoutAll();
              navigate('/login', { replace: true });
              pushToast('Все сессии завершены');
            }}
          >
            <Shield size={16} /> Выйти со всех устройств
          </button>
          <button
            className="btn btn-danger"
            onClick={() => {
              logout();
              navigate('/');
              pushToast('Ты вышел из аккаунта');
            }}
          >
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </section>

      <p className="settings-footer">Maximize Musik · версия 1.0.0 · музыка без подписки</p>
    </motion.div>
  );
}
