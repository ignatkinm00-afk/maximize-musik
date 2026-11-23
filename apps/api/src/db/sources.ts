/**
 * Единый слой источников каталога.
 *
 * Audius  — публичный API, но может блокироваться по гео/дата-центру.
 * Jamendo — бесплатный API по ключу JAMENDO_CLIENT_ID (CC-музыка).
 * FMA     — локальный catalog.json (Free Music Archive через Internet Archive).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fetchAudiusCatalog, type CatalogTrack } from './audius.ts';

export type CatalogSource = 'audius' | 'jamendo' | 'fma';

export const CATALOG_LABELS: Record<CatalogSource, string> = {
  audius: 'Audius',
  jamendo: 'Jamendo',
  fma: 'Free Music Archive',
};

const COLORS = ['#8b5cf6', '#ec4899', '#22d3ee', '#f59e0b', '#34d399', '#6366f1', '#f43f5e'];

export function jamendoClientId(): string {
  return (process.env.JAMENDO_CLIENT_ID ?? '').trim();
}

interface JamendoTrack {
  id?: string;
  name?: string;
  artist_name?: string;
  album_name?: string;
  duration?: number;
  image?: string;
  audio?: string;
  musicinfo?: { tags?: { genres?: string[] } };
}

export async function fetchJamendoCatalog(limit = 200): Promise<CatalogTrack[]> {
  const clientId = jamendoClientId();
  if (!clientId) throw new Error('JAMENDO_CLIENT_ID не задан');

  const params = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: String(limit),
    order: 'popularity_total',
    include: 'musicinfo',
    audioformat: 'mp32',
  });

  const response = await fetch(`https://api.jamendo.com/v3.0/tracks/?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'MaximizeMusik/1.0' },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Jamendo ${response.status}`);

  const payload = (await response.json()) as {
    headers?: { status?: string; error_message?: string };
    results?: JamendoTrack[];
  };
  if (payload.headers?.status === 'failed') {
    throw new Error(payload.headers.error_message ?? 'Jamendo вернул ошибку');
  }

  const catalog: CatalogTrack[] = [];
  for (const track of payload.results ?? []) {
    if (!track.name || !track.audio) continue;
    const duration = Math.round(Number(track.duration) || 0);
    if (duration < 45 || duration > 1800) continue;
    catalog.push({
      title: track.name.slice(0, 120),
      artist: (track.artist_name ?? 'Jamendo Artist').slice(0, 120),
      album: track.album_name?.slice(0, 120) ?? null,
      genre: track.musicinfo?.tags?.genres?.[0]?.slice(0, 40) ?? null,
      duration,
      audioUrl: track.audio,
      coverUrl: track.image ?? null,
      color: COLORS[catalog.length % COLORS.length]!,
    });
  }
  return catalog;
}

export function getFmaCatalog(): CatalogTrack[] {
  const file = path.join(import.meta.dirname, 'catalog.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')) as CatalogTrack[];
}

export function catalogSourcesStatus(): Array<{
  id: CatalogSource;
  label: string;
  configured: boolean;
  hint: string;
}> {
  return [
    {
      id: 'audius',
      label: CATALOG_LABELS.audius,
      configured: true,
      hint: 'Публичный API Audius (может быть недоступен из РФ)',
    },
    {
      id: 'jamendo',
      label: CATALOG_LABELS.jamendo,
      configured: Boolean(jamendoClientId()),
      hint: jamendoClientId()
        ? 'Ключ Jamendo подключён'
        : 'Добавь JAMENDO_CLIENT_ID (бесплатно на developer.jamendo.com)',
    },
    {
      id: 'fma',
      label: CATALOG_LABELS.fma,
      configured: getFmaCatalog().length > 0,
      hint: 'Локальный каталог Creative Commons в репозитории',
    },
  ];
}

export async function fetchCatalog(source: CatalogSource): Promise<CatalogTrack[]> {
  if (source === 'audius') return fetchAudiusCatalog(100);
  if (source === 'jamendo') return fetchJamendoCatalog(200);
  if (source === 'fma') return getFmaCatalog();
  throw new Error(`Неизвестный источник: ${String(source)}`);
}

export type { CatalogTrack };
