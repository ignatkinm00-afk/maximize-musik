import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config, uploadsDir } from '../config.ts';

const EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

export function extensionFor(contentType: string, originalName = ''): string {
  const byType = EXTENSIONS[contentType.split(';')[0].trim().toLowerCase()];
  if (byType) return byType;
  const byName = originalName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  return byName.slice(0, 5) || 'bin';
}

const supabaseReady = () => Boolean(config.supabase.url && config.supabase.key);

async function saveToSupabase(
  buffer: Buffer,
  objectPath: string,
  contentType: string,
): Promise<string> {
  const url = `${config.supabase.url}/storage/v1/object/${config.supabase.bucket}/${objectPath}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.supabase.key}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
      'cache-control': 'public, max-age=31536000',
    },
    body: new Uint8Array(buffer),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Supabase Storage ${response.status}: ${detail.slice(0, 200)}`);
  }
  return `${config.supabase.url}/storage/v1/object/public/${config.supabase.bucket}/${objectPath}`;
}

/** Сохраняет файл и возвращает публичный URL (локальный /media/... либо Supabase). */
export async function saveMedia(
  buffer: Buffer,
  contentType: string,
  originalName = '',
): Promise<string> {
  const extension = extensionFor(contentType, originalName);
  const fileName = `${randomUUID()}.${extension}`;
  const objectPath = `uploads/${fileName}`;

  if (supabaseReady()) {
    return saveToSupabase(buffer, objectPath, contentType);
  }

  await fs.mkdir(uploadsDir, { recursive: true });
  await fs.writeFile(path.join(uploadsDir, fileName), buffer);
  return `/media/${fileName}`;
}

export const isLocalMedia = (url: string | null | undefined): url is string =>
  Boolean(url && url.startsWith('/media/'));

export function localMediaPath(url: string): string {
  const name = path.basename(url);
  return path.join(uploadsDir, name);
}
