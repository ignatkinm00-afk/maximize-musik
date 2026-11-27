import {
  Check,
  Heart,
  ListPlus,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { formatTime } from '../lib/format';
import { haptic } from '../lib/telegram';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import type { Playlist, Track } from '../types';
import { Cover, Equalizer, Modal, Spinner } from './ui';

export function LikeButton({
  track,
  size = 17,
  className = '',
  onChange,
}: {
  track: Track;
  size?: number;
  className?: string;
  onChange?: (liked: boolean) => void;
}) {
  const user = useAuth((state) => state.user);
  const setLiked = usePlayer((state) => state.setLiked);
  const pushToast = useUi((state) => state.pushToast);
  const [liked, setLocalLiked] = useState(track.liked);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLocalLiked(track.liked);
  }, [track.id, track.liked]);

  if (track.id.startsWith('gh-')) return null;

  const toggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!user) {
      pushToast('Войди в аккаунт, чтобы сохранять лайки');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.toggleLike(track.id);
      setLocalLiked(result.liked);
      setLiked(track.id, result.liked);
      onChange?.(result.liked);
      haptic(result.liked ? 'success' : 'tap');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      className={`like-btn ${liked ? 'liked' : ''} ${className}`}
      onClick={(event) => void toggle(event)}
      aria-label={liked ? 'Убрать из избранного' : 'В избранное'}
    >
      <Heart size={size} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
}

export function AddToPlaylistDialog({
  track,
  open,
  onClose,
}: {
  track: Track;
  open: boolean;
  onClose: () => void;
}) {
  const pushToast = useUi((state) => state.pushToast);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .playlists()
      .then((data) => setPlaylists(data.playlists))
      .catch((error: Error) => pushToast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [open, pushToast]);

  const add = async (playlist: Playlist) => {
    if (busyId) return;
    setBusyId(playlist.id);
    try {
      await api.addToPlaylist(playlist.id, track.id);
      pushToast(`Добавлено в «${playlist.title}»`, 'success');
      onClose();
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const { playlist } = await api.createPlaylist({ title: title.trim() });
      await api.addToPlaylist(playlist.id, track.id);
      pushToast(`Плейлист «${playlist.title}» создан`, 'success');
      setTitle('');
      onClose();
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Добавить в плейлист">
      <div className="new-playlist-row">
        <input
          className="input"
          placeholder="Новый плейлист"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void create();
          }}
        />
        <button className="btn btn-primary btn-icon" onClick={() => void create()} disabled={creating || !title.trim()}>
          {creating ? <Spinner size={16} /> : <Plus size={18} />}
        </button>
      </div>

      <div className="playlist-picker">
        {loading ? <Spinner /> : null}
        {!loading && playlists.length === 0 ? (
          <p className="muted">Пока нет плейлистов — создай первый выше.</p>
        ) : null}
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            className="playlist-picker-item"
            onClick={() => void add(playlist)}
            disabled={busyId === playlist.id}
          >
            <Cover src={playlist.coverUrl} name={playlist.title} size={42} rounded={10} />
            <span>
              <strong>{playlist.title}</strong>
              <small>{playlist.total} треков</small>
            </span>
            {busyId === playlist.id ? <Spinner size={16} /> : <Plus size={18} />}
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function TrackMenu({
  track,
  onRemove,
}: {
  track: Track;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const addToQueue = usePlayer((state) => state.addToQueue);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="track-menu" ref={ref}>
      <button
        className="icon-btn subtle"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        aria-label="Действия с треком"
      >
        <MoreHorizontal size={18} />
      </button>

      {open ? (
        <div className="dropdown" onClick={(event) => event.stopPropagation()}>
          <button
            onClick={() => {
              addToQueue(track);
              setOpen(false);
            }}
          >
            <ListPlus size={16} /> В очередь
          </button>
          <button
            onClick={() => {
              setPlaylistOpen(true);
              setOpen(false);
            }}
          >
            <Plus size={16} /> В плейлист
          </button>
          {onRemove ? (
            <button
              className="danger"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
            >
              <Trash2 size={16} /> Убрать из плейлиста
            </button>
          ) : null}
        </div>
      ) : null}

      <AddToPlaylistDialog track={track} open={playlistOpen} onClose={() => setPlaylistOpen(false)} />
    </div>
  );
}

export function TrackRow({
  track,
  queue,
  index,
  onRemove,
  showCover = true,
  onLikeChange,
}: {
  track: Track;
  queue?: Track[];
  index?: number;
  onRemove?: () => void;
  showCover?: boolean;
  onLikeChange?: (liked: boolean) => void;
}) {
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);
  const playTrack = usePlayer((state) => state.playTrack);
  const isActive = current?.id === track.id;

  return (
    <div
      className={`track-row ${isActive ? 'is-active' : ''}`}
      onClick={() => playTrack(track, queue)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') playTrack(track, queue);
      }}
      role="button"
      tabIndex={0}
    >
      <div className="row-index">
        {isActive && playing ? (
          <Equalizer active />
        ) : (
          <>
            <span className="row-number">{typeof index === 'number' ? index + 1 : ''}</span>
            <Play size={15} className="row-play" fill="currentColor" />
          </>
        )}
      </div>

      {showCover ? <Cover src={track.coverUrl} color={track.color} name={track.title} size={46} rounded={11} /> : null}

      <div className="row-main">
        <span className="row-title">
          {track.title}
          {!track.published ? <em className="badge badge-draft">черновик</em> : null}
        </span>
        <span className="row-artist">
          {track.artist}
          {track.album ? <span className="row-album"> · {track.album}</span> : null}
        </span>
      </div>

      {track.genre ? <span className="row-genre">{track.genre}</span> : null}

      <LikeButton track={track} onChange={onLikeChange} />
      <span className="row-duration">{formatTime(track.duration)}</span>
      {track.id.startsWith('gh-') ? null : <TrackMenu track={track} onRemove={onRemove} />}
    </div>
  );
}

export function TrackCard({ track, queue }: { track: Track; queue?: Track[] }) {
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);
  const playTrack = usePlayer((state) => state.playTrack);
  const isActive = current?.id === track.id;

  return (
    <article className={`track-card ${isActive ? 'is-active' : ''}`}>
      <div className="card-cover">
        <Cover src={track.coverUrl} color={track.color} name={track.title} rounded={18} />
        <button
          className="card-play"
          onClick={() => playTrack(track, queue)}
          aria-label={isActive && playing ? 'Пауза' : 'Слушать'}
        >
          {isActive && playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
        </button>
        <span className="card-plays">{track.plays > 0 ? `${track.plays} прослуш.` : 'новинка'}</span>
      </div>
      <div className="card-body">
        <div className="card-text">
          <h3 title={track.title}>{track.title}</h3>
          <p title={track.artist}>{track.artist}</p>
        </div>
        <LikeButton track={track} size={16} />
      </div>
    </article>
  );
}

export function PlaylistCard({ playlist, onClick }: { playlist: Playlist; onClick: () => void }) {
  return (
    <button className="track-card playlist-card" onClick={onClick}>
      <div className="card-cover">
        <Cover src={playlist.coverUrl} name={playlist.title} rounded={18} />
        <span className="card-badge">
          {playlist.total} <Check size={12} />
        </span>
      </div>
      <div className="card-body">
        <div className="card-text">
          <h3>{playlist.title}</h3>
          <p>{playlist.description || `${playlist.total} треков`}</p>
        </div>
      </div>
    </button>
  );
}
