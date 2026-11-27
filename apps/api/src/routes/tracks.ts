import fs from 'node:fs';
import { createReadStream } from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Database, SqlValue } from '../db/index.ts';
import { currentUser, requireUser, type UserRow } from '../lib/auth.ts';
import { forbidden, notFound } from '../lib/errors.ts';
import { mapTrack, type TrackRow } from '../lib/mappers.ts';
import { isLocalMedia, localMediaPath } from '../lib/storage.ts';
import { parse, pagination } from '../lib/validate.ts';

const trackQuery = pagination.extend({
  q: z.string().trim().max(120).optional(),
  genre: z.string().trim().max(60).optional(),
  sort: z.enum(['new', 'top']).default('new'),
});

type TrackWithLiked = TrackRow;

async function listTracks(
  db: Database,
  viewerId: string,
  options: { q?: string; genre?: string; sort: 'new' | 'top'; limit: number; offset: number },
) {
  const where: string[] = ['t.published = 1'];
  const filters: SqlValue[] = [];

  if (options.q) {
    const like = `%${options.q.toLowerCase()}%`;
    where.push(
      '(LOWER(t.title) LIKE ? OR LOWER(t.artist) LIKE ? OR COALESCE(LOWER(t.album), \'\') LIKE ? OR COALESCE(LOWER(t.genre), \'\') LIKE ?)',
    );
    filters.push(like, like, like, like);
  }
  if (options.genre) {
    where.push('t.genre = ?');
    filters.push(options.genre);
  }

  const whereSql = where.join(' AND ');
  const orderSql =
    options.sort === 'top' ? 't.plays DESC, t.created_at DESC' : 't.created_at DESC';

  const rows = await db.all<TrackWithLiked>(
    `SELECT t.*, CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS liked
     FROM tracks t
     LEFT JOIN likes l ON l.track_id = t.id AND l.user_id = ?
     WHERE ${whereSql}
     ORDER BY ${orderSql}
     LIMIT ? OFFSET ?`,
    [viewerId, ...filters, options.limit, options.offset],
  );

  const totalRow = await db.get<{ total: number | string }>(
    `SELECT COUNT(*) AS total FROM tracks t WHERE ${whereSql}`,
    filters,
  );

  return { tracks: rows, total: Number(totalRow?.total ?? 0) };
}

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  flac: 'audio/flac',
  webm: 'audio/webm',
};

function sendLocalAudio(req: FastifyRequest, reply: FastifyReply, filePath: string) {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const extension = path.extname(filePath).slice(1).toLowerCase();
  reply.header('Content-Type', MIME_BY_EXT[extension] ?? 'application/octet-stream');
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Cache-Control', 'public, max-age=3600');

  const rangeHeader = req.headers.range;
  if (!rangeHeader) {
    reply.header('Content-Length', String(total));
    if (req.method === 'HEAD') return reply.send();
    return reply.send(createReadStream(filePath));
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) {
    reply.code(416).header('Content-Range', `bytes */${total}`);
    return reply.send();
  }

  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    start = Math.max(0, total - suffix);
    end = total - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
    reply.code(416).header('Content-Range', `bytes */${total}`);
    return reply.send();
  }

  reply.code(206);
  reply.header('Content-Range', `bytes ${start}-${end}/${total}`);
  reply.header('Content-Length', String(end - start + 1));
  if (req.method === 'HEAD') return reply.send();
  return reply.send(createReadStream(filePath, { start, end }));
}

async function proxyAudio(req: FastifyRequest, reply: FastifyReply, sourceUrl: string) {
  const headers: Record<string, string> = {
    'User-Agent': 'MaximizeMusik/1.0 (+https://github.com)',
    Accept: 'audio/*,*/*;q=0.8',
  };
  if (req.headers.range) headers.Range = req.headers.range;

  const response = await fetch(sourceUrl, {
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok && response.status !== 206) {
    throw notFound('Аудиофайл недоступен у источника');
  }

  const passthrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag'];
  for (const header of passthrough) {
    const value = response.headers.get(header);
    if (value) reply.header(header, value);
  }
  if (!response.headers.get('accept-ranges')) reply.header('Accept-Ranges', 'bytes');
  reply.header('Cache-Control', 'public, max-age=3600');
  reply.code(response.status === 206 ? 206 : 200);

  if (req.method === 'HEAD' || !response.body) return reply.send();
  return reply.send(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]));
}

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

export async function registerTrackRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.get('/api/tracks', async (req) => {
    const query = parse(trackQuery, req.query);
    const viewer = await currentUser(req, db);
    const { tracks, total } = await listTracks(db, viewer?.id ?? '', query);
    return {
      tracks: tracks.map((track) => mapTrack(track, viewer)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  app.get('/api/genres', async () => {
    const rows = await db.all<{ genre: string; total: number | string }>(
      `SELECT genre, COUNT(*) AS total FROM tracks
       WHERE published = 1 AND genre IS NOT NULL AND genre <> ''
       GROUP BY genre ORDER BY total DESC LIMIT 14`,
    );
    return { genres: rows.map((row) => ({ name: row.genre, total: Number(row.total) })) };
  });

  app.get('/api/home', async (req) => {
    const viewer = await currentUser(req, db);
    const likedJoin = `LEFT JOIN likes l ON l.track_id = t.id AND l.user_id = ?`;

    const newest = await db.all<TrackRow>(
      `SELECT t.*, CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS liked
       FROM tracks t ${likedJoin}
       WHERE t.published = 1 ORDER BY t.created_at DESC LIMIT 10`,
      [viewer?.id ?? ''],
    );
    const top = await db.all<TrackRow>(
      `SELECT t.*, CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS liked
       FROM tracks t ${likedJoin}
       WHERE t.published = 1 ORDER BY t.plays DESC, t.created_at DESC LIMIT 10`,
      [viewer?.id ?? ''],
    );
    const genres = await db.all<{ genre: string; total: number | string }>(
      `SELECT genre, COUNT(*) AS total FROM tracks
       WHERE published = 1 AND genre IS NOT NULL AND genre <> ''
       GROUP BY genre ORDER BY total DESC LIMIT 10`,
    );

    let playlists: Array<{
      id: string;
      title: string;
      description: string | null;
      cover_url: string | null;
      total: number | string;
      user_id: string;
    }> = [];
    if (viewer) {
      playlists = await db.all(
        `SELECT p.id, p.title, p.description, p.cover_url, p.user_id,
                (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) AS total
         FROM playlists p WHERE p.user_id = ? ORDER BY p.updated_at DESC LIMIT 6`,
        [viewer.id],
      );
    }

    const totals = await db.get<{ total: number | string }>(
      'SELECT COUNT(*) AS total FROM tracks WHERE published = 1',
    );

    return {
      featured: top[0] ? mapTrack(top[0], viewer) : null,
      newest: newest.map((track) => mapTrack(track, viewer)),
      top: top.map((track) => mapTrack(track, viewer)),
      genres: genres.map((row) => ({ name: row.genre, total: Number(row.total) })),
      totalTracks: Number(totals?.total ?? 0),
      playlists: playlists.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        coverUrl: row.cover_url,
        total: Number(row.total),
        mine: row.user_id === viewer?.id,
      })),
    };
  });

  app.get('/api/tracks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const viewer = await currentUser(req, db);
    const track = await db.get<TrackRow>(
      `SELECT t.*, CASE WHEN l.user_id IS NULL THEN 0 ELSE 1 END AS liked
       FROM tracks t LEFT JOIN likes l ON l.track_id = t.id AND l.user_id = ?
       WHERE t.id = ?`,
      [viewer?.id ?? '', id],
    );
    if (!track) throw notFound('Трек не найден');
    if (!track.published) {
      if (!viewer || (viewer.role !== 'admin' && track.uploaded_by !== viewer.id)) {
        throw notFound('Трек не найден');
      }
    }
    return { track: mapTrack(track, viewer) };
  });

  app.get('/api/tracks/:id/cover', async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await db.get<{ cover_url: string | null }>(
      'SELECT cover_url FROM tracks WHERE id = ?',
      [id],
    );
    if (!track?.cover_url) throw notFound('Обложка не найдена');

    if (isLocalMedia(track.cover_url)) {
      const filePath = localMediaPath(track.cover_url);
      try {
        await fsp.access(filePath);
      } catch {
        throw notFound('Файл обложки не найден');
      }
      const extension = path.extname(filePath).slice(1).toLowerCase();
      reply.header('Content-Type', IMAGE_MIME[extension] ?? 'application/octet-stream');
      reply.header('Cache-Control', 'public, max-age=604800, immutable');
      return reply.send(createReadStream(filePath));
    }

    if (!/^https?:\/\//i.test(track.cover_url)) throw notFound('Обложка недоступна');
    const response = await fetch(track.cover_url, {
      headers: { Accept: 'image/*', 'User-Agent': 'MaximizeMusik/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok || !response.body) throw notFound('Обложка недоступна');
    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    const length = response.headers.get('content-length');
    reply.header('Content-Type', contentType);
    reply.header('Cache-Control', 'public, max-age=86400');
    if (length) reply.header('Content-Length', length);
    return reply.send(Readable.fromWeb(response.body as never));
  });

  app.get('/api/tracks/:id/stream', async (req, reply) => {
    const { id } = req.params as { id: string };
    const track = await db.get<TrackRow>('SELECT * FROM tracks WHERE id = ?', [id]);
    if (!track) throw notFound('Трек не найден');

    if (!track.published) {
      const viewer = await currentUser(req, db);
      if (!viewer || (viewer.role !== 'admin' && track.uploaded_by !== viewer.id)) {
        throw forbidden('Трек ещё не опубликован');
      }
    }

    if (isLocalMedia(track.audio_url)) {
      const filePath = localMediaPath(track.audio_url);
      try {
        await fsp.access(filePath);
      } catch {
        throw notFound('Файл не найден');
      }
      return sendLocalAudio(req, reply, filePath);
    }

    return proxyAudio(req, reply, track.audio_url);
  });

  app.post('/api/tracks/:id/play', async (req) => {
    const { id } = req.params as { id: string };
    const track = await db.get<{ id: string }>('SELECT id FROM tracks WHERE id = ?', [id]);
    if (!track) throw notFound('Трек не найден');
    const viewer = await currentUser(req, db);
    const now = new Date().toISOString();
    await db.run('INSERT INTO plays (id, user_id, track_id, played_at) VALUES (?, ?, ?, ?)', [
      crypto.randomUUID(),
      viewer?.id ?? null,
      id,
      now,
    ]);
    await db.run('UPDATE tracks SET plays = plays + 1 WHERE id = ?', [id]);
    return { ok: true };
  });
}

export type { UserRow };
