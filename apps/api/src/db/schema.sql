-- Схема переносима между SQLite (локально) и PostgreSQL (Supabase).
-- Времена храним строками ISO, флаги — INTEGER.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  telegram_id TEXT UNIQUE,
  avatar_color TEXT NOT NULL DEFAULT '#8b5cf6',
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT,
  genre TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  audio_url TEXT NOT NULL,
  cover_url TEXT,
  color TEXT NOT NULL DEFAULT '#8b5cf6',
  published INTEGER NOT NULL DEFAULT 1,
  plays INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tracks_plays ON tracks (plays);
CREATE INDEX IF NOT EXISTS idx_tracks_published ON tracks (published);
CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks (genre);

CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_track ON likes (track_id);

CREATE TABLE IF NOT EXISTS plays (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  track_id TEXT NOT NULL,
  played_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plays_user ON plays (user_id, played_at);
CREATE INDEX IF NOT EXISTS idx_plays_track ON plays (track_id);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists (user_id);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  audience TEXT NOT NULL DEFAULT 'all',
  channels TEXT NOT NULL DEFAULT 'inapp',
  created_by TEXT,
  created_at TEXT NOT NULL,
  telegram_sent INTEGER NOT NULL DEFAULT 0,
  telegram_failed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  read_at TEXT NOT NULL,
  PRIMARY KEY (notification_id, user_id)
);

CREATE TABLE IF NOT EXISTS telegram_subscribers (
  telegram_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  notifications INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
