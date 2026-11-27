import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Download,
  ListMusic,
  Loader2,
  MessageCircle,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Send,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  ScrollText,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatTime, relativeTime } from '../lib/format';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { usePlayer } from '../store/player';
import { useUi } from '../store/ui';
import { Visualizer } from './Visualizer';
import { LyricsView } from './Lyrics';
import type { Track, TrackComment } from '../types';
import { Avatar, Cover, Equalizer, Modal } from './ui';
import { LikeButton } from './Track';

export function SeekBar({
  time,
  duration,
  onSeek,
  className = '',
}: {
  time: number;
  duration: number;
  onSeek: (value: number) => void;
  className?: string;
}) {
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  return (
    <input
      type="range"
      className={`seek ${className}`}
      min={0}
      max={Math.max(duration, 1)}
      step={0.5}
      value={Math.min(time, duration || 1)}
      onChange={(event) => onSeek(Number(event.target.value))}
      style={{ ['--progress' as string]: `${progress}%` }}
      aria-label="Позиция трека"
    />
  );
}

export function PlayerBar() {
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);
  const loading = usePlayer((state) => state.loading);
  const time = usePlayer((state) => state.time);
  const duration = usePlayer((state) => state.duration);
  const volume = usePlayer((state) => state.volume);
  const muted = usePlayer((state) => state.muted);
  const repeat = usePlayer((state) => state.repeat);
  const shuffle = usePlayer((state) => state.shuffle);
  const { togglePlay, next, prev, seek, setVolume, toggleMute, cycleRepeat, toggleShuffle, setExpanded } =
    usePlayer.getState();
  const setEqOpen = useUi((state) => state.setEqOpen);

  if (!current) return null;

  return (
    <div className={`player-bar ${playing ? 'is-playing' : ''}`}>
      <div className="pb-track" onClick={() => setExpanded(true)}>
        <Cover src={current.coverUrl} color={current.color} name={current.title} size={50} rounded={12} />
        <div className="pb-meta">
          <strong>{current.title}</strong>
          <span>{current.artist}</span>
        </div>
        <LikeButton track={current} size={17} />
      </div>

      <div className="pb-center">
        <div className="pb-buttons">
          <button
            className={`icon-btn ${shuffle ? 'active' : ''}`}
            onClick={toggleShuffle}
            aria-label="Перемешать"
            title="Перемешать"
          >
            <Shuffle size={16} />
          </button>
          <button className="icon-btn" onClick={prev} aria-label="Предыдущий трек">
            <SkipBack size={19} fill="currentColor" />
          </button>
          <button className="play-btn" onClick={togglePlay} aria-label={playing ? 'Пауза' : 'Играть'}>
            {loading ? (
              <span className="btn-spinner" />
            ) : playing ? (
              <Pause size={20} fill="currentColor" />
            ) : (
              <Play size={20} fill="currentColor" />
            )}
          </button>
          <button className="icon-btn" onClick={() => next()} aria-label="Следующий трек">
            <SkipForward size={19} fill="currentColor" />
          </button>
          <button
            className={`icon-btn ${repeat !== 'off' ? 'active' : ''}`}
            onClick={cycleRepeat}
            aria-label="Повтор"
            title={repeat === 'one' ? 'Повтор трека' : repeat === 'all' ? 'Повтор очереди' : 'Повтор выключен'}
          >
            {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
          </button>
        </div>

        <div className="pb-progress">
          <span>{formatTime(time)}</span>
          <SeekBar time={time} duration={duration} onSeek={seek} />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="pb-right">
        <button
          className="icon-btn"
          onClick={() => setEqOpen(true)}
          aria-label="Эквалайзер"
          title="Эквалайзер и усиление"
        >
          <SlidersHorizontal size={18} />
        </button>
        <button className="icon-btn" onClick={toggleMute} aria-label="Звук">
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          className="volume"
          min={0}
          max={2}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          style={{ ['--progress' as string]: `${((muted ? 0 : volume) / 2) * 100}%` }}
          title={`Громкость ${Math.round((muted ? 0 : volume) * 100)}%`}
          aria-label="Громкость"
        />
        <button className="icon-btn" onClick={() => setExpanded(true)} aria-label="Развернуть плеер">
          <ListMusic size={18} />
        </button>
      </div>

      <button className="pb-mobile-expand" onClick={() => setExpanded(true)} aria-label="Открыть плеер">
        <ChevronDown size={18} className="flip" />
      </button>
    </div>
  );
}

function QueueList({ onClose }: { onClose?: () => void }) {
  const queue = usePlayer((state) => state.queue);
  const index = usePlayer((state) => state.index);
  const current = usePlayer((state) => state.current);
  const playTrack = usePlayer((state) => state.playTrack);
  const removeFromQueue = usePlayer((state) => state.removeFromQueue);

  return (
    <div className="queue-panel">
      <div className="queue-head">
        <span>Очередь · {queue.length}</span>
      </div>
      <div className="queue-list">
        {queue.map((track: Track, trackIndex: number) => (
          <div
            key={`${track.id}-${trackIndex}`}
            className={`queue-item ${track.id === current?.id ? 'active' : ''}`}
            onClick={() => {
              playTrack(track, queue);
              onClose?.();
            }}
            role="button"
            tabIndex={0}
          >
            <span className="queue-index">
              {track.id === current?.id ? <Equalizer active /> : trackIndex + 1}
            </span>
            <div className="queue-meta">
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </div>
            {trackIndex !== index ? (
              <button
                className="icon-btn subtle"
                onClick={(event) => {
                  event.stopPropagation();
                  removeFromQueue(track.id);
                }}
                aria-label="Убрать из очереди"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FullPlayer() {
  const expanded = usePlayer((state) => state.expanded);
  const current = usePlayer((state) => state.current);
  const playing = usePlayer((state) => state.playing);
  const loading = usePlayer((state) => state.loading);
  const time = usePlayer((state) => state.time);
  const duration = usePlayer((state) => state.duration);
  const repeat = usePlayer((state) => state.repeat);
  const shuffle = usePlayer((state) => state.shuffle);
  const { setExpanded, togglePlay, next, prev, seek, cycleRepeat, toggleShuffle } = usePlayer.getState();
  const setEqOpen = useUi((state) => state.setEqOpen);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<TrackComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const user = useAuth((state) => state.user);
  const offlineIds = usePlayer((state) => state.offlineIds);
  const saveTrack = usePlayer((state) => state.downloadTrack);
  const removeDownload = usePlayer((state) => state.removeDownload);
  const [downloading, setDownloading] = useState(false);
  const pushToast = useUi((state) => state.pushToast);
  const saved = current ? offlineIds.includes(current.id) : false;

  const toggleDownload = async () => {
    if (!current || downloading) return;
    if (saved) {
      await removeDownload(current.id);
      pushToast('Трек удалён из офлайна');
      return;
    }
    setDownloading(true);
    try {
      await saveTrack(current);
      pushToast('Трек сохранён для офлайна', 'success');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, setExpanded]);

  useEffect(() => {
    if (!commentsOpen || !current) return;
    api
      .comments(current.id)
      .then((data) => setComments(data.comments))
      .catch(() => undefined);
  }, [commentsOpen, current]);

  const sendComment = async () => {
    if (!current || !commentText.trim() || commentBusy) return;
    setCommentBusy(true);
    try {
      const data = await api.addComment(current.id, commentText.trim());
      setComments((items) => [data.comment, ...items]);
      setCommentText('');
    } catch (error) {
      pushToast((error as Error).message, 'error');
    } finally {
      setCommentBusy(false);
    }
  };

  const removeComment = async (id: string) => {
    try {
      await api.deleteComment(id);
      setComments((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      pushToast((error as Error).message, 'error');
    }
  };

  return (
    <>
    <AnimatePresence>
      {expanded && current ? (
        <motion.div
          className="full-player"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 32 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 140 || info.velocity.y > 700) setExpanded(false);
          }}
          style={{ ['--track-accent' as string]: current.color }}
        >
          <div className="fp-bg" aria-hidden="true">
            <div className="fp-glow" />
            {current.coverUrl ? (
              <img className="fp-bg-img" src={current.coverUrl.startsWith('http') ? current.coverUrl : current.coverUrl} alt="" />
            ) : null}
          </div>

          <header className="fp-header">
            <button className="icon-btn" onClick={() => setExpanded(false)} aria-label="Свернуть плеер">
              <ChevronDown size={22} />
            </button>
            <div className="fp-header-title">
              <span>Сейчас играет</span>
              <strong>{current.album ?? 'Maximize Musik'}</strong>
            </div>
            <button className="icon-btn" onClick={() => setExpanded(false)} aria-label="Закрыть">
              <X size={18} />
            </button>
          </header>

          <div className="fp-content">
            <div className="fp-art">
              <div className={`fp-cover ${playing ? 'playing' : ''}`}>
                <Cover
                  src={current.coverUrl}
                  color={current.color}
                  name={current.title}
                  rounded={26}
                />
                <div className="fp-vinyl" aria-hidden="true" />
              </div>
              <Visualizer />
            </div>

            <div className="fp-info">
              <div className="fp-title-row">
                <div>
                  <h1>{current.title}</h1>
                  <p>{current.artist}</p>
                </div>
                <div className="fp-actions">
                  <button
                    className="icon-btn"
                    onClick={() => void toggleDownload()}
                    title={saved ? 'Удалить из офлайна' : 'Скачать для офлайна'}
                    aria-label={saved ? 'Удалить из офлайна' : 'Скачать для офлайна'}
                    disabled={downloading}
                  >
                    {downloading ? (
                      <Loader2 size={21} className="spin" />
                    ) : saved ? (
                      <Check size={21} />
                    ) : (
                      <Download size={21} />
                    )}
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setCommentsOpen(true)}
                    title="Комментарии"
                    aria-label="Комментарии"
                  >
                    <MessageCircle size={21} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setLyricsOpen(true)}
                    title="Текст песни"
                    aria-label="Текст песни"
                  >
                    <ScrollText size={22} />
                  </button>
                  <LikeButton track={current} size={24} />
                </div>
              </div>

              <div className="fp-seek">
                <SeekBar time={time} duration={duration} onSeek={seek} />
                <div className="fp-times">
                  <span>{formatTime(time)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="fp-controls">
                <button
                  className={`icon-btn ${shuffle ? 'active' : ''}`}
                  onClick={toggleShuffle}
                  aria-label="Перемешать"
                >
                  <Shuffle size={20} />
                </button>
                <button className="icon-btn big" onClick={prev} aria-label="Предыдущий">
                  <SkipBack size={26} fill="currentColor" />
                </button>
                <button className="fp-play" onClick={togglePlay} aria-label={playing ? 'Пауза' : 'Играть'}>
                  {loading ? (
                    <span className="btn-spinner" />
                  ) : playing ? (
                    <Pause size={30} fill="currentColor" />
                  ) : (
                    <Play size={30} fill="currentColor" />
                  )}
                </button>
                <button className="icon-btn big" onClick={() => next()} aria-label="Следующий">
                  <SkipForward size={26} fill="currentColor" />
                </button>
                <button
                  className={`icon-btn ${repeat !== 'off' ? 'active' : ''}`}
                  onClick={cycleRepeat}
                  aria-label="Повтор"
                >
                  {repeat === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setEqOpen(true)}
                  aria-label="Эквалайзер"
                  title="Эквалайзер и усиление"
                >
                  <SlidersHorizontal size={20} />
                </button>
              </div>
            </div>

            <QueueList onClose={() => setExpanded(false)} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
    <Modal
      open={lyricsOpen && Boolean(current)}
      onClose={() => setLyricsOpen(false)}
      title={current ? `${current.title} — текст` : 'Текст'}
      width={560}
    >
      <div className="lyrics-box">
        <LyricsView text={current?.lyrics ?? ''} time={time} />
      </div>
    </Modal>
    <Modal
      open={commentsOpen && Boolean(current)}
      onClose={() => setCommentsOpen(false)}
      title="Комментарии"
      width={540}
    >
      <div className="comments-box">
        {user ? (
          <div className="comment-form">
            <textarea
              className="input textarea"
              rows={2}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Что думаешь об этом треке?"
              maxLength={1000}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() => void sendComment()}
              disabled={commentBusy || !commentText.trim()}
            >
              <Send size={15} /> Отправить
            </button>
          </div>
        ) : (
          <p className="hint">Войди, чтобы оставить комментарий.</p>
        )}

        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="hint">Комментариев пока нет — будь первым.</p>
          ) : (
            comments.map((comment) => (
              <article key={comment.id} className="comment">
                <Avatar
                  name={comment.user.displayName}
                  color={comment.user.avatarColor}
                  size={34}
                />
                <div>
                  <div className="comment-head">
                    <strong>{comment.user.displayName}</strong>
                    <span>{relativeTime(comment.createdAt)}</span>
                    {user && (user.id === comment.user.id || user.role === 'admin') ? (
                      <button
                        className="icon-btn subtle"
                        onClick={() => void removeComment(comment.id)}
                        aria-label="Удалить комментарий"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                  <p>{comment.body}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </Modal>
    </>
  );
}
