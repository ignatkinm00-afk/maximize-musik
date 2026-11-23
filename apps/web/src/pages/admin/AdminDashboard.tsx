import {
  BellRing,
  Disc3,
  Headphones,
  Heart,
  ListMusic,
  Send,
  TrendingUp,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatCount, formatDate } from '../../lib/format';
import { useUi } from '../../store/ui';
import type { AdminStats } from '../../types';
import { Avatar, Spinner } from '../../components/ui';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="stat-card">
      <span className="stat-icon">
        <Icon size={18} />
      </span>
      <strong>{value}</strong>
      <span className="stat-label">{label}</span>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const pushToast = useUi((state) => state.pushToast);

  useEffect(() => {
    api
      .adminStats()
      .then(setStats)
      .catch((error: Error) => pushToast(error.message, 'error'));
  }, [pushToast]);

  if (!stats) {
    return (
      <div className="admin-loading">
        <Spinner size={24} />
      </div>
    );
  }

  const maxDaily = Math.max(1, ...stats.daily.map((day) => day.total));

  return (
    <div className="admin-stack">
      <div className="admin-banner">
        <div>
          <strong>Бот {stats.bot.live ? 'на связи' : stats.bot.configured ? 'запускается' : 'не настроен'}</strong>
          <span>
            {stats.bot.live
              ? 'Рассылки уходят в Telegram сразу после отправки из админки.'
              : 'Добавь TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_URL — и включится Mini App.'}
          </span>
        </div>
        <Link to="/admin/broadcast" className="btn btn-primary">
          <Send size={16} /> Сделать рассылку
        </Link>
      </div>

      <div className="stats-grid">
        <StatCard label="Пользователи" value={stats.totals.users} hint={`${stats.totals.admins} админ`} icon={Users} />
        <StatCard label="Треки" value={stats.totals.tracks} hint={`${stats.totals.unpublished} черновиков`} icon={Disc3} />
        <StatCard label="Прослушивания" value={formatCount(stats.totals.plays)} hint={`${stats.totals.playsToday} сегодня`} icon={Headphones} />
        <StatCard label="Лайки" value={formatCount(stats.totals.likes)} icon={Heart} />
        <StatCard label="Плейлисты" value={stats.totals.playlists} icon={ListMusic} />
        <StatCard label="Подписчики бота" value={stats.totals.subscribers} icon={Send} />
        <StatCard label="Уведомления" value={stats.totals.notifications} icon={BellRing} />
        <StatCard label="Черновики" value={stats.totals.unpublished} icon={UploadCloud} />
      </div>

      <section className="admin-card">
        <header>
          <h2>
            <TrendingUp size={17} /> Прослушивания за 14 дней
          </h2>
          <span>{stats.totals.plays} всего</span>
        </header>
        <div className="chart">
          {stats.daily.map((day) => (
            <div key={day.day} className="chart-col" title={`${day.day}: ${day.total}`}>
              <div className="chart-bar-wrap">
                <div
                  className="chart-bar"
                  style={{ height: `${Math.max(3, (day.total / maxDaily) * 100)}%` }}
                />
              </div>
              <span>
                {new Date(day.day).toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="admin-columns">
        <section className="admin-card">
          <header>
            <h2>Топ треков</h2>
            <Link to="/admin/tracks" className="link-more">
              Все
            </Link>
          </header>
          <div className="admin-list">
            {stats.topTracks.map((track, index) => (
              <div key={track.id} className="admin-list-row">
                <span className="rank">{index + 1}</span>
                <div>
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </div>
                <em>{formatCount(track.plays)}</em>
              </div>
            ))}
            {stats.topTracks.length === 0 ? <p className="muted">Пока нет данных.</p> : null}
          </div>
        </section>

        <section className="admin-card">
          <header>
            <h2>Новые пользователи</h2>
            <Link to="/admin/users" className="link-more">
              Все
            </Link>
          </header>
          <div className="admin-list">
            {stats.recentUsers.map((user) => (
              <div key={user.id} className="admin-list-row">
                <Avatar name={user.displayName} size={32} />
                <div>
                  <strong>{user.displayName}</strong>
                  <span>{user.email ?? 'Telegram'}</span>
                </div>
                <em>{formatDate(user.createdAt)}</em>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
