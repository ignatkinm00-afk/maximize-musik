import { MessageCircle, Music2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import type { FeedItem } from '../types';
import { Avatar, PageLoader } from '../components/ui';

export function FeedPage() {
  const user = useAuth((state) => state.user);
  const playTrack = usePlayer((state) => state.playTrack);
  const pushToast = useUi((state) => state.pushToast);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .feed()
      .then((data) => setItems(data.items))
      .catch((error) => pushToast((error as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [user, pushToast]);

  if (!user) {
    return (
      <div className="page">
        <div className="empty-state">
          <Users size={34} />
          <h3>Лента доступна после входа</h3>
          <Link className="btn btn-primary" to="/login">
            Войти
          </Link>
        </div>
      </div>
    );
  }

  if (loading) return <PageLoader />;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="eyebrow">
            <Users size={14} /> друзья
          </p>
          <h1>Лента</h1>
          <p className="page-subtitle">Что слушают и обсуждают люди, на которых ты подписан.</p>
        </div>
        <Link className="btn btn-ghost" to="/leaderboard">
          Рейтинг
        </Link>
      </header>

      {items.length === 0 ? (
        <div className="empty-state">
          <Users size={34} />
          <h3>Пока тихо</h3>
          <p>Подпишись на кого-нибудь — здесь появятся их прослушивания и комментарии.</p>
          <Link className="btn btn-primary" to="/leaderboard">
            Найти людей
          </Link>
        </div>
      ) : (
        <div className="feed-list">
          {items.map((item) => (
            <article key={item.id} className="feed-item">
              <Avatar name={item.user.displayName} color={item.user.avatarColor} size={40} />
              <div className="feed-body">
                <p>
                  <strong>{item.user.displayName}</strong>{' '}
                  {item.type === 'play' ? 'слушает' : 'комментирует'}:
                </p>
                {item.text ? <blockquote>{item.text}</blockquote> : null}
                <button
                  className="feed-track"
                  onClick={() => {
                    void api
                      .track(item.track.id)
                      .then((data) => playTrack(data.track))
                      .catch(() => pushToast('Трек недоступен', 'error'));
                  }}
                >
                  <Music2 size={14} /> {item.track.artist} — {item.track.title}
                </button>
                <span className="feed-time">
                  {item.type === 'comment' ? <MessageCircle size={12} /> : null}
                  {relativeTime(item.createdAt)}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
