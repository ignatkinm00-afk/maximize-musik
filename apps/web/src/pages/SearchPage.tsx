import { motion } from 'framer-motion';
import { Music2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { TrackRow } from '../components/Track';
import { EmptyState, Spinner } from '../components/ui';
import { useUi } from '../store/ui';
import type { Genre, Track } from '../types';

const RECENT_KEY = 'mm_recent_searches';
const PAGE_SIZE = 40;

export function SearchPage() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [genre, setGenre] = useState(params.get('genre') ?? '');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [total, setTotal] = useState(0);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const pushToast = useUi((state) => state.pushToast);

  useEffect(() => {
    inputRef.current?.focus();
    api.genres().then((data) => setGenres(data.genres)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setLoading(true);
      setError('');
      api
        .tracks({ q: query || undefined, genre: genre || undefined, limit: PAGE_SIZE })
        .then((data) => {
          setTracks(data.tracks);
          setTotal(data.total);
        })
        .catch((err: Error) => {
          setError(err.message);
          pushToast(err.message, 'error');
        })
        .finally(() => setLoading(false));
    }, 320);
    return () => window.clearTimeout(handler);
  }, [query, genre, pushToast]);

  useEffect(() => {
    if (params.get('genre')) setGenre(params.get('genre') ?? '');
    if (params.get('q') !== null) setQuery(params.get('q') ?? '');
  }, [params]);

  const saveRecent = (value: string) => {
    const term = value.trim();
    if (!term) return;
    const next = [term, ...recent.filter((entry) => entry.toLowerCase() !== term.toLowerCase())].slice(0, 6);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.tracks({
        q: query || undefined,
        genre: genre || undefined,
        limit: PAGE_SIZE,
        offset: tracks.length,
      });
      setTracks((current) => [...current, ...data.tracks]);
      setTotal(data.total);
    } catch (err) {
      pushToast((err as Error).message, 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const heading = useMemo(() => {
    if (genre) return genre;
    if (query.trim()) return `«${query.trim()}»`;
    return 'Весь каталог';
  }, [genre, query]);

  return (
    <motion.div className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="search-head">
        <div className="search-field">
          <Search size={20} />
          <input
            ref={inputRef}
            value={query}
            placeholder="Трек, исполнитель, альбом…"
            onChange={(event) => setQuery(event.target.value)}
            onBlur={() => saveRecent(query)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') saveRecent(query);
              if (event.key === 'Escape') setQuery('');
            }}
            aria-label="Поиск музыки"
          />
          {query ? (
            <button className="icon-btn subtle" onClick={() => setQuery('')} aria-label="Очистить">
              <X size={16} />
            </button>
          ) : null}
        </div>

        {!query && recent.length > 0 ? (
          <div className="recent-searches">
            <span>Недавно искал:</span>
            {recent.map((entry) => (
              <button key={entry} className="chip chip-sm" onClick={() => setQuery(entry)}>
                {entry}
              </button>
            ))}
          </div>
        ) : null}

        <div className="genre-strip">
          <button
            className={`chip chip-sm ${genre === '' ? 'active' : ''}`}
            onClick={() => setGenre('')}
          >
            Все
          </button>
          {genres.map((entry) => (
            <button
              key={entry.name}
              className={`chip chip-sm ${genre === entry.name ? 'active' : ''}`}
              onClick={() => setGenre(entry.name === genre ? '' : entry.name)}
            >
              {entry.name}
            </button>
          ))}
        </div>
      </div>

      <div className="search-title-row">
        <h1>{heading}</h1>
        <span>{loading ? 'ищем…' : `${total} треков`}</span>
      </div>

      {loading ? (
        <div className="skeleton-list">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="skeleton-row" />
          ))}
        </div>
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="Ничего не нашлось"
          description={error || 'Попробуй другой запрос или выбери жанр.'}
        />
      ) : (
        <>
          <div className="track-list panel">
            {tracks.map((track, index) => (
              <TrackRow key={track.id} track={track} queue={tracks} index={index} />
            ))}
          </div>
          {tracks.length < total ? (
            <div className="load-more">
              <button className="btn btn-ghost" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? <Spinner size={16} /> : null} Показать ещё
              </button>
            </div>
          ) : null}
        </>
      )}
    </motion.div>
  );
}
