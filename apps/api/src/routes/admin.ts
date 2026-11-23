import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fetchAudiusCatalog } from '../db/audius.ts';
import { insertCatalogTracks } from '../db/bootstrap.ts';
import type { Database } from '../db/index.ts';
import { nowIso } from '../db/index.ts';
import { requireAdmin, type UserRow } from '../lib/auth.ts';
import { badRequest, notFound } from '../lib/errors.ts';
import { mapNotification, mapTrack, type NotificationRow, type TrackRow } from '../lib/mappers.ts';
import { telegram } from '../lib/telegram.ts';
import { parse, pagination } from '../lib/validate.ts';

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e'];
const pickColor = () => COLORS[Math.floor(Math.random() * COLORS.length)]!;

const trackSchema = z.object({
  title: z.string().trim().min(1, 'Введите название').max(140),
  artist: z.string().trim().min(1, 'Введите исполнителя').max(140),
  album: z.string().trim().max(140).optional().nullable(),
  genre: z.string().trim().max(60).optional().nullable(),
  duration: z.coerce.number().int().min(0).max(36000).optional(),
  audioUrl: z.string().trim().min(3, 'Нужна ссылка на аудио').max(2000),
  coverUrl: z.string().trim().max(2000).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  published: z.boolean().optional(),
});

const broadcastSchema = z.object({
  title: z.string().trim().min(1, 'Введите заголовок').max(120),
  body: z.string().trim().min(1, 'Введите текст').max(2000),
  link: z.string().trim().max(300).optional().nullable(),
  audience: z.enum(['all', 'users', 'admins']).default('all'),
  channels: z
    .array(z.enum(['inapp', 'telegram']))
    .min(1, 'Выберите хотя бы один канал')
    .default(['inapp']),
});

const userPatchSchema = z.object({
  role: z.enum(['user', 'admin']).optional(),
  banned: z.boolean().optional(),
});

export async function registerAdminRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get('/api/admin/stats', async (req) => {
    await requireAdmin(req, db);

    const count = async (sql: string, params: Array<string | number> = []) => {
      const row = await db.get<{ total: number | string }>(sql, params);
      return Number(row?.total ?? 0);
    };

    const since14 = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
    const dailyRows = await db.all<{ day: string; total: number | string }>(
      `SELECT substr(played_at, 1, 10) AS day, COUNT(*) AS total
       FROM plays WHERE played_at >= ?
       GROUP BY substr(played_at, 1, 10) ORDER BY day ASC`,
      [since14],
    );
    const dailyMap = new Map(dailyRows.map((row) => [row.day, Number(row.total)]));
    const daily: Array<{ day: string; total: number }> = [];
    for (let index = 13; index >= 0; index -= 1) {
      const day = new Date(Date.now() - index * 86400000).toISOString().slice(0, 10);
      daily.push({ day, total: dailyMap.get(day) ?? 0 });
    }

    const topTracks = await db.all<TrackRow>(
      'SELECT * FROM tracks WHERE published = 1 ORDER BY plays DESC LIMIT 5',
    );
    const recentUsers = await db.all<UserRow>(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT 6',
    );

    return {
      totals: {
        users: await count('SELECT COUNT(*) AS total FROM users'),
        admins: await count("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'"),
        tracks: await count('SELECT COUNT(*) AS total FROM tracks'),
        unpublished: await count('SELECT COUNT(*) AS total FROM tracks WHERE published = 0'),
        plays: await count('SELECT COUNT(*) AS total FROM plays'),
        likes: await count('SELECT COUNT(*) AS total FROM likes'),
        playlists: await count('SELECT COUNT(*) AS total FROM playlists'),
        subscribers: await count('SELECT COUNT(*) AS total FROM telegram_subscribers'),
        notifications: await count('SELECT COUNT(*) AS total FROM notifications'),
        playsToday: await count("SELECT COUNT(*) AS total FROM plays WHERE played_at >= ?", [
          new Date().toISOString().slice(0, 10),
        ]),
      },
      daily,
      topTracks: topTracks.map((track) => mapTrack(track)),
      recentUsers: recentUsers.map((user) => ({
        id: user.id,
        displayName: user.display_name,
        email: user.email,
        role: user.role,
        banned: Boolean(user.banned),
        createdAt: user.created_at,
      })),
      bot: { configured: telegram.configured, live: telegram.live },
    };
  });

  app.get('/api/admin/users', async (req) => {
    await requireAdmin(req, db);
    const query = parse(
      pagination.extend({ q: z.string().trim().max(120).optional() }),
      req.query,
    );
    const params: Array<string | number> = [];
    let where = '';
    if (query.q) {
      const like = `%${query.q.toLowerCase()}%`;
      where = 'WHERE LOWER(display_name) LIKE ? OR COALESCE(LOWER(email), \'\') LIKE ?';
      params.push(like, like);
    }
    const rows = await db.all<UserRow>(
      `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, query.limit, query.offset],
    );
    const total = await db.get<{ total: number | string }>(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params,
    );
    return {
      users: rows.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        banned: Boolean(user.banned),
        telegramLinked: Boolean(user.telegram_id),
        createdAt: user.created_at,
        lastSeenAt: user.last_seen_at,
      })),
      total: Number(total?.total ?? 0),
    };
  });

  app.patch('/api/admin/users/:id', async (req) => {
    const admin = await requireAdmin(req, db);
    const { id } = req.params as { id: string };
    const body = parse(userPatchSchema, req.body);
    const target = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
    if (!target) throw notFound('Пользователь не найден');
    if (target.id === admin.id && (body.role === 'user' || body.banned === true)) {
      throw badRequest('Нельзя понизить или заблокировать самого себя');
    }
    await db.run('UPDATE users SET role = ?, banned = ? WHERE id = ?', [
      body.role ?? target.role,
      body.banned === undefined ? target.banned : body.banned ? 1 : 0,
      id,
    ]);
    return { ok: true };
  });

  app.get('/api/admin/tracks', async (req) => {
    await requireAdmin(req, db);
    const query = parse(
      pagination.extend({
        q: z.string().trim().max(120).optional(),
        status: z.enum(['all', 'published', 'draft']).default('all'),
      }),
      req.query,
    );
    const params: Array<string | number> = [];
    const where: string[] = [];
    if (query.q) {
      const like = `%${query.q.toLowerCase()}%`;
      where.push('(LOWER(title) LIKE ? OR LOWER(artist) LIKE ?)');
      params.push(like, like);
    }
    if (query.status === 'published') where.push('published = 1');
    if (query.status === 'draft') where.push('published = 0');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await db.all<TrackRow>(
      `SELECT * FROM tracks ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, query.limit, query.offset],
    );
    const total = await db.get<{ total: number | string }>(
      `SELECT COUNT(*) AS total FROM tracks ${whereSql}`,
      params,
    );
    return { tracks: rows.map((track) => mapTrack(track)), total: Number(total?.total ?? 0) };
  });

  app.post('/api/admin/tracks', async (req, reply) => {
    const admin = await requireAdmin(req, db);
    const body = parse(trackSchema, req.body);
    const id = randomUUID();
    await db.run(
      `INSERT INTO tracks (id, title, artist, album, genre, duration, audio_url, cover_url, color, published, plays, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        body.title,
        body.artist,
        body.album ?? null,
        body.genre ?? null,
        body.duration ?? 0,
        body.audioUrl,
        body.coverUrl ?? null,
        body.color ?? pickColor(),
        body.published === false ? 0 : 1,
        admin.id,
        nowIso(),
      ],
    );
    const track = await db.get<TrackRow>('SELECT * FROM tracks WHERE id = ?', [id]);
    reply.code(201);
    return { track: mapTrack(track!) };
  });

  app.patch('/api/admin/tracks/:id', async (req) => {
    await requireAdmin(req, db);
    const { id } = req.params as { id: string };
    const track = await db.get<TrackRow>('SELECT * FROM tracks WHERE id = ?', [id]);
    if (!track) throw notFound('Трек не найден');
    const body = parse(trackSchema.partial(), req.body);
    await db.run(
      `UPDATE tracks SET title = ?, artist = ?, album = ?, genre = ?, duration = ?,
        audio_url = ?, cover_url = ?, color = ?, published = ? WHERE id = ?`,
      [
        body.title ?? track.title,
        body.artist ?? track.artist,
        body.album === undefined ? track.album : body.album,
        body.genre === undefined ? track.genre : body.genre,
        body.duration ?? track.duration,
        body.audioUrl ?? track.audio_url,
        body.coverUrl === undefined ? track.cover_url : body.coverUrl,
        body.color ?? track.color,
        body.published === undefined ? track.published : body.published ? 1 : 0,
        id,
      ],
    );
    const updated = await db.get<TrackRow>('SELECT * FROM tracks WHERE id = ?', [id]);
    return { track: mapTrack(updated!) };
  });

  app.delete('/api/admin/tracks/:id', async (req) => {
    await requireAdmin(req, db);
    const { id } = req.params as { id: string };
    await db.run('DELETE FROM playlist_tracks WHERE track_id = ?', [id]);
    await db.run('DELETE FROM likes WHERE track_id = ?', [id]);
    await db.run('DELETE FROM plays WHERE track_id = ?', [id]);
    await db.run('DELETE FROM tracks WHERE id = ?', [id]);
    return { ok: true };
  });

  app.post('/api/admin/catalog/audius', async (req) => {
    await requireAdmin(req, db);
    const catalog = await fetchAudiusCatalog(150);
    if (catalog.length === 0) throw badRequest('Audius вернул пустой каталог');
    const added = await insertCatalogTracks(db, catalog, { skipExisting: true });
    const total = await db.get<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM tracks',
    );
    return { fetched: catalog.length, added, total: Number(total?.total ?? 0) };
  });

  app.get('/api/admin/notifications', async (req) => {
    await requireAdmin(req, db);
    const query = parse(pagination, req.query);
    const rows = await db.all<NotificationRow>(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [query.limit, query.offset],
    );
    const total = await db.get<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM notifications',
    );
    return {
      notifications: rows.map(mapNotification),
      total: Number(total?.total ?? 0),
      bot: { configured: telegram.configured, live: telegram.live },
    };
  });

  app.post('/api/admin/notifications', async (req, reply) => {
    const admin = await requireAdmin(req, db);
    const body = parse(broadcastSchema, req.body);
    const id = randomUUID();
    const channels = [...new Set(body.channels)].join(',');
    const createdAt = nowIso();

    await db.run(
      `INSERT INTO notifications (id, user_id, title, body, link, audience, channels, created_by, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.title,
        body.body,
        body.link ?? null,
        body.audience,
        channels,
        admin.id,
        createdAt,
      ],
    );

    let telegramQueued = false;
    if (body.channels.includes('telegram') && telegram.live) {
      telegramQueued = true;
      void telegram
        .broadcast({ id, title: body.title, body: body.body, link: body.link ?? null })
        .catch((error) => console.error('[broadcast]', error));
    }

    reply.code(201);
    return {
      notification: mapNotification({
        id,
        user_id: null,
        title: body.title,
        body: body.body,
        link: body.link ?? null,
        audience: body.audience,
        channels,
        created_by: admin.id,
        created_at: createdAt,
        telegram_sent: 0,
        telegram_failed: 0,
      }),
      telegramQueued,
    };
  });

  app.get('/api/admin/subscribers', async (req) => {
    await requireAdmin(req, db);
    const total = await db.get<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM telegram_subscribers',
    );
    const muted = await db.get<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM telegram_subscribers WHERE notifications = 0',
    );
    const recent = await db.all<{
      telegram_id: string;
      username: string | null;
      first_name: string | null;
      created_at: string;
    }>(
      'SELECT telegram_id, username, first_name, created_at FROM telegram_subscribers ORDER BY created_at DESC LIMIT 20',
    );
    return {
      total: Number(total?.total ?? 0),
      muted: Number(muted?.total ?? 0),
      recent,
      bot: { configured: telegram.configured, live: telegram.live },
    };
  });
}
