import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, mediaUrl, streamUrl } from '../lib/api';
import { audioFx, EQ_PRESETS } from '../lib/audioFx';
import { haptic } from '../lib/telegram';
import type { Track } from '../types';
import { useUi } from './ui';

export type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  queue: Track[];
  index: number;
  current: Track | null;
  playing: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  shuffle: boolean;
  expanded: boolean;
  loading: boolean;
  eqEnabled: boolean;
  eqBands: number[];

  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: (auto?: boolean) => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  toggleShuffle: () => void;
  setExpanded: (expanded: boolean) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (id: string) => void;
  setLiked: (trackId: string, liked: boolean) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqBand: (index: number, gain: number) => void;
  setEqPreset: (bands: number[]) => void;
  resetEq: () => void;
}

const audio = new Audio();
audio.preload = 'metadata';
audioFx.attach(audio);

let lastRecorded = '';
let lastErrorTrack = '';

function bindMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.setActionHandler('play', () => usePlayer.getState().togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => usePlayer.getState().togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack', () => usePlayer.getState().next());
    navigator.mediaSession.setActionHandler('previoustrack', () => usePlayer.getState().prev());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') usePlayer.getState().seek(details.seekTime);
    });
  } catch {
    // часть браузеров не поддерживает отдельные действия
  }
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: -1,
      current: null,
      playing: false,
      time: 0,
      duration: 0,
      volume: 0.85,
      muted: false,
      repeat: 'off',
      shuffle: false,
      expanded: false,
      loading: false,
      eqEnabled: true,
      eqBands: [...EQ_PRESETS.flat!],

      playTrack: (track, queue) => {
        const state = get();
        if (!queue && state.current?.id === track.id) {
          state.togglePlay();
          return;
        }
        const nextQueue = queue?.length
          ? queue
          : state.queue.some((item) => item.id === track.id)
            ? state.queue
            : [track];
        const index = Math.max(
          0,
          nextQueue.findIndex((item) => item.id === track.id),
        );
        lastRecorded = '';
        lastErrorTrack = '';
        set({
          queue: nextQueue,
          index,
          current: track,
          playing: true,
          time: 0,
          duration: track.duration || 0,
          loading: true,
        });
        haptic('tap');
        const url = streamUrl(track);
        if (/^https?:/i.test(url)) audio.crossOrigin = 'anonymous';
        else audio.removeAttribute('crossorigin');
        audioFx.ensure();
        audioFx.setBoost(Math.max(1, get().volume));
        audioFx.setBands(get().eqBands);
        audioFx.setEnabled(get().eqEnabled);
        audio.src = url;
        audio.currentTime = 0;
        audio.load();
        void audio
          .play()
          .then(() => set({ playing: true, loading: false }))
          .catch(() => set({ playing: false, loading: false }));

        if ('mediaSession' in navigator) {
          try {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: track.title,
              artist: track.artist,
              album: track.album ?? 'Maximize Musik',
              artwork: track.coverUrl
                ? [{ src: mediaUrl(track.coverUrl), sizes: '512x512', type: 'image/jpeg' }]
                : [],
            });
            navigator.mediaSession.playbackState = 'playing';
          } catch {
            // ignore
          }
        }
      },

      togglePlay: () => {
        const { current, playing } = get();
        if (!current) return;
        if (playing) {
          audio.pause();
          set({ playing: false });
        } else {
          audioFx.ensure();
          void audio
            .play()
            .then(() => set({ playing: true }))
            .catch(() => {
              useUi.getState().pushToast('Не удалось продолжить воспроизведение', 'error');
              set({ playing: false });
            });
        }
      },

      next: (auto = false) => {
        const { queue, index, repeat, shuffle } = get();
        if (!queue.length) return;

        if (repeat === 'one' && auto) {
          get().seek(0);
          void audio.play();
          return;
        }

        let nextIndex: number;
        if (shuffle && queue.length > 1) {
          do {
            nextIndex = Math.floor(Math.random() * queue.length);
          } while (nextIndex === index);
        } else {
          nextIndex = index + 1;
        }

        if (nextIndex >= queue.length) {
          if (repeat === 'all' || !auto) nextIndex = 0;
          else {
            set({ playing: false, time: 0 });
            audio.pause();
            return;
          }
        }
        const track = queue[nextIndex];
        if (track) get().playTrack(track, queue);
      },

      prev: () => {
        const { queue, index } = get();
        if (!queue.length) return;
        if (audio.currentTime > 4) {
          get().seek(0);
          return;
        }
        const prevIndex = index <= 0 ? queue.length - 1 : index - 1;
        const track = queue[prevIndex];
        if (track) get().playTrack(track, queue);
      },

      seek: (seconds) => {
        if (!Number.isFinite(seconds)) return;
        try {
          audio.currentTime = Math.max(0, seconds);
          set({ time: audio.currentTime });
        } catch {
          // ignore
        }
      },

      setVolume: (value) => {
        const volume = Math.min(2, Math.max(0, value));
        audio.volume = Math.min(1, volume);
        audioFx.ensure();
        audioFx.setBoost(Math.max(1, volume));
        set({ volume, muted: volume === 0 });
        if (volume > 0) audio.muted = false;
      },

      toggleMute: () => {
        const muted = !get().muted;
        audio.muted = muted;
        set({ muted });
      },

      cycleRepeat: () => {
        const order: RepeatMode[] = ['off', 'all', 'one'];
        const nextMode = order[(order.indexOf(get().repeat) + 1) % order.length]!;
        set({ repeat: nextMode });
      },

      toggleShuffle: () => set({ shuffle: !get().shuffle }),

      setExpanded: (expanded) => set({ expanded }),

      addToQueue: (track) => {
        const { queue } = get();
        if (queue.some((item) => item.id === track.id)) {
          useUi.getState().pushToast('Трек уже в очереди');
          return;
        }
        set({ queue: [...queue, track] });
        useUi.getState().pushToast('Добавлено в очередь', 'success');
      },

      removeFromQueue: (id) => {
        const { queue, current } = get();
        if (current?.id === id) return;
        set({ queue: queue.filter((item) => item.id !== id) });
      },

      setLiked: (trackId, liked) => {
        const { current, queue } = get();
        set({
          current: current && current.id === trackId ? { ...current, liked } : current,
          queue: queue.map((item) => (item.id === trackId ? { ...item, liked } : item)),
        });
      },

      setEqEnabled: (enabled) => {
        audioFx.setEnabled(enabled);
        set({ eqEnabled: enabled });
      },

      setEqBand: (index, gain) => {
        const next = [...get().eqBands];
        next[index] = Math.max(-12, Math.min(12, gain));
        audioFx.setBand(index, next[index]!);
        set({ eqBands: next });
      },

      setEqPreset: (bands) => {
        const next = [...bands];
        audioFx.setBands(next);
        set({ eqBands: next });
      },

      resetEq: () => {
        const flat = [...EQ_PRESETS.flat!];
        audioFx.setBands(flat);
        audioFx.setEnabled(true);
        set({ eqBands: flat, eqEnabled: true });
      },
    }),
    {
      name: 'mm-player',
      partialize: (state) => ({
        volume: state.volume,
        muted: state.muted,
        repeat: state.repeat,
        shuffle: state.shuffle,
        eqEnabled: state.eqEnabled,
        eqBands: state.eqBands,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        audio.volume = Math.min(1, state.volume);
        audio.muted = state.muted;
        audioFx.setEnabled(state.eqEnabled);
        audioFx.setBands(state.eqBands);
        audioFx.setBoost(Math.max(1, state.volume));
      },
    },
  ),
);

audio.addEventListener('timeupdate', () => {
  const state = usePlayer.getState();
  usePlayer.setState({ time: audio.currentTime });
  if (!state.current) return;
  if (audio.currentTime > 15 && lastRecorded !== state.current.id) {
    lastRecorded = state.current.id;
    if (!state.current.id.startsWith('gh-')) {
      void api.recordPlay(state.current.id).catch(() => undefined);
    }
  }
});

audio.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    usePlayer.setState({ duration: audio.duration, loading: false });
  }
});

audio.addEventListener('play', () => usePlayer.setState({ playing: true, loading: false }));
audio.addEventListener('pause', () => usePlayer.setState({ playing: false }));
audio.addEventListener('waiting', () => usePlayer.setState({ loading: true }));
audio.addEventListener('playing', () => usePlayer.setState({ loading: false }));

audio.addEventListener('ended', () => {
  const { repeat, next } = usePlayer.getState();
  if (repeat === 'one') {
    audio.currentTime = 0;
    void audio.play();
    return;
  }
  next(true);
});

audio.addEventListener('error', () => {
  const current = usePlayer.getState().current;
  usePlayer.setState({ playing: false, loading: false });
  if (current && lastErrorTrack !== current.id) {
    lastErrorTrack = current.id;
    useUi.getState().pushToast(`Не удалось загрузить «${current.title}»`, 'error');
  }
});

bindMediaSession();
