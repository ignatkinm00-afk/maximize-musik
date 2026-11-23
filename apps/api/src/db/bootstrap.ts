import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.ts';
import { hashPassword } from '../lib/auth.ts';
import { fetchAudiusCatalog, type CatalogTrack } from './audius.ts';
import type { Database } from './index.ts';
import { nowIso } from './index.ts';

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e'];

export async function ensureAdmin(db: Database): Promise<void> {
  const existing = await db.get<{ id: string }>(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1",
  );
  if (existing) return;

  const emailTaken = await db.get<{ id: string }>('SELECT id FROM users WHERE email = ?', [
    config.adminEmail,
  ]);
  if (emailTaken) {
    await db.run("UPDATE users SET role = 'admin' WHERE id = ?", [emailTaken.id]);
    console.log(`[admin] пользователь ${config.adminEmail} повышен до администратора`);
    return;
  }

  const id = randomUUID();
  const now = nowIso();
  await db.run(
    `INSERT INTO users (id, email, password_hash, display_name, role, telegram_id, avatar_color, banned, created_at, last_seen_at)
     VALUES (?, ?, ?, 'Администратор', 'admin', NULL, '#8b5cf6', 0, ?, ?)`,
    [id, config.adminEmail, hashPassword(config.adminPassword), now, now],
  );
  console.log(`[admin] создан администратор: ${config.adminEmail} / ${config.adminPassword}`);
}

export async function insertCatalogTracks(
  db: Database,
  catalog: CatalogTrack[],
  options: { skipExisting?: boolean } = {},
): Promise<number> {
  const now = Date.now();
  let added = 0;

  for (const [index, track] of catalog.entries()) {
    if (!track.audioUrl || !track.title) continue;

    if (options.skipExisting) {
      const existing = await db.get<{ id: string }>('SELECT id FROM tracks WHERE audio_url = ?', [
        track.audioUrl,
      ]);
      if (existing) continue;
    }

    await db.run(
      `INSERT INTO tracks (id, title, artist, album, genre, duration, audio_url, cover_url, color, published, plays, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?)`,
      [
        randomUUID(),
        track.title.slice(0, 140),
        (track.artist || 'Unknown').slice(0, 140),
        track.album ?? null,
        track.genre ?? null,
        track.duration ?? 0,
        track.audioUrl,
        track.coverUrl ?? null,
        track.color ?? COLORS[index % COLORS.length]!,
        new Date(now - index * 3 * 3600 * 1000).toISOString(),
      ],
    );
    added += 1;
  }

  return added;
}

export async function ensureCatalog(db: Database): Promise<void> {
  const row = await db.get<{ total: number | string }>('SELECT COUNT(*) AS total FROM tracks');
  if (Number(row?.total ?? 0) > 0) return;

  let catalog: CatalogTrack[] = [];
  try {
    catalog = await fetchAudiusCatalog(100);
    console.log(`[catalog] Audius: получено треков ${catalog.length}`);
  } catch (error) {
    console.warn(`[catalog] Audius недоступен: ${(error as Error).message}`);
  }

  if (catalog.length < 10) {
    const file = path.join(import.meta.dirname, 'catalog.json');
    if (!fs.existsSync(file)) {
      console.log('[catalog] локальный catalog.json не найден — каталог пуст');
      return;
    }
    catalog = JSON.parse(fs.readFileSync(file, 'utf8')) as CatalogTrack[];
    console.log(`[catalog] фолбэк: локальный каталог (${catalog.length} треков)`);
  }

  const added = await insertCatalogTracks(db, catalog);
  console.log(`[catalog] загружено треков: ${added}`);
}
