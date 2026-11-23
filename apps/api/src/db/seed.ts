/**
 * Наполняет каталог легальной музыкой из Internet Archive.
 * Источник: коллекция Free Music Archive (Creative Commons), только прямые MP3.
 *
 * Запуск: npm run seed [-- --limit 60]
 * Результат: src/db/catalog.json (коммитится, чтобы демо работало без сети).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const SEARCH = 'https://archive.org/advancedsearch.php';
const METADATA = 'https://archive.org/metadata';
const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e'];

const limitArg = process.argv.findIndex((value) => value === '--limit');
const target = limitArg >= 0 ? Number(process.argv[limitArg + 1]) || 72 : 72;

interface ArchiveFile {
  name: string;
  format?: string;
  length?: string;
  title?: string;
  album?: string;
  genre?: string;
  size?: string;
  private?: string | boolean;
}

interface ArchiveMetadata {
  metadata?: Record<string, unknown>;
  files?: ArchiveFile[];
}

interface CatalogTrack {
  title: string;
  artist: string;
  album: string | null;
  genre: string | null;
  duration: number;
  audioUrl: string;
  coverUrl: string;
  color: string;
}

const firstString = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const found = value.find((item) => typeof item === 'string');
    return typeof found === 'string' ? found.trim() : null;
  }
  return null;
};

async function getJson<T>(url: string, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'MaximizeMusik-seed/1.0' },
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  throw lastError;
}

const encodePath = (name: string) => name.split('/').map(encodeURIComponent).join('/');

function normalizeGenre(raw: string | null): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[()[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || cleaned.length > 26) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

const cleanTitle = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/^\d+[\s._-]+/, '')
    .trim();

async function collect(): Promise<CatalogTrack[]> {
  const params = new URLSearchParams();
  params.set('q', 'collection:freemusicarchive AND mediatype:audio AND format:(MP3)');
  params.append('fl[]', 'identifier');
  params.append('sort[]', 'downloads desc');
  params.set('rows', '140');
  params.set('page', '1');
  params.set('output', 'json');
  const search = await getJson<{ response: { docs: Array<{ identifier: string }> } }>(
    `${SEARCH}?${params.toString()}`,
  );

  const identifiers = search.response.docs.map((doc) => doc.identifier);
  console.log(`Найдено альбомов: ${identifiers.length}. Собираю треки...`);

  const tracks: CatalogTrack[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < identifiers.length; index += 6) {
    const chunk = identifiers.slice(index, index + 6);
    const results = await Promise.allSettled(
      chunk.map(async (identifier) => {
        const meta = await getJson<ArchiveMetadata>(`${METADATA}/${encodeURIComponent(identifier)}`);
        return { identifier, meta };
      }),
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const { identifier, meta } = result.value;
      const info = meta.metadata ?? {};
      const license = firstString(info.licenseurl) ?? '';
      if (!license.includes('creativecommons')) continue;

      const artist = firstString(info.creator) ?? 'Various Artists';
      const album = firstString(info.title);
      const coverUrl = `https://archive.org/services/img/${encodeURIComponent(identifier)}`;

      const files = (meta.files ?? [])
        .filter(
          (file) =>
            file.name?.toLowerCase().endsWith('.mp3') &&
            file.private !== 'true' &&
            file.private !== true,
        )
        .slice(0, 2);

      for (const file of files) {
        const duration = Math.round(Number.parseFloat(file.length ?? '0'));
        if (!Number.isFinite(duration) || duration < 45 || duration > 900) continue;

        const rawTitle = cleanTitle(file.title ?? file.name.replace(/\.mp3$/i, ''));
        if (!rawTitle || rawTitle.length < 2) continue;

        const key = `${artist.toLowerCase()}::${rawTitle.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        tracks.push({
          title: rawTitle.slice(0, 120),
          artist: artist.slice(0, 120),
          album: (file.album ?? album)?.slice(0, 120) ?? null,
          genre: normalizeGenre(file.genre ?? null) ?? normalizeGenre(firstString(info.subject)),
          duration,
          audioUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodePath(file.name)}`,
          coverUrl,
          color: COLORS[tracks.length % COLORS.length]!,
        });

        if (tracks.length >= target) break;
      }
      if (tracks.length >= target) break;
    }

    console.log(
      `  обработано ${Math.min(index + 6, identifiers.length)} / ${identifiers.length}, треков: ${tracks.length}`,
    );
    if (tracks.length >= target) break;
  }

  return tracks;
}

const tracks = await collect();
if (tracks.length < 10) {
  console.error(`Слишком мало треков (${tracks.length}) — прерываю, каталог не перезаписан.`);
  process.exit(1);
}

const output = path.join(import.meta.dirname, 'catalog.json');
await fs.writeFile(output, `${JSON.stringify(tracks, null, 2)}\n`, 'utf8');
console.log(`\nГотово: ${tracks.length} треков → ${output}`);

let ok = 0;
for (const track of tracks.slice(0, 5)) {
  try {
    const response = await fetch(track.audioUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) ok += 1;
    console.log(`  ${response.status} ${track.artist} — ${track.title}`);
  } catch (error) {
    console.log(`  FAIL ${(error as Error).message} — ${track.title}`);
  }
}
console.log(`Проверка ссылок: ${ok}/5 доступны`);
