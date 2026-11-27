import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, mediaUrl, streamUrl } from '../lib/api';
import { audioFx, EQ_PRESETS } from '../lib/audioFx';
import {
  downloadTrack as saveOfflineTrack,
  listOffline,
  offlineObjectUrl,
  removeOffline,
  revokeOfflineUrl,
  type OfflineTrack,
} from '../lib/offline';
import { haptic } from '../lib/telegram';
import type { Track } from '../types';
import { useTheme } from './theme';
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
  speed: number;
  normalize: boolean;
  sleepUntil: number | null;
  crossfade: number;
  offlineIds: string[];

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
  setSpeed: (speed: number) => void;
  setNormalize: (enabled: boolean) => void;
  setSleepTimer: (minutes: number | null) => void;
  setCrossfade: (seconds: number) => void;
  refreshOffline: () => Promise<void>;
  downloadTrack: (track: Track) => Promise<OfflineTrack>;
  removeDownload: (id: string) => Promise<void>;
}

const audio = new Audio();
audio.preload = 'auto';
audio.preservesPitch = true;
audioFx.attach(audio);

let sleepTimeout: number | null = null;
let playToken = 0;
let fadeTimer: number | null = null;
let fadingOut = false;

function fadeAudio(target: number, duration: number): void {
  if (fadeTimer) window.clearInterval(fadeTimer);
  const start = audio.volume;
  const startedAt = performance.now();
  fadeTimer = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / Math.max(80, duration));
    audio.volume = Math.max(0, Math.min(1, start + (target - start) * progress));
    if (progress >= 1 && fadeTimer) {
      window.clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }, 50);
}

async function startPlayback(track: Track): Promise<void> {
  const token = ++playToken;
  let url = streamUrl(track);

  if (usePlayer.getState().offlineIds.includes(track.id)) {
    const offlineUrl = await offlineObjectUrl(track.id).catch(() => null);
    if (offlineUrl) url = offlineUrl;
  }

  if (token !== playToken) return;

  if (/^https?:/i.test(url)) audio.crossOrigin = 'anonymous';
  else audio.removeAttribute('crossorigin');

  audio.src = url;
  audio.currentTime = 0;
  audio.volume = 0;
  audio.load();
  void audio
    .play()
    .then(() => {
      usePlayer.setState({ playing: true, loading: false });
      fadeAudio(Math.min(1, usePlayer.getState().volume), 420);
    })
    .catch(() => usePlayer.setState({ playing: false, loading: false }));
}

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
      speed: 1,
      normalize: false,
      sleepUntil: null,
      crossfade: 0,
      offlineIds: [],

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
        audioFx.ensure();
        audioFx.setBoost(Math.max(1, get().volume));
        audioFx.setBands(get().eqBands);
        audioFx.setEnabled(get().eqEnabled);
        audioFx.setNormalization(get().normalize);
        audio.playbackRate = get().speed;
        void startPlayback(track);

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

      setSpeed: (speed) => {
        const value = Math.max(0.5, Math.min(2, Number(speed) || 1));
        audio.playbackRate = value;
        set({ speed: value });
      },

      setNormalize: (enabled) => {
        audioFx.setNormalization(enabled);
        set({ normalize: enabled });
      },

      setSleepTimer: (minutes) => {
        if (sleepTimeout) {
          window.clearTimeout(sleepTimeout);
          sleepTimeout = null;
        }
        if (!minutes || minutes <= 0) {
          set({ sleepUntil: null });
          return;
        }
        const until = Date.now() + minutes * 60 * 1000;
        set({ sleepUntil: until });
        sleepTimeout = window.setTimeout(() => {
          audio.pause();
          set({ playing: false, sleepUntil: null });
          sleepTimeout = null;
          useUi.getState().pushToast('Таймер сна: воспроизведение остановлено');
        }, minutes * 60 * 1000);
      },

      setCrossfade: (seconds) => {
        const value = Math.max(0, Math.min(8, Number(seconds) || 0));
        set({ crossfade: value });
      },

      refreshOffline: async () => {
        const rows = await listOffline();
        set({ offlineIds: rows.map((row) => row.id) });
      },

      downloadTrack: async (track) => {
        const entry = await saveOfflineTrack(track);
        set({ offlineIds: [...new Set([...get().offlineIds, track.id])] });
        return entry;
      },

      removeDownload: async (id) => {
        await removeOffline(id);
        revokeOfflineUrl(id);
        set({ offlineIds: get().offlineIds.filter((item) => item !== id) });
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
        speed: state.speed,
        normalize: state.normalize,
        crossfade: state.crossfade,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        audio.volume = Math.min(1, state.volume);
        audio.muted = state.muted;
        audio.playbackRate = state.speed ?? 1;
        audioFx.setEnabled(state.eqEnabled);
        audioFx.setBands(state.eqBands);
        audioFx.setNormalization(state.normalize);
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
      void api
        .recordPlay(state.current.id)
        .then(() => useTheme.getState().addXp(2))
        .catch(() => undefined);
    }
  }

  if (
    state.playing &&
    state.crossfade > 0 &&
    !fadingOut &&
    Number.isFinite(audio.duration) &&
    audio.duration - audio.currentTime <= state.crossfade &&
    audio.duration - audio.currentTime > 0.3
  ) {
    fadingOut = true;
    fadeAudio(0, Math.max(250, state.crossfade * 700));
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
  fadingOut = false;
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
