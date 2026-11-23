import { motion } from 'framer-motion';
import { Clock3, ListMusic, Pencil, Play, Plus, Shuffle, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatTime, plural } from '../lib/format';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import type { Playlist, Track } from '../types';
import { TrackRow } from '../components/Track';
import { Cover, EmptyState, Modal, Spinner } from '../components/ui';

export function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const playTrack = usePlayer((state) => state.playTrack);
  const toggleShuffle = usePlayer((state) => state.toggleShuffle);
  const shuffle = usePlayer((state) => state.shuffle);
  const pushToast = useUi((state) => state.pushToast);

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    api
      .playlist(id)
      .then((data) => {
        if (!alive) return;
        setPlaylist(data.playlist);
        setTracks(data.tracks);
        setTitle(data.playlist.title);
        setDescription(data.playlist.description ?? '');
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const totalDuration = useMemo(
    () => tracks.reduce((sum, track) => sum + track.duration, 0),
    [tracks],
  );

  const playAll = (random = false) => {
    if (!tracks.length) return;
    if (random && !shuffle) toggleShuffle();
    const index = random ? Math.floor(Math.random() * tracks.length) : 0;
    playTrack(tracks[index]!, tracks);
  };

  const save = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await api.updatePlaylist(id, { title: title.trim(), description: description.trim() || null });
      setPlaylist((current) => (current ? { ...current, title: title.trim(), description: description.trim() || null } : current));
      setEditOpen(false);
      pushToast('Плейлист обновлён', 'success');
    } catch (err) {
      pushToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    try {
      await api.deletePlaylist(id);
      pushToast('Плейлист удалён');
      navigate('/library');
    } catch (err) {
      pushToast((err as Error).message, 'error');
    }
  };

  const removeTrack = async (trackId: string) => {
    if (!id) return;
    try {
      await api.removeFromPlaylist(id, trackId);
      setTracks((current) => current.filter((track) => track.id !== trackId));
      setPlaylist((current) => (current ? { ...current, total: Math.max(0, current.total - 1) } : current));
    } catch (err) {
      pushToast((err as Error).message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="playlist-hero skeleton-hero" />
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="page">
        <EmptyState
          icon={ListMusic}
          title="Плейлист не найден"
          description={error || 'Возможно, он был удалён.'}
          action={
            <Link className="btn btn-primary" to="/library">
              К моей музыке
            </Link>
          }
        />
      </div>
    );
  }

  const owner = playlist.mine === true;

  return (
    <motion.div className="page" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="playlist-hero">
        <Cover
          src={playlist.coverUrl ?? tracks[0]?.coverUrl}
          color={tracks[0]?.color}
          name={playlist.title}
          size={220}
          rounded={24}
          className="playlist-cover"
        />
        <div className="playlist-meta">
          <span className="eyebrow">Плейлист</span>
          <h1>{playlist.title}</h1>
          {playlist.description ? <p>{playlist.description}</p> : null}
          <div className="playlist-sub">
            <span>{tracks.length} {plural(tracks.length, 'трек', 'трека', 'треков')}</span>
            {totalDuration > 0 ? (
              <span>
                <Clock3 size={13} /> {formatTime(totalDuration)}
              </span>
            ) : null}
          </div>
          <div className="playlist-actions">
            <button className="btn btn-primary btn-lg" onClick={() => playAll()} disabled={!tracks.length}>
              <Play size={18} fill="currentColor" /> Слушать
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => playAll(true)} disabled={!tracks.length}>
              <Shuffle size={17} /> Вперемешку
            </button>
            {owner ? (
              <>
                <button className="icon-btn" onClick={() => setEditOpen(true)} aria-label="Изменить плейлист">
                  <Pencil size={17} />
                </button>
                <button className="icon-btn danger" onClick={() => setDeleteOpen(true)} aria-label="Удалить плейлист">
                  <Trash2 size={17} />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {tracks.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="В плейлисте пока пусто"
          description="Найди треки в каталоге и добавь их через меню трека."
          action={
            <Link className="btn btn-primary" to="/search">
              <Plus size={16} /> Добавить треки
            </Link>
          }
        />
      ) : (
        <div className="track-list panel">
          {tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              queue={tracks}
              index={index}
              onRemove={() => void removeTrack(track.id)}
            />
          ))}
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Изменить плейлист">
        <div className="form-grid">
          <label className="field">
            <span>Название</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>Описание</span>
            <textarea
              className="input"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setEditOpen(false)}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || !title.trim()}>
            {saving ? <Spinner size={16} /> : null} Сохранить
          </button>
        </div>
      </Modal>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Удалить плейлист?">
        <p className="muted">Плейлист «{playlist.title}» удалится навсегда. Треки из каталога останутся на месте.</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>
            Отмена
          </button>
          <button className="btn btn-danger" onClick={() => void remove()}>
            Удалить
          </button>
        </div>
      </Modal>
    </motion.div>
  );
}
