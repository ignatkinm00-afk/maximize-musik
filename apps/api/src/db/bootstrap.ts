import { randomUUID } from 'node:crypto';
import { config } from '../config.ts';
import { hashPassword } from '../lib/auth.ts';
import type { CatalogTrack, CatalogSource } from './sources.ts';
import { fetchCatalog } from './sources.ts';
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

  const order: CatalogSource[] = ['audius', 'jamendo', 'fma'];
  for (const source of order) {
    try {
      const catalog = await fetchCatalog(source);
      if (catalog.length < 10) {
        console.log(`[catalog] ${source}: слишком мало треков (${catalog.length}), пробую следующий`);
        continue;
      }
      const added = await insertCatalogTracks(db, catalog);
      console.log(`[catalog] источник ${source}: загружено ${added} треков`);
      return;
    } catch (error) {
      console.warn(`[catalog] ${source} недоступен: ${(error as Error).message}`);
    }
  }

  console.log('[catalog] ни один источник не дал каталог — приложение стартует пустым');
}
