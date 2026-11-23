import { motion } from 'framer-motion';
import {
  ArrowRight,
  Monitor,
  Play,
  Send,
  Smartphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCount } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import type { HomeData } from '../types';
import { PlaylistCard, TrackCard, TrackRow } from '../components/Track';
import { Cover, EmptyState, SectionHeader, Spinner } from '../components/ui';

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');
  const user = useAuth((state) => state.user);
  const playTrack = usePlayer((state) => state.playTrack);
  const pushToast = useUi((state) => state.pushToast);

  useEffect(() => {
    let alive = true;
    api
      .home()
      .then((payload) => {
        if (alive) setData(payload);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err.message);
        pushToast(err.message, 'error');
      });
    return () => {
      alive = false;
    };
  }, [user, pushToast]);

  if (!data) {
    return (
      <div className="page">
        <div className="hero-skeleton">
          <Spinner size={26} />
        </div>
      </div>
    );
  }

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 5) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
  })();

  const featured = data.featured;

  return (
    <motion.div className="page" variants={container} initial="hidden" animate="show">
      <motion.section className="hero" variants={item}>
        <div className="hero-content">
          <span className="eyebrow">
            <Sparkles size={13} /> Музыка без подписки
          </span>
          <h1>
            {user ? `${greeting},` : 'Твоя музыка.'}
            <br />
            <span className="grad-text">{user ? user.displayName.split(' ')[0] : 'Без границ.'}</span>
          </h1>
          <p>
            Легальный каталог, свои плейлисты и синхронизация между телефоном, Windows и Telegram.
            Никаких платных подписок.
          </p>
          <div className="hero-actions">
            {featured ? (
              <button
                className="btn btn-primary btn-lg"
                onClick={() => playTrack(featured, data.top)}
              >
                <Play size={18} fill="currentColor" /> Слушать
              </button>
            ) : (
              <Link to="/search" className="btn btn-primary btn-lg">
                <Play size={18} fill="currentColor" /> Найти музыку
              </Link>
            )}
            <Link to="/search" className="btn btn-ghost btn-lg">
              Каталог <ArrowRight size={17} />
            </Link>
          </div>
          <div className="hero-stats">
            <div>
              <strong>{formatCount(data.totalTracks)}</strong>
              <span>треков в каталоге</span>
            </div>
            <div>
              <strong>{data.genres.length}</strong>
              <span>жанров</span>
            </div>
            <div>
              <strong>3</strong>
              <span>платформы</span>
            </div>
          </div>
        </div>

        <div className="hero-art">
          {featured ? (
            <>
              <div className="hero-cover-wrap">
                <Cover
                  src={featured.coverUrl}
                  color={featured.color}
                  name={featured.title}
                  rounded={26}
                  className="hero-cover"
                />
                <div className="hero-vinyl" aria-hidden="true" />
              </div>
              <div className="hero-track">
                <span>Сейчас в топе</span>
                <strong>{featured.title}</strong>
                <em>{featured.artist}</em>
              </div>
            </>
          ) : (
            <div className="hero-empty">
              <EmptyState
                icon={TrendingUp}
                title="Каталог пока пуст"
                description="Запусти сид или добавь треки в админке."
              />
            </div>
          )}
        </div>
      </motion.section>

      {data.genres.length > 0 ? (
        <motion.div className="genre-strip" variants={item}>
          {data.genres.map((genre) => (
            <Link key={genre.name} to={`/search?genre=${encodeURIComponent(genre.name)}`} className="chip">
              {genre.name}
              <em>{genre.total}</em>
            </Link>
          ))}
        </motion.div>
      ) : null}

      {data.newest.length > 0 ? (
        <motion.section variants={item}>
          <SectionHeader
            title="Новинки"
            subtitle="Свежие поступления каталога"
            action={
              <Link to="/search" className="link-more">
                Все <ArrowRight size={15} />
              </Link>
            }
          />
          <div className="grid-cards">
            {data.newest.slice(0, 8).map((track) => (
              <TrackCard key={track.id} track={track} queue={data.newest} />
            ))}
          </div>
        </motion.section>
      ) : null}

      {data.top.length > 0 ? (
        <motion.section variants={item}>
          <SectionHeader title="Топ недели" subtitle="Что слушают чаще всего" />
          <div className="track-list panel">
            {data.top.slice(0, 8).map((track, index) => (
              <TrackRow key={track.id} track={track} queue={data.top} index={index} />
            ))}
          </div>
        </motion.section>
      ) : null}

      {data.playlists.length > 0 ? (
        <motion.section variants={item}>
          <SectionHeader
            title="Твои плейлисты"
            subtitle="Продолжи с того места, где остановился"
            action={
              <Link to="/library" className="link-more">
                Все <ArrowRight size={15} />
              </Link>
            }
          />
          <div className="grid-cards">
            {data.playlists.map((playlist) => (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="card-link">
                <PlaylistCard playlist={playlist} onClick={() => undefined} />
              </Link>
            ))}
          </div>
        </motion.section>
      ) : null}

      <motion.section className="platform-strip" variants={item}>
        <div className="platform-item">
          <Smartphone size={20} />
          <div>
            <strong>Телефон</strong>
            <span>Установи PWA — работает как приложение</span>
          </div>
        </div>
        <div className="platform-item">
          <Monitor size={20} />
          <div>
            <strong>Windows</strong>
            <span>Установщик с плеером и медиа-клавишами</span>
          </div>
        </div>
        <div className="platform-item">
          <Send size={20} />
          <div>
            <strong>Telegram</strong>
            <span>Мини-приложение прямо в чате с ботом</span>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
