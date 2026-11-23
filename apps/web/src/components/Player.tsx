import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect } from 'react';
import { formatTime } from '../lib/format';
import { usePlayer } from '../store/player';
import type { Track } from '../types';
import { Cover, Equalizer } from './ui';
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
        <button className="icon-btn" onClick={toggleMute} aria-label="Звук">
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input
          type="range"
          className="volume"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(event) => setVolume(Number(event.target.value))}
          style={{ ['--progress' as string]: `${(muted ? 0 : volume) * 100}%` }}
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

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, setExpanded]);

  return (
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
              <div className="fp-visualizer" aria-hidden="true">
                {Array.from({ length: 26 }).map((_, index) => (
                  <i
                    key={index}
                    className={playing ? 'dancing' : ''}
                    style={{ animationDelay: `${(index % 9) * 0.11}s`, height: `${16 + ((index * 7) % 34)}px` }}
                  />
                ))}
              </div>
            </div>

            <div className="fp-info">
              <div className="fp-title-row">
                <div>
                  <h1>{current.title}</h1>
                  <p>{current.artist}</p>
                </div>
                <LikeButton track={current} size={24} />
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
              </div>
            </div>

            <QueueList onClose={() => setExpanded(false)} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
