import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database } from '../db/index.ts';
import { nowIso } from '../db/index.ts';
import { currentUser, requireUser, type UserRow } from '../lib/auth.ts';
import { badRequest, forbidden, notFound } from '../lib/errors.ts';
import { mapTrack, mapUser, type TrackRow } from '../lib/mappers.ts';
import { collectStats } from '../lib/stats.ts';
import { parse } from '../lib/validate.ts';

const commentSchema = z.object({
  body: z.string().trim().min(1, 'Напиши комментарий').max(1000),
});

const roomSchema = z.object({
  name: z.string().trim().min(2, 'Название минимум 2 символа').max(60),
  trackId: z.string().trim().nullable().optional(),
});

const roomStateSchema = z.object({
  trackId: z.string().nullable().optional(),
  playing: z.boolean().optional(),
  position: z.coerce.number().min(0).max(36000).optional(),
});

export async function registerSocialRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get('/api/users/:id', async (req) => {
    const { id } = req.params as { id: string };
    const viewer = await currentUser(req, db);
    const target = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    if (!target) throw notFound('Пользователь не найден');

    const stats = await collectStats(db, target.id);
    const isFollowing = viewer
      ? Boolean(
          await db.get('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?', [
            viewer.id,
            target.id,
          ]),
        )
      : false;

    const topTracks = await db.all<TrackRow>(
      `SELECT t.* FROM plays p JOIN tracks t ON t.id = p.track_id
       WHERE p.user_id = ? AND t.published = 1
       GROUP BY t.id ORDER BY COUNT(*) DESC LIMIT 6`,
      [target.id],
    );

    return {
      user: mapUser(target),
      stats,
      isFollowing,
      isMe: viewer?.id === target.id,
      topTracks: topTracks.map((row) => mapTrack(row, viewer)),
    };
  });

  app.post('/api/users/:id/follow', async (req) => {
    const viewer = await requireUser(req, db);
    const { id } = req.params as { id: string };
    if (id === viewer.id) throw badRequest('Нельзя подписаться на себя');
    const target = await db.get<{ id: string }>('SELECT id FROM users WHERE id = ?', [id]);
    if (!target) throw notFound('Пользователь не найден');

    const existing = await db.get(
      'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
      [viewer.id, id],
    );
    if (existing) {
      await db.run('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [
        viewer.id,
        id,
      ]);
      return { following: false };
    }
    await db.run('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)', [
      viewer.id,
      id,
      nowIso(),
    ]);
    return { following: true };
  });

  app.get('/api/users/:id/followers', async (req) => {
    const { id } = req.params as { id: string };
    const rows = await db.all<UserRow>(
      `SELECT u.* FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = ? ORDER BY f.created_at DESC LIMIT 100`,
      [id],
    );
    return { users: rows.map(mapUser) };
  });

  app.get('/api/users/:id/following', async (req) => {
    const { id } = req.params as { id: string };
    const rows = await db.all<UserRow>(
      `SELECT u.* FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = ? ORDER BY f.created_at DESC LIMIT 100`,
      [id],
    );
    return { users: rows.map(mapUser) };
  });

  app.get('/api/feed', async (req) => {
    const viewer = await requireUser(req, db);
    const query = parse(
      z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }),
      req.query,
    );

    const plays = await db.all<{
      id: string;
      created_at: string;
      display_name: string;
      avatar_color: string;
      title: string;
      artist: string;
      track_id: string;
    }>(
      `SELECT p.id, p.played_at AS created_at, u.display_name, u.avatar_color,
              t.title, t.artist, t.id AS track_id
       FROM plays p
       JOIN follows f ON f.following_id = p.user_id
       JOIN users u ON u.id = p.user_id
       JOIN tracks t ON t.id = p.track_id
       WHERE f.follower_id = ?
       ORDER BY p.played_at DESC LIMIT ?`,
      [viewer.id, query.limit],
    );

    const comments = await db.all<{
      id: string;
      created_at: string;
      display_name: string;
      avatar_color: string;
      body: string;
      track_id: string;
      title: string;
      artist: string;
    }>(
      `SELECT c.id, c.created_at, u.display_name, u.avatar_color, c.body,
              t.id AS track_id, t.title, t.artist
       FROM comments c
       JOIN follows f ON f.following_id = c.user_id
       JOIN users u ON u.id = c.user_id
       JOIN tracks t ON t.id = c.track_id
       WHERE f.follower_id = ?
       ORDER BY c.created_at DESC LIMIT ?`,
      [viewer.id, query.limit],
    );

    const items = [
      ...plays.map((row) => ({
        id: `play-${row.id}`,
        type: 'play' as const,
        createdAt: row.created_at,
        user: { displayName: row.display_name, avatarColor: row.avatar_color },
        track: { id: row.track_id, title: row.title, artist: row.artist },
        text: null,
      })),
      ...comments.map((row) => ({
        id: `comment-${row.id}`,
        type: 'comment' as const,
        createdAt: row.created_at,
        user: { displayName: row.display_name, avatarColor: row.avatar_color },
        track: { id: row.track_id, title: row.title, artist: row.artist },
        text: row.body,
      })),
    ]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, query.limit);

    return { items };
  });

  app.get('/api/tracks/:id/comments', async (req) => {
    const { id } = req.params as { id: string };
    const rows = await db.all<{
      id: string;
      body: string;
      created_at: string;
      user_id: string;
      display_name: string;
      avatar_color: string;
    }>(
      `SELECT c.id, c.body, c.created_at, c.user_id, u.display_name, u.avatar_color
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.track_id = ? ORDER BY c.created_at DESC LIMIT 100`,
      [id],
    );
    return {
      comments: rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        user: {
          id: row.user_id,
          displayName: row.display_name,
          avatarColor: row.avatar_color,
        },
      })),
    };
  });

  app.post(
    '/api/tracks/:id/comments',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const user = await requireUser(req, db);
      const { id } = req.params as { id: string };
      const body = parse(commentSchema, req.body);
      const track = await db.get('SELECT id FROM tracks WHERE id = ? AND published = 1', [id]);
      if (!track) throw notFound('Трек не найден');

      const commentId = randomUUID();
      await db.run(
        'INSERT INTO comments (id, track_id, user_id, body, created_at) VALUES (?, ?, ?, ?, ?)',
        [commentId, id, user.id, body.body, nowIso()],
      );
      reply.code(201);
      return {
        comment: {
          id: commentId,
          body: body.body,
          createdAt: nowIso(),
          user: {
            id: user.id,
            displayName: user.display_name,
            avatarColor: user.avatar_color,
          },
        },
      };
    },
  );

  app.delete('/api/comments/:id', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    const comment = await db.get<{ user_id: string }>(
      'SELECT user_id FROM comments WHERE id = ?',
      [id],
    );
    if (!comment) throw notFound('Комментарий не найден');
    if (comment.user_id !== user.id && user.role !== 'admin') {
      throw forbidden('Можно удалять только свои комментарии');
    }
    await db.run('DELETE FROM comments WHERE id = ?', [id]);
    return { ok: true };
  });

  app.get('/api/me/stats', async (req) => {
    const user = await requireUser(req, db);
    return { stats: await collectStats(db, user.id) };
  });

  app.get('/api/leaderboard', async (req) => {
    const rows = await db.all<{
      id: string;
      display_name: string;
      avatar_color: string;
      plays: number | string;
    }>(
      `SELECT u.id, u.display_name, u.avatar_color, COUNT(p.id) AS plays
       FROM users u LEFT JOIN plays p ON p.user_id = u.id
       GROUP BY u.id ORDER BY plays DESC, u.created_at ASC LIMIT 20`,
    );
    return {
      users: rows.map((row, index) => ({
        position: index + 1,
        id: row.id,
        displayName: row.display_name,
        avatarColor: row.avatar_color,
        plays: Number(row.plays) || 0,
      })),
    };
  });

  app.get('/api/recommendations', async (req) => {
    const viewer = await currentUser(req, db);
    const genreRows = viewer
      ? await db.all<{ genre: string; total: number | string }>(
          `SELECT t.genre, COUNT(*) AS total FROM plays p
           JOIN tracks t ON t.id = p.track_id
           WHERE p.user_id = ? AND t.genre IS NOT NULL
           GROUP BY t.genre ORDER BY total DESC LIMIT 3`,
          [viewer.id],
        )
      : await db.all<{ genre: string; total: number | string }>(
          `SELECT genre, COUNT(*) AS total FROM tracks
           WHERE published = 1 AND genre IS NOT NULL
           GROUP BY genre ORDER BY total DESC LIMIT 3`,
        );

    const genres = genreRows.map((row) => row.genre);
    const mixes: Array<{ title: string; genre: string; tracks: ReturnType<typeof mapTrack>[] }> = [];

    for (const genre of genres) {
      const rows = await db.all<TrackRow>(
        `SELECT * FROM tracks WHERE published = 1 AND genre = ?
         ORDER BY RANDOM() LIMIT 12`,
        [genre],
      );
      if (rows.length) {
        mixes.push({
          title: `Daily Mix: ${genre}`,
          genre,
          tracks: rows.map((row) => mapTrack(row, viewer)),
        });
      }
    }

    if (!mixes.length) {
      const rows = await db.all<TrackRow>(
        'SELECT * FROM tracks WHERE published = 1 ORDER BY plays DESC LIMIT 12',
      );
      mixes.push({
        title: 'Для тебя',
        genre: 'Разное',
        tracks: rows.map((row) => mapTrack(row, viewer)),
      });
    }

    return { mixes };
  });

  app.get('/api/radio', async (req) => {
    const query = parse(
      z.object({ genre: z.string().trim().max(60).optional() }),
      req.query,
    );
    const rows = query.genre
      ? await db.all<TrackRow>(
          'SELECT * FROM tracks WHERE published = 1 AND genre = ? ORDER BY RANDOM() LIMIT 40',
          [query.genre],
        )
      : await db.all<TrackRow>(
          'SELECT * FROM tracks WHERE published = 1 ORDER BY RANDOM() LIMIT 40',
        );
    return { tracks: rows.map((row) => mapTrack(row)) };
  });

  app.get('/api/year-review', async (req) => {
    const user = await requireUser(req, db);
    const year = new Date().getFullYear();
    const start = `${year}-01-01`;

    const totals = await db.get<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM plays WHERE user_id = ? AND played_at >= ?',
      [user.id, start],
    );
    const topTracks = await db.all<TrackRow>(
      `SELECT t.*, COUNT(*) AS play_count FROM plays p JOIN tracks t ON t.id = p.track_id
       WHERE p.user_id = ? AND p.played_at >= ?
       GROUP BY t.id ORDER BY play_count DESC LIMIT 10`,
      [user.id, start],
    );
    const genres = await db.all<{ genre: string; total: number | string }>(
      `SELECT t.genre, COUNT(*) AS total FROM plays p JOIN tracks t ON t.id = p.track_id
       WHERE p.user_id = ? AND p.played_at >= ? AND t.genre IS NOT NULL
       GROUP BY t.genre ORDER BY total DESC LIMIT 5`,
      [user.id, start],
    );
    const likes = await db.get<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM likes WHERE user_id = ? AND created_at >= ?',
      [user.id, start],
    );

    return {
      year,
      plays: Number(totals?.total ?? 0),
      minutes: Math.round((Number(totals?.total ?? 0) * 3.4)),
      likes: Number(likes?.total ?? 0),
      topTracks: topTracks.map((row) => mapTrack(row, user)),
      genres: genres.map((row) => ({ genre: row.genre, total: Number(row.total) })),
    };
  });

  app.get('/api/rooms', async () => {
    const rows = await db.all<{
      id: string;
      name: string;
      host_id: string;
      display_name: string;
      track_id: string | null;
      playing: number;
      position: number;
      members: number | string;
    }>(
      `SELECT r.*, u.display_name,
              (SELECT COUNT(*) FROM room_members m WHERE m.room_id = r.id) AS members
       FROM rooms r JOIN users u ON u.id = r.host_id
       ORDER BY r.created_at DESC LIMIT 40`,
    );
    return {
      rooms: rows.map((row) => ({
        id: row.id,
        name: row.name,
        hostId: row.host_id,
        hostName: row.display_name,
        trackId: row.track_id,
        playing: Boolean(row.playing),
        position: Number(row.position) || 0,
        members: Number(row.members) || 0,
      })),
    };
  });

  app.post('/api/rooms', async (req, reply) => {
    const user = await requireUser(req, db);
    const body = parse(roomSchema, req.body);
    const id = randomUUID();
    const now = nowIso();
    await db.run(
      `INSERT INTO rooms (id, host_id, name, track_id, playing, position, updated_at, created_at)
       VALUES (?, ?, ?, ?, 0, 0, ?, ?)`,
      [id, user.id, body.name, body.trackId ?? null, now, now],
    );
    await db.run('INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)', [
      id,
      user.id,
      now,
    ]);
    reply.code(201);
    return { room: { id, name: body.name, hostId: user.id, trackId: body.trackId ?? null } };
  });

  app.get('/api/rooms/:id', async (req) => {
    const { id } = req.params as { id: string };
    const room = await db.get<{
      id: string;
      name: string;
      host_id: string;
      track_id: string | null;
      playing: number;
      position: number;
      updated_at: string;
    }>('SELECT * FROM rooms WHERE id = ?', [id]);
    if (!room) throw notFound('Комната не найдена');

    const members = await db.all<{ user_id: string; display_name: string; avatar_color: string }>(
      `SELECT u.id AS user_id, u.display_name, u.avatar_color
       FROM room_members m JOIN users u ON u.id = m.user_id WHERE m.room_id = ?`,
      [id],
    );

    const track = room.track_id
      ? await db.get<TrackRow>('SELECT * FROM tracks WHERE id = ?', [room.track_id])
      : null;

    return {
      room: {
        id: room.id,
        name: room.name,
        hostId: room.host_id,
        trackId: room.track_id,
        playing: Boolean(room.playing),
        position: Number(room.position) || 0,
        updatedAt: room.updated_at,
        track: track ? mapTrack(track) : null,
        members: members.map((row) => ({
          id: row.user_id,
          displayName: row.display_name,
          avatarColor: row.avatar_color,
        })),
      },
    };
  });

  app.post('/api/rooms/:id/join', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    const room = await db.get('SELECT id FROM rooms WHERE id = ?', [id]);
    if (!room) throw notFound('Комната не найдена');
    await db.run(
      `INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [id, user.id, nowIso()],
    );
    return { ok: true };
  });

  app.post('/api/rooms/:id/leave', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    await db.run('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [id, user.id]);
    return { ok: true };
  });

  app.patch('/api/rooms/:id', async (req) => {
    const user = await requireUser(req, db);
    const { id } = req.params as { id: string };
    const room = await db.get<{ host_id: string }>('SELECT host_id FROM rooms WHERE id = ?', [id]);
    if (!room) throw notFound('Комната не найдена');
    if (room.host_id !== user.id) throw forbidden('Управлять комнатой может только хост');
    const body = parse(roomStateSchema, req.body);
    await db.run(
      `UPDATE rooms SET track_id = COALESCE(?, track_id), playing = COALESCE(?, playing),
       position = COALESCE(?, position), updated_at = ? WHERE id = ?`,
      [
        body.trackId === undefined ? null : body.trackId,
        body.playing === undefined ? null : body.playing ? 1 : 0,
        body.position === undefined ? null : Math.round(body.position),
        nowIso(),
        id,
      ],
    );
    return { ok: true };
  });
}
