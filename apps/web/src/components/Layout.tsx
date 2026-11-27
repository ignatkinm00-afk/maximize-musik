import {
  Bell,
  Download,
  HardDrive,
  Home,
  Library,
  LogOut,
  Palette,
  Plus,
  Radio,
  Search,
  Settings,
  Shield,
  User as UserIcon,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { useNotifications } from '../store/notifications';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import type { Playlist } from '../types';
import { FullPlayer, PlayerBar } from './Player';
import { EqualizerDialog } from './Equalizer';
import { ThemeParticles } from './ThemeFx';
import { Avatar, Cover, PageLoader } from './ui';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <span className="brand-mark">M</span>
      {!compact ? (
        <span className="brand-text">
          <strong>MAXIMIZE</strong>
          <em>MUSIK</em>
        </span>
      ) : null}
    </div>
  );
}

function Sidebar() {
  const user = useAuth((state) => state.user);
  const logout = useAuth((state) => state.logout);
  const unread = useNotifications((state) => state.unread);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const navigate = useNavigate();
  const pushToast = useUi((state) => state.pushToast);

  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      return;
    }
    api
      .playlists()
      .then((data) => setPlaylists(data.playlists))
      .catch(() => undefined);
  }, [user]);

  const createPlaylist = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const { playlist } = await api.createPlaylist({ title: 'Мой плейлист' });
      navigate(`/playlist/${playlist.id}`);
    } catch (error) {
      pushToast((error as Error).message, 'error');
    }
  };

  return (
    <aside className="sidebar">
      <NavLink to="/" className="sidebar-brand">
        <Brand />
      </NavLink>

      <nav className="side-nav">
        <NavLink to="/" end>
          <Home size={18} /> <span>Главная</span>
        </NavLink>
        <NavLink to="/search">
          <Search size={18} /> <span>Поиск</span>
        </NavLink>
        <NavLink to="/themes">
          <Palette size={18} /> <span>Темы</span>
        </NavLink>
        <NavLink to="/feed">
          <Users size={18} /> <span>Лента</span>
        </NavLink>
        <NavLink to="/rooms">
          <Radio size={18} /> <span>Комнаты</span>
        </NavLink>
        <NavLink to="/library">
          <Library size={18} /> <span>Моя музыка</span>
        </NavLink>
        <NavLink to="/local">
          <HardDrive size={18} /> <span>Офлайн</span>
        </NavLink>
        <NavLink to="/downloads">
          <Download size={18} /> <span>Скачано</span>
        </NavLink>
        <NavLink to="/notifications">
          <Bell size={18} /> <span>Уведомления</span>
          {unread > 0 ? <em className="nav-badge">{unread > 9 ? '9+' : unread}</em> : null}
        </NavLink>
        {user?.role === 'admin' ? (
          <NavLink to="/admin">
            <Shield size={18} /> <span>Админка</span>
          </NavLink>
        ) : null}
      </nav>

      <div className="side-playlists">
        <div className="side-playlists-head">
          <span>Плейлисты</span>
          <button className="icon-btn subtle" onClick={() => void createPlaylist()} aria-label="Создать плейлист">
            <Plus size={16} />
          </button>
        </div>
        <div className="side-playlists-list">
          {playlists.map((playlist) => (
            <NavLink key={playlist.id} to={`/playlist/${playlist.id}`} className="side-playlist">
              <Cover src={playlist.coverUrl} name={playlist.title} size={30} rounded={8} />
              <span>{playlist.title}</span>
            </NavLink>
          ))}
          {user && playlists.length === 0 ? (
            <p className="side-hint">Создай плейлист и собери свою коллекцию.</p>
          ) : null}
        </div>
      </div>

      <div className="side-user">
        {user ? (
          <>
            <NavLink to={`/u/${user.id}`} className="side-user-link">
              <Avatar name={user.displayName} color={user.avatarColor} size={36} />
              <span>
                <strong>{user.displayName}</strong>
                <em>{user.role === 'admin' ? 'администратор' : 'слушатель'}</em>
              </span>
            </NavLink>
            <NavLink to="/settings" className="icon-btn subtle" aria-label="Настройки">
              <Settings size={16} />
            </NavLink>
            <button
              className="icon-btn subtle"
              onClick={() => {
                logout();
                navigate('/');
                pushToast('Вы вышел из аккаунта');
              }}
              aria-label="Выйти"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-full" onClick={() => navigate('/login')}>
            <UserIcon size={16} /> Войти
          </button>
        )}
      </div>
    </aside>
  );
}

function MobileHeader() {
  const user = useAuth((state) => state.user);
  const unread = useNotifications((state) => state.unread);
  return (
    <header className="mobile-header">
      <NavLink to="/" aria-label="На главную">
        <Brand compact />
      </NavLink>
      <div className="mobile-header-actions">
        <NavLink to="/local" className="icon-btn" aria-label="Офлайн-музыка">
          <HardDrive size={20} />
        </NavLink>
        <NavLink to="/notifications" className="icon-btn" aria-label="Уведомления">
          <Bell size={20} />
          {unread > 0 ? <em className="dot" /> : null}
        </NavLink>
        <NavLink to={user ? '/settings' : '/login'} aria-label="Профиль">
          {user ? (
            <Avatar name={user.displayName} color={user.avatarColor} size={32} />
          ) : (
            <span className="icon-btn">
              <UserIcon size={20} />
            </span>
          )}
        </NavLink>
      </div>
    </header>
  );
}

function MobileNav() {
  const user = useAuth((state) => state.user);
  const unread = useNotifications((state) => state.unread);
  return (
    <nav className="mobile-nav">
      <NavLink to="/" end>
        <Home size={20} /> <span>Главная</span>
      </NavLink>
      <NavLink to="/search">
        <Search size={20} /> <span>Поиск</span>
      </NavLink>
      <NavLink to="/library">
        <Library size={20} /> <span>Моя</span>
      </NavLink>
      <NavLink to="/notifications">
        <Bell size={20} /> <span>События</span>
        {unread > 0 ? <em className="nav-badge">{unread > 9 ? '9+' : unread}</em> : null}
      </NavLink>
      {user?.role === 'admin' ? (
        <NavLink to="/admin">
          <Shield size={20} /> <span>Админ</span>
        </NavLink>
      ) : (
        <NavLink to={user ? '/settings' : '/login'}>
          <Settings size={20} /> <span>{user ? 'Ещё' : 'Войти'}</span>
        </NavLink>
      )}
    </nav>
  );
}

function ScrollToTop() {
  const location = useLocation();
  useEffect(() => {
    document.querySelector('.page-scroll')?.scrollTo({ top: 0 });
  }, [location.pathname]);
  return null;
}

export function AppLayout() {
  const ready = useAuth((state) => state.ready);
  const user = useAuth((state) => state.user);
  const init = useAuth((state) => state.init);
  const current = usePlayer((state) => state.current);
  const refresh = useNotifications((state) => state.refresh);
  const refreshOffline = usePlayer((state) => state.refreshOffline);

  useEffect(() => {
    void init();
    void refreshOffline();
  }, [init, refreshOffline]);

  useEffect(() => {
    document.title = current ? `${current.title} — ${current.artist}` : 'Maximize Musik';
  }, [current]);

  useEffect(() => {
    if (!user) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 45000);
    return () => window.clearInterval(timer);
  }, [user, refresh]);

  if (!ready) return <PageLoader />;

  return (
    <div className="app-shell">
      <ThemeParticles />
      <Sidebar />
      <div className="app-main">
        <MobileHeader />
        <main className="page-scroll">
          <Outlet />
        </main>
      </div>
      <MobileNav />
      <PlayerBar />
      <FullPlayer />
      <EqualizerDialog />
      <ScrollToTop />
    </div>
  );
}
