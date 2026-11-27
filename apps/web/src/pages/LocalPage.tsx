import { motion } from 'framer-motion';
import { HardDrive, Play, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatTime } from '../lib/format';
import { githubTrack, loadGithubMusic, type GithubMusicEntry } from '../lib/githubMusic';
import { usePlayer } from '../store/player';
import { Cover, EmptyState, Equalizer, Spinner } from '../components/ui';

export function LocalPage() {
  const [entries, setEntries] = useState<GithubMusicEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const playTrack = usePlayer((state) => state.playTrack);
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);

  useEffect(() => {
    let alive = true;
    void loadGithubMusic().then((data) => {
      if (alive) setEntries(data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const tracks = useMemo(() => (entries ?? []).map(githubTrack), [entries]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tracks;
    return tracks.filter((track) =>
      `${track.title} ${track.artist} ${track.album ?? ''} ${track.genre ?? ''}`
        .toLowerCase()
        .includes(term),
    );
  }, [tracks, query]);

  const totalDuration = useMemo(
    () => tracks.reduce((sum, track) => sum + track.duration, 0),
    [tracks],
  );

  return (
    <motion.div className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-head">
        <div>
          <span className="eyebrow">
            <HardDrive size={13} /> Офлайн-музыка
          </span>
          <h1>Моя музыка из GitHub</h1>
          <p>
            Файлы лежат прямо в репозитории и раздаются с GitHub Pages — без API, Supabase и
            VPN. Работает, даже если backend недоступен.
          </p>
        </div>
      </div>

      <div className="local-summary">
        <div>
          <strong>{tracks.length}</strong>
          <span>треков в репозитории</span>
        </div>
        <div>
          <strong>{formatTime(totalDuration)}</strong>
          <span>общая длительность</span>
        </div>
        <div>
          <strong>GitHub Pages</strong>
          <span>источник файлов</span>
        </div>
      </div>

      <div className="search-field">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по своей музыке…"
          aria-label="Поиск по локальной музыке"
        />
      </div>

      {entries === null ? (
        <div className="page-loader">
          <Spinner size={22} />
        </div>
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title="Пока пусто"
          description="Добавь музыку в репозиторий одной командой — файлы и каталог создадутся автоматически."
          action={
            <div className="local-command">
              <code>npm run music:add -- "C:\Music" --push</code>
            </div>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Ничего не нашлось" description="Попробуй другой запрос." />
      ) : (
        <>
          <div className="list-meta">
            <span>{filtered.length} треков</span>
            <span>играет напрямую с GitHub</span>
          </div>
          <div className="track-list panel local-list">
            {filtered.map((track, index) => {
              const active = current?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={`local-row ${active ? 'is-active' : ''}`}
                  onClick={() => playTrack(track, filtered)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') playTrack(track, filtered);
                  }}
                >
                  <div className="row-index">
                    {active && playing ? (
                      <Equalizer active />
                    ) : (
                      <span className="local-row-number">
                        {active ? <Play size={14} fill="currentColor" /> : index + 1}
                      </span>
                    )}
                  </div>
                  <Cover src={track.coverUrl} color={track.color} name={track.title} size={44} rounded={10} />
                  <div className="row-main">
                    <span className="row-title">{track.title}</span>
                    <span className="row-artist">
                      {track.artist}
                      {track.album ? <span className="row-album"> · {track.album}</span> : null}
                    </span>
                  </div>
                  {track.genre ? <span className="row-genre">{track.genre}</span> : null}
                  <span className="row-duration">{formatTime(track.duration)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="note">
        <HardDrive size={16} />
        <span>
          Файлы хранятся в <code>apps/web/public/music</code>, обложки — в{' '}
          <code>music/covers</code>. После <code>git push</code> они появятся на сайте через
          пару минут. Учти лимиты GitHub: репозиторий до 1 ГБ, файл до 100 МБ — для большой
          библиотеки лучше Supabase Storage.
        </span>
      </div>
    </motion.div>
  );
}
