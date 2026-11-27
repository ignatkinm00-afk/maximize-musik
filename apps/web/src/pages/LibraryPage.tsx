import { motion } from 'framer-motion';
import { Heart, HardDrive, History, Library, ListMusic, Plus, Upload, UploadCloud } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { relativeTime } from '../lib/format';
import { useAuth } from '../store/auth';
import { useUi } from '../store/ui';
import type { Playlist, Track } from '../types';
import { PlaylistCard, TrackRow } from '../components/Track';
import { UploadDialog } from '../components/UploadDialog';
import { Cover, EmptyState, Modal, SectionHeader, Segmented, Spinner } from '../components/ui';

type Tab = 'likes' | 'recent' | 'uploads' | 'playlists';

export function LibraryPage() {
  const user = useAuth((state) => state.user);
  const pushToast = useUi((state) => state.pushToast);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('likes');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true);
    const load = async () => {
      try {
        if (tab === 'playlists') {
          const data = await api.playlists();
          if (alive) setPlaylists(data.playlists);
        } else {
          const data =
            tab === 'likes'
              ? await api.likes()
              : tab === 'recent'
                ? await api.recent()
                : await api.uploads();
          if (alive) setTracks(data.tracks);
        }
      } catch (error) {
        if (alive) pushToast((error as Error).message, 'error');
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [tab, user, pushToast]);

  const createPlaylist = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const { playlist } = await api.createPlaylist({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      setCreateOpen(false);
      setNewTitle('');
      setNewDescription('');
      pushToast('Плейлист создан', 'success');
      navigate(`/playlist/${playlist.id}`);
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const title =
    tab === 'likes'
      ? 'Избранное'
      : tab === 'recent'
        ? 'Недавно слушал'
        : tab === 'uploads'
          ? 'Мои загрузки'
          : 'Плейлисты';

  const description =
    tab === 'likes'
      ? 'Треки, которые ты сохранил'
      : tab === 'recent'
        ? 'История прослушиваний'
        : tab === 'uploads'
          ? 'Твои файлы — после проверки они появятся в каталоге'
          : 'Собери музыку под настроение';

  return (
    <motion.div className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="page-actions">
          <Link className="btn btn-ghost" to="/local">
            <HardDrive size={16} /> GitHub
          </Link>
          <button className="btn btn-ghost" onClick={() => setUploadOpen(true)}>
            <Upload size={16} /> Загрузить
          </button>
          {tab === 'playlists' ? (
            <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Плейлист
            </button>
          ) : null}
        </div>
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'likes', label: 'Избранное' },
          { value: 'recent', label: 'Недавние' },
          { value: 'uploads', label: 'Загрузки' },
          { value: 'playlists', label: 'Плейлисты' },
        ]}
      />

      {loading ? (
        <div className="skeleton-list">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="skeleton-row" />
          ))}
        </div>
      ) : tab === 'playlists' ? (
        playlists.length === 0 ? (
          <EmptyState
            icon={ListMusic}
            title="Плейлистов пока нет"
            description="Создай первый — и добавляй треки одним касанием."
            action={
              <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
                <Plus size={16} /> Создать плейлист
              </button>
            }
          />
        ) : (
          <div className="grid-cards">
            <button className="track-card new-playlist-card" onClick={() => setCreateOpen(true)}>
              <div className="card-cover">
                <div className="new-playlist-art">
                  <Plus size={30} />
                </div>
              </div>
              <div className="card-body">
                <div className="card-text">
                  <h3>Новый плейлист</h3>
                  <p>Создать подборку</p>
                </div>
              </div>
            </button>
            {playlists.map((playlist) => (
              <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="card-link">
                <PlaylistCard playlist={playlist} onClick={() => undefined} />
              </Link>
            ))}
          </div>
        )
      ) : tracks.length === 0 ? (
        <EmptyState
          icon={tab === 'likes' ? Heart : tab === 'recent' ? History : UploadCloud}
          title={
            tab === 'likes'
              ? 'Пока пусто'
              : tab === 'recent'
                ? 'Ты ещё ничего не слушал'
                : 'Загрузи свою музыку'
          }
          description={
            tab === 'likes'
              ? 'Нажимай на сердечко у трека — он появится здесь.'
              : tab === 'recent'
                ? 'Включи любой трек, и история появится автоматически.'
                : 'Свои файлы можно загрузить в пару кликов — они появятся здесь.'
          }
          action={
            tab === 'uploads' ? (
              <button className="btn btn-primary" onClick={() => setUploadOpen(true)}>
                <Upload size={16} /> Загрузить трек
              </button>
            ) : (
              <Link className="btn btn-primary" to="/search">
                Найти музыку
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="list-meta">
            <span>{tracks.length} треков</span>
            {tab === 'recent' ? <span>обновляется автоматически</span> : null}
          </div>
          <div className="track-list panel">
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                queue={tracks}
                index={index}
                onLikeChange={
                  tab === 'likes'
                    ? (liked) => {
                        if (!liked) setTracks((current) => current.filter((item) => item.id !== track.id));
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </>
      )}

      {tab === 'uploads' && tracks.length > 0 ? (
        <div className="note">
          <Library size={16} /> Черновики видишь только ты. После публикации администратором трек
          попадёт в общий каталог.
        </div>
      ) : null}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(track) => {
          setTab('uploads');
          setTracks((current) => [track, ...current.filter((item) => item.id !== track.id)]);
        }}
      />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новый плейлист">
        <div className="form-grid">
          <label className="field">
            <span>Название</span>
            <input
              className="input"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder="Например, Ночная поездка"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Описание</span>
            <textarea
              className="input"
              rows={3}
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="Пара слов о подборке"
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
            Отмена
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void createPlaylist()}
            disabled={!newTitle.trim() || creating}
          >
            {creating ? <Spinner size={16} /> : <Plus size={16} />} Создать
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}
