import { motion } from 'framer-motion';
import { ArrowRight, Headphones, ShieldCheck, Sparkles, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiBase, setApiBase } from '../lib/api';
import { isTelegram, telegram } from '../lib/telegram';
import { useAuth } from '../store/auth';
import { useUi } from '../store/ui';
import { Brand } from '../components/Layout';
import { Spinner } from '../components/ui';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const setSession = useAuth((state) => state.setSession);
  const user = useAuth((state) => state.user);
  const pushToast = useUi((state) => state.pushToast);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [error, setError] = useState('');
  const [serverOpen, setServerOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState(apiBase());

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (!isTelegram || !telegram?.initData) return;
    setTelegramBusy(true);
    api
      .telegramLogin(telegram.initData)
      .then(({ token, user: profile }) => {
        setSession(token, profile);
        pushToast(`Привет, ${profile.displayName}!`, 'success');
        navigate('/', { replace: true });
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setTelegramBusy(false));
  }, [setSession, navigate, pushToast]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result =
        mode === 'login'
          ? await api.login({ email: email.trim(), password })
          : await api.register({ email: email.trim(), password, displayName: displayName.trim() });
      setSession(result.token, result.user);
      pushToast(mode === 'login' ? 'С возвращением!' : 'Аккаунт создан — добро пожаловать!', 'success');
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const demo = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Brand />
        <div className="auth-aside-body">
          <span className="eyebrow">
            <Sparkles size={13} /> Музыка без подписки
          </span>
          <h1>
            Одна библиотека.
            <br />
            <span className="grad-text">Все устройства.</span>
          </h1>
          <p>
            Слушай легально и бесплатно: телефон, Windows и Telegram Mini App. Свои плейлисты,
            лайки и уведомления синхронизируются автоматически.
          </p>
          <ul className="auth-features">
            <li>
              <Headphones size={17} /> Полноценный плеер с очередью и медиа-клавишами
            </li>
            <li>
              <ShieldCheck size={17} /> Свободные лицензии — без пиратства и подписок
            </li>
            <li>
              <WifiOff size={17} /> PWA: интерфейс работает даже при слабой сети
            </li>
          </ul>
        </div>
        <div className="auth-orb" aria-hidden="true" />
      </aside>

      <main className="auth-main">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <h2>{mode === 'login' ? 'Вход' : 'Создать аккаунт'}</h2>
          <p className="auth-sub">
            {mode === 'login'
              ? 'Продолжи слушать с того же места'
              : 'Пара секунд — и можно слушать'}
          </p>

          {telegramBusy ? (
            <div className="telegram-login">
              <Spinner />
              <span>Входим через Telegram…</span>
            </div>
          ) : null}

          <button className="server-setup-link" onClick={() => setServerOpen((value) => !value)}>
            {apiBase() ? `Сервер: ${apiBase()}` : 'Подключить сервер API'}
          </button>
          {serverOpen ? (
            <div className="server-setup">
              <input
                className="input"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder="https://твой-api.onrender.com"
                spellCheck={false}
              />
              <button
                className="btn btn-primary"
                onClick={() => {
                  setApiBase(serverUrl);
                  window.location.reload();
                }}
              >
                Сохранить
              </button>
              <p className="hint">
                Адрес backend из Render или своего сервера. Для веб-версии можно оставить пустым —
                тогда используется текущий домен.
              </p>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            {mode === 'register' ? (
              <label className="field">
                <span>Как тебя зовут</span>
                <input
                  className="input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Имя или ник"
                  autoComplete="nickname"
                  required
                  minLength={2}
                />
              </label>
            ) : null}
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label className="field">
              <span>Пароль</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'register' ? 'Минимум 8 символов' : 'Твой пароль'}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'register' ? 8 : 1}
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button className="btn btn-primary btn-lg btn-full" type="submit" disabled={busy}>
              {busy ? <Spinner size={18} /> : null}
              {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              {!busy ? <ArrowRight size={17} /> : null}
            </button>
          </form>

          {isTelegram ? (
            <p className="auth-hint">
              Внутри Telegram вход происходит автоматически — без пароля.
            </p>
          ) : null}

          <div className="auth-switch">
            {mode === 'login' ? (
              <>
                Нет аккаунта? <Link to="/register">Создать</Link>
              </>
            ) : (
              <>
                Уже есть аккаунт? <Link to="/login">Войти</Link>
              </>
            )}
          </div>

          {demo ? (
            <p className="auth-demo">
              Демо-админ: admin@maximize.local / admin12345
            </p>
          ) : null}
        </motion.div>
      </main>
    </div>
  );
}
