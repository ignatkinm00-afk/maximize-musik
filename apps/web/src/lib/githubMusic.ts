import type { Track } from '../types';

export interface GithubMusicEntry {
  id: string;
  title: string;
  artist: string;
  album?: string | null;
  genre?: string | null;
  duration?: number;
  file: string;
  cover?: string | null;
}

const musicBase = (): URL => new URL(import.meta.env.BASE_URL || '/', window.location.href);

const encodePath = (value: string) =>
  value
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');

export async function loadGithubMusic(): Promise<GithubMusicEntry[]> {
  try {
    const url = new URL('music/catalog.json', musicBase());
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) return [];
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (entry): entry is GithubMusicEntry =>
        Boolean(entry && typeof entry === 'object' && typeof entry.file === 'string'),
    );
  } catch {
    return [];
  }
}

export function githubTrack(entry: GithubMusicEntry): Track {
  const base = musicBase();
  const streamUrl = new URL(`music/${encodePath(entry.file)}`, base).href;
  const coverUrl = entry.cover
    ? new URL(`music/${encodePath(entry.cover)}`, base).href
    : null;
  return {
    id: `gh-${entry.id}`,
    title: entry.title || entry.file,
    artist: entry.artist || 'Unknown',
    album: entry.album ?? null,
    genre: entry.genre ?? null,
    duration: Math.round(Number(entry.duration) || 0),
    coverUrl,
    color: '#22d3ee',
    plays: 0,
    published: true,
    createdAt: '1970-01-01T00:00:00.000Z',
    liked: false,
    owned: false,
    streamUrl,
  };
}
