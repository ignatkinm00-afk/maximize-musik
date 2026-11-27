import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Database } from '../db/index.ts';
import { nowIso } from '../db/index.ts';
import { requireUser, type UserRow } from '../lib/auth.ts';
import { badRequest } from '../lib/errors.ts';
import { mapTrack, type TrackRow } from '../lib/mappers.ts';
import { saveMedia } from '../lib/storage.ts';

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e'];

const AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/wav',
  'audio/x-wav',
  'audio/flac',
  'audio/webm',
];

export async function registerUploadRoutes(app: FastifyInstance, db: Database): Promise<void> {
  app.post('/api/tracks/upload', async (req, reply) => {
    const user = await requireUser(req, db);

    let audioBuffer: Buffer | null = null;
    let audioType = '';
    let audioName = '';
    let coverBuffer: Buffer | null = null;
    let coverType = '';
    const fields: Record<string, string> = {};

    const parts = req.parts({
      limits: { fileSize: 45 * 1024 * 1024, files: 2, fields: 12 },
    });

    for await (const part of parts) {
      if (part.type === 'file') {
        if (part.fieldname === 'cover') {
          coverBuffer = await part.toBuffer();
          coverType = part.mimetype;
        } else {
          audioBuffer = await part.toBuffer();
          audioType = part.mimetype;
          audioName = part.filename ?? '';
        }
      } else {
        fields[part.fieldname] = String(part.value);
      }
    }

    if (!audioBuffer) throw badRequest('Не приложен аудиофайл');
    if (!AUDIO_TYPES.includes(audioType.split(';')[0].trim().toLowerCase())) {
      throw badRequest('Поддерживаются MP3, M4A, AAC, OGG, WAV, FLAC и WebM');
    }

    const title = (fields.title ?? '').trim() || audioName.replace(/\.[^.]+$/, '') || 'Без названия';
    const artist = (fields.artist ?? '').trim() || user.display_name;

    const audioUrl = await saveMedia(audioBuffer, audioType, audioName);
    let coverUrl: string | null = null;
    if (coverBuffer && coverBuffer.length > 0) {
      if (!coverType.startsWith('image/')) throw badRequest('Обложка должна быть изображением');
      coverUrl = await saveMedia(coverBuffer, coverType, 'cover');
    }

    const isAdmin = user.role === 'admin';
    const id = randomUUID();
    const createdAt = nowIso();
    const duration = Number(fields.duration);
    const track: TrackRow = {
      id,
      title: title.slice(0, 140),
      artist: artist.slice(0, 140),
      album: (fields.album ?? '').trim().slice(0, 140) || null,
      genre: (fields.genre ?? '').trim().slice(0, 60) || null,
      duration: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0,
      audio_url: audioUrl,
      cover_url: coverUrl,
      lyrics: null,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
      published: isAdmin ? 1 : 0,
      plays: 0,
      uploaded_by: user.id,
      created_at: createdAt,
    };

    await db.run(
      `INSERT INTO tracks (id, title, artist, album, genre, duration, audio_url, cover_url, color, published, plays, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        track.id,
        track.title,
        track.artist,
        track.album,
        track.genre,
        track.duration,
        track.audio_url,
        track.cover_url,
        track.color,
        track.published,
        track.uploaded_by,
        track.created_at,
      ],
    );

    reply.code(201);
    return { track: mapTrack(track, user as UserRow) };
  });
}
