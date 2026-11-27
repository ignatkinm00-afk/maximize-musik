import { CalendarHeart, Clock3, Heart, Music2, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import type { YearReview } from '../types';
import { Cover, PageLoader } from '../components/ui';

export function YearReviewPage() {
  const [data, setData] = useState<YearReview | null>(null);
  const [loading, setLoading] = useState(true);
  const playTrack = usePlayer((state) => state.playTrack);
  const pushToast = useUi((state) => state.pushToast);

  useEffect(() => {
    api
      .yearReview()
      .then(setData)
      .catch((error) => pushToast((error as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [pushToast]);

  if (loading) return <PageLoader />;
  if (!data) return <p className="hint">Не удалось загрузить итоги.</p>;

  const totalGenres = data.genres.reduce((sum, item) => sum + item.total, 0) || 1;

  return (
    <div className="page year-page">
      <header className="year-hero">
        <p className="eyebrow">
          <CalendarHeart size={14} /> итоги года
        </p>
        <h1>{data.year}</h1>
        <p>Твой музыкальный год в Maximize</p>
      </header>

      <div className="year-stats">
        <div>
          <Music2 size={20} />
          <strong>{data.plays}</strong>
          <span>прослушиваний</span>
        </div>
        <div>
          <Clock3 size={20} />
          <strong>{data.minutes}</strong>
          <span>минут музыки</span>
        </div>
        <div>
          <Heart size={20} />
          <strong>{data.likes}</strong>
          <span>лайков</span>
        </div>
      </div>

      <section className="profile-section">
        <h2>Любимые жанры</h2>
        <div className="year-genres">
          {data.genres.map((item) => (
            <div key={item.genre} className="year-genre">
              <span>{item.genre}</span>
              <div className="year-genre-bar">
                <i style={{ width: `${(item.total / totalGenres) * 100}%` }} />
              </div>
              <strong>{item.total}</strong>
            </div>
          ))}
          {data.genres.length === 0 ? <p className="hint">Пока нет данных — слушай музыку.</p> : null}
        </div>
      </section>

      <section className="profile-section">
        <h2>Топ треков</h2>
        <div className="profile-tracks">
          {data.topTracks.map((track, index) => (
            <button
              key={track.id}
              className="profile-track"
              onClick={() => playTrack(track, data.topTracks)}
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

      <Link to="/" className="btn btn-primary year-cta">
        Слушать дальше
      </Link>
    </div>
  );
}
