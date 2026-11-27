import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database, SqlValue } from '../db/index.ts';
import { currentUser, requireUser, type UserRow } from '../lib/auth.ts';
import { badRequest, forbidden, notFound } from '../lib/errors.ts';
import { mapTrack, type TrackRow } from '../lib/mappers.ts';
import { parse, pagination } from '../lib/validate.ts';

const playlistSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(80),
  description: z.string().trim().max(300).optional().nullable(),
});

interface PlaylistRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  created_at: string;
  updated_at: string;
  total?: number | string;
  cover?: string | null;
}

const mapPlaylist = (row: PlaylistRow, viewerId?: string) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  coverUrl: row.cover_url ?? row.cover ?? null,
  total: Number(row.total ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  mine: Boolean(viewerId && row.user_id === viewerId),
  shared: Boolean(viewerId && row.user_id !== viewerId),
});

async function requirePlaylist(db: Database, user: UserRow, playlistId: string) {
  const playlist = await db.get<PlaylistRow>('SELECT * FROM playlists WHERE id = ?', [playlistId]);
  if (!playlist) throw notFound('Плейлист не найден');
  if (playlist.user_id === user.id) return playlist;
  const collaborator = await db.get(
    'SELECT 1 FROM playlist_collaborators WHERE playlist_id = ? AND user_id = ?',
    [playlistId, user.id],
  );
  if (!collaborator) throw forbidden('Это чужой плейлист');
  return playlist;
}

export async function registerLibraryRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get('/api/library/likes', async (req) => {
    const user = await requireUser(req, db);
    const rows = await db.all<TrackRow>(
      `SELECT t.*, 1 AS liked FROM likes l JOIN tracks t ON t.id = l.track_id
       WHERE l.user_id = ? AND t.published = 1
       ORDER BY l.created_at DESC LIMIT 200`,
      [user.id],
    );
    return { tracks: rows.map((track) => mapTrack(track, user)) };
  });

  app.post('/api/library/likes/:trackId', async (req) => {
    const user = await requireUser(req, db);
    const { trackId } = req.params as { trackId: string };
    const track = await db.get<{ id: string }>('SELECT id FROM tracks WHERE id = ?', [trackId]);
    if (!track) throw notFound('Трек не найден');

    const existing = await db.get<{ track_id: string }>(
      'SELECT track_id FROM likes WHERE user_id = ? AND track_id = ?',
      [user.id, trackId],
    );
    if (existing) {
      await db.run('DELETE FROM likes WHERE user_id = ? AND track_id = ?', [user.id, trackId]);
      return { liked: false };
    }
    await db.run('INSERT INTO likes (user_id, track_id, created_at) VALUES (?, ?, ?)', [
      user.id,
      trackId,
      new Date().toISOString(),
    ]);
    return { liked: true };
  });

  app.get('/api/library/recent', async (req) => {
    const user = await requireUser(req, db);
    const rows = await db.all<TrackRow>(
      `SELECT t.*, MAX(p.played_at) AS last_played,
              CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS liked
       FROM plays p
       JOIN tracks t ON t.id = p.track_id
       LEFT JOIN likes l ON l.track_id = t.id AND l.user_id = ?
       WHERE p.user_id = ? AND t.published = 1
       GROUP BY t.id
       ORDER BY last_played DESC
       LIMIT 40`,
      [user.id, user.id],
    );
    return { tracks: rows.map((track) => mapTrack(track, user)) };
  });

  app.get('/api/library/uploads', async (req) => {
    const user = await requireUser(req, db);
    const rows = await db.all<TrackRow>(
      `SELECT t.*, CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS liked
       FROM tracks t LEFT JOIN likes l ON l.track_id = t.id AND l.user_id = ?
       WHERE t.uploaded_by = ? ORDER BY t.created_at DESC LIMIT 200`,
      [user.id, user.id],
    );
    return { tracks: rows.map((track) => mapTrack(track, user)) };
  });

  app.get('/api/library/playlists', async (req) => {
    const user = await requireUser(req, db);
    const rows = await db.all<PlaylistRow>(
      `SELECT p.*,
              (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS total,
              (SELECT t.cover_url FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
               WHERE pt.playlist_id = p.id ORDER BY pt.sort_order LIMIT 1) AS cover
       FROM playlists p
       LEFT JOIN playlist_collaborators c ON c.playlist_id = p.id AND c.user_id = ?
       WHERE p.user_id = ? OR c.user_id IS NOT NULL
       ORDER BY p.updated_at DESC`,
      [user.id, user.id],
    );
    return { playlists: rows.map((row) => mapPlaylist(row, user.id)) };
  });

  app.post('/api/library/playlists', async (req, reply) => {
    const user = await requireUser(req, db);
    const body = parse(playlistSchema, req.body);
    const now = new Date().toISOString();
    const playlist: PlaylistRow = {
      id: randomUUID(),
      user_id: user.id,
      title: body.title,
      description: body.description ?? null,
      cover_url: null,
      created_at: now,
      updated_at: now,
    };
    await db.run(
      `INSERT INTO playlists (id, user_id, title, description, cover_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        playlist.id,
        playlist.user_id,
        playlist.title,
        playlist.description,
        null,
        playlist.created_at,
        playlist.updated_at,
      ],
    );
    reply.code(201);
    return { playlist: mapPlaylist(playlist, user.id) };
  });

  app.get('/api/library/playlists/:id', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    const playlist = await requirePlaylist(db, user, id);
    const tracks = await db.all<TrackRow>(
      `SELECT t.*, CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS liked
       FROM playlist_tracks pt
       JOIN tracks t ON t.id = pt.track_id
       LEFT JOIN likes l ON l.track_id = t.id AND l.user_id = ?
       WHERE pt.playlist_id = ?
       ORDER BY pt.sort_order ASC, pt.added_at ASC`,
      [user.id, id],
    );
    return {
      playlist: { ...mapPlaylist(playlist, user.id), total: tracks.length },
      tracks: tracks.map((track) => mapTrack(track, user)),
    };
  });

  app.get('/api/library/playlists/:id/collaborators', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    await requirePlaylist(db, user, id);
    const rows = await db.all<{
      id: string;
      display_name: string;
      avatar_color: string;
      email: string | null;
    }>(
      `SELECT u.id, u.display_name, u.avatar_color, u.email
       FROM playlist_collaborators c JOIN users u ON u.id = c.user_id
       WHERE c.playlist_id = ?`,
      [id],
    );
    return {
      collaborators: rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        avatarColor: row.avatar_color,
        email: row.email,
      })),
    };
  });

  app.post('/api/library/playlists/:id/collaborators', async (req, reply) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    const playlist = await requirePlaylist(db, user, id);
    if (playlist.user_id !== user.id) throw forbidden('Приглашать может только владелец');
    const body = parse(z.object({ email: z.string().trim().toLowerCase().email() }), req.body);
    const target = await db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', [
      body.email,
    ]);
    if (!target) throw notFound('Пользователь с таким email не найден');
    if (target.id === user.id) throw badRequest('Это твой плейлист');
    await db.run(
      `INSERT INTO playlist_collaborators (playlist_id, user_id, created_at)
       VALUES (?, ?, ?) ON CONFLICT (playlist_id, user_id) DO NOTHING`,
      [id, target.id, new Date().toISOString()],
    );
    reply.code(201);
    return { ok: true };
  });

  app.delete('/api/library/playlists/:id/collaborators/:userId', async (req) => {
    const user = await requireUser(req, db);
    const { id, userId } = req.params as { id: string; userId: string };
    const playlist = await requirePlaylist(db, user, id);
    if (playlist.user_id !== user.id && userId !== user.id) {
      throw forbidden('Удалять участников может владелец');
    }
    await db.run('DELETE FROM playlist_collaborators WHERE playlist_id = ? AND user_id = ?', [
      id,
      userId,
    ]);
    return { ok: true };
  });

  app.patch('/api/library/playlists/:id', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    const playlist = await requirePlaylist(db, user, id);
    if (playlist.user_id !== user.id) throw forbidden('Редактировать может только владелец');
    const body = parse(playlistSchema.partial(), req.body);
    const title = body.title ?? playlist.title;
    const description =
      body.description === undefined ? playlist.description : body.description;
    await db.run(
      'UPDATE playlists SET title = ?, description = ?, updated_at = ? WHERE id = ?',
      [title, description, new Date().toISOString(), id],
    );
    return { ok: true };
  });

  app.delete('/api/library/playlists/:id', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    await requirePlaylist(db, user, id);
    if (
      (await db.get<{ user_id: string }>('SELECT user_id FROM playlists WHERE id = ?', [id]))
        ?.user_id !== user.id
    ) {
      throw forbidden('Удалить плейлист может только владелец');
    }
    await db.run('DELETE FROM playlist_tracks WHERE playlist_id = ?', [id]);
    await db.run('DELETE FROM playlists WHERE id = ?', [id]);
    return { ok: true };
  });

  app.post('/api/library/playlists/:id/tracks', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    await requirePlaylist(db, user, id);
    const body = parse(z.object({ trackId: z.string().min(1) }), req.body);
    const track = await db.get<{ id: string }>('SELECT id FROM tracks WHERE id = ?', [
      body.trackId,
    ]);
    if (!track) throw notFound('Трек не найден');

    const existing = await db.get<{ track_id: string }>(
      'SELECT track_id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?',
      [id, body.trackId],
    );
    if (existing) throw badRequest('Трек уже в плейлисте');

    const maxRow = await db.get<{ max_position: number | string | null }>(
      'SELECT MAX(sort_order) AS max_position FROM playlist_tracks WHERE playlist_id = ?',
      [id],
    );
    const position = Number(maxRow?.max_position ?? -1) + 1;
    await db.run(
      'INSERT INTO playlist_tracks (playlist_id, track_id, sort_order, added_at) VALUES (?, ?, ?, ?)',
      [id, body.trackId, position, new Date().toISOString()],
    );
    await db.run('UPDATE playlists SET updated_at = ? WHERE id = ?', [
      new Date().toISOString(),
      id,
    ]);
    return { ok: true };
  });

  app.delete('/api/library/playlists/:id/tracks/:trackId', async (req) => {
    const user = await requireUser(req, db);
    const { id, trackId } = req.params as { id: string; trackId: string };
    await requirePlaylist(db, user, id);
    await db.run('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?', [
      id,
      trackId,
    ]);
    await db.run('UPDATE playlists SET updated_at = ? WHERE id = ?', [
      new Date().toISOString(),
      id,
    ]);
    return { ok: true };
  });

  app.get('/api/library/summary', async (req) => {
    const user = await currentUser(req, db);
    if (!user) return { likes: 0, playlists: 0, plays: 0 };
    const [likes, playlists, plays] = await Promise.all([
      db.get<{ total: number | string }>('SELECT COUNT(*) AS total FROM likes WHERE user_id = ?', [
        user.id,
      ]),
      db.get<{ total: number | string }>(
        'SELECT COUNT(*) AS total FROM playlists WHERE user_id = ?',
        [user.id],
      ),
      db.get<{ total: number | string }>('SELECT COUNT(*) AS total FROM plays WHERE user_id = ?', [
        user.id,
      ]),
    ]);
    return {
      likes: Number(likes?.total ?? 0),
      playlists: Number(playlists?.total ?? 0),
      plays: Number(plays?.total ?? 0),
    };
  });
}

export type { SqlValue };
