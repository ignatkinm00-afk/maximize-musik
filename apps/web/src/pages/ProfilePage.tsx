import { motion } from 'framer-motion';
import { ArrowLeft, CalendarHeart, Flame, Play, Trophy, UserPlus, UserCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCount } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import type { PublicProfile } from '../types';
import { Avatar, Cover, PageLoader } from '../components/ui';

export function ProfilePage() {
  const { id = '' } = useParams();
  const me = useAuth((state) => state.user);
  const playTrack = usePlayer((state) => state.playTrack);
  const pushToast = useUi((state) => state.pushToast);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .profile(id)
      .then(setProfile)
      .catch((error) => pushToast((error as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleFollow = async () => {
    if (!profile) return;
    try {
      const result = await api.toggleFollow(profile.user.id);
      setProfile((current) =>
        current
          ? {
              ...current,
              isFollowing: result.following,
              stats: {
                ...current.stats,
                followers: current.stats.followers + (result.following ? 1 : -1),
              },
            }
          : current,
      );
    } catch (error) {
      pushToast((error as Error).message, 'error');
    }
  };

  if (loading) return <PageLoader />;
  if (!profile) {
    return (
      <div className="page">
        <p className="hint">Пользователь не найден.</p>
        <Link className="btn btn-ghost" to="/">
          <ArrowLeft size={16} /> На главную
        </Link>
      </div>
    );
  }

  const { user, stats } = profile;

  return (
    <div className="page profile-page">
      <Link to="/feed" className="back-link">
        <ArrowLeft size={16} /> Лента
      </Link>

      <header className="profile-hero">
        <Avatar name={user.displayName} color={user.avatarColor} size={86} />
        <div className="profile-headline">
          <h1>{user.displayName}</h1>
          <p>
            Уровень {stats.level} · {stats.xp} XP · в топе #{stats.rank}
          </p>
          <div className="xp-bar">
            <span style={{ width: `${stats.progress}%` }} />
          </div>
          <div className="profile-inline">
            <span>
              <Flame size={14} /> {stats.streak} дней подряд
            </span>
            <span>
              <Trophy size={14} /> {stats.achievements.filter((item) => item.unlocked).length}{' '}
              ачивок
            </span>
          </div>
        </div>
        <div className="profile-actions">
          {profile.isMe ? (
            <>
              <Link className="btn btn-ghost" to="/year">
                <CalendarHeart size={16} /> Итоги года
              </Link>
              <Link className="btn btn-ghost" to="/leaderboard">
                <Trophy size={16} /> Рейтинг
              </Link>
            </>
          ) : me ? (
            <button className="btn btn-primary" onClick={() => void toggleFollow()}>
              {profile.isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
              {profile.isFollowing ? 'Вы подписаны' : 'Подписаться'}
            </button>
          ) : (
            <Link className="btn btn-primary" to="/login">
              Войти, чтобы подписаться
            </Link>
          )}
        </div>
      </header>

      <div className="profile-stats">
        {[
          ['Прослушиваний', stats.plays],
          ['Лайков', stats.likes],
          ['Плейлистов', stats.playlists],
          ['Комментариев', stats.comments],
          ['Подписчиков', stats.followers],
          ['Подписок', stats.following],
        ].map(([label, value]) => (
          <div key={String(label)} className="profile-stat">
            <strong>{formatCount(Number(value))}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <section className="profile-section">
        <h2>Ачивки</h2>
        <div className="achievements-grid">
          {stats.achievements.map((achievement) => (
            <motion.div
              key={achievement.code}
              className={`achievement ${achievement.unlocked ? 'unlocked' : ''}`}
              whileHover={{ y: -2 }}
            >
              <span className="achievement-icon">
                {achievement.unlocked ? <Trophy size={18} /> : '?'}
              </span>
              <strong>{achievement.title}</strong>
              <span>{achievement.description}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {profile.topTracks.length > 0 ? (
        <section className="profile-section">
          <h2>Часто слушает</h2>
          <div className="profile-tracks">
            {profile.topTracks.map((track, index) => (
              <button
                key={track.id}
                className="profile-track"
                onClick={() => playTrack(track, profile.topTracks)}
              >
                <span className="profile-track-index">{index + 1}</span>
                <Cover src={track.coverUrl} color={track.color} name={track.title} size={42} />
                <span className="profile-track-meta">
                  <strong>{track.title}</strong>
                  <em>{track.artist}</em>
                </span>
                <Play size={16} />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
