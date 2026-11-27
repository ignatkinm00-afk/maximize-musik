import type { UserRow } from './auth.ts';

export interface TrackRow {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration: number;
  audio_url: string;
  cover_url: string | null;
  color: string;
  published: number;
  plays: number;
  uploaded_by: string | null;
  created_at: string;
  liked?: number | null;
}

export interface NotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  link: string | null;
  audience: string;
  channels: string;
  created_by: string | null;
  created_at: string;
  telegram_sent: number;
  telegram_failed: number;
  read_at?: string | null;
}

export function mapUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    avatarColor: row.avatar_color,
    telegramLinked: Boolean(row.telegram_id),
    createdAt: row.created_at,
  };
}

export function mapTrack(row: TrackRow, viewer?: UserRow | null) {
  const externalCover = row.cover_url ? /^https?:\/\//i.test(row.cover_url) : false;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    duration: Number(row.duration) || 0,
    coverUrl: externalCover ? `/api/tracks/${row.id}/cover` : row.cover_url,
    color: row.color,
    plays: Number(row.plays) || 0,
    published: Boolean(row.published),
    createdAt: row.created_at,
    liked: Boolean(row.liked),
    owned: Boolean(viewer && row.uploaded_by === viewer.id),
    streamUrl: `/api/tracks/${row.id}/stream`,
  };
}

export function mapNotification(row: NotificationRow) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    link: row.link,
    audience: row.audience,
    channels: row.channels.split(',').filter(Boolean),
    createdAt: row.created_at,
    readAt: row.read_at ?? null,
    sent: Number(row.telegram_sent) || 0,
    failed: Number(row.telegram_failed) || 0,
  };
}
